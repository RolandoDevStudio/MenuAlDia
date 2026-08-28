import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { can } from "@/lib/plans";
import { normalizeMxPhone } from "@/lib/phone";
import { parseFulfillment } from "@/lib/fulfillment";
import type { OrderLogPayload, Restaurant } from "@/lib/types";

/**
 * Persist order analytics without customer delivery address
 * (address lives only in the WhatsApp message to the business).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      restaurant_id?: string;
      payload?: Record<string, unknown>;
    };
    if (!body.restaurant_id || !body.payload) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    const supabase = createPublicClient();
    let { data: restaurant } = await supabase
      .from("restaurants")
      .select("id, plan_type, orders_via_crm")
      .eq("id", body.restaurant_id)
      .maybeSingle();

    if (!restaurant) {
      // Tolerate a schema without migration 034 applied yet.
      ({ data: restaurant } = await supabase
        .from("restaurants")
        .select("id, plan_type")
        .eq("id", body.restaurant_id)
        .maybeSingle());
    }

    if (!restaurant) {
      return NextResponse.json({ error: "restaurant not found" }, { status: 404 });
    }

    const plan = (restaurant as Restaurant).plan_type || "catalog";
    const viaCrm =
      can(plan, "crm") && (restaurant as Restaurant).orders_via_crm === true;
    const raw = body.payload;

    const customerName = String(
      raw.customer_name ?? raw.customerName ?? "",
    ).trim();
    if (customerName.length < 2) {
      return NextResponse.json({ error: "nombre inválido" }, { status: 400 });
    }

    const phone = normalizeMxPhone(String(raw.phone ?? ""));
    if (!phone) {
      return NextResponse.json({ error: "teléfono inválido" }, { status: 400 });
    }

    const fulfillment = parseFulfillment(raw.fulfillment);
    if (!fulfillment) {
      return NextResponse.json({ error: "modalidad inválida" }, { status: 400 });
    }

    const paymentMethod = (raw.payment_method ??
      raw.paymentMethod ??
      "cash") as OrderLogPayload["payment_method"];
    const cashAmount =
      (raw.cash_amount as number | null | undefined) ??
      (raw.cashAmount as number | null | undefined) ??
      null;
    const tableLabel = String(raw.table_label ?? raw.tableLabel ?? "").trim();

    const couponCode = String(raw.coupon_code ?? "")
      .trim()
      .toUpperCase();
    const discountAmt = Number(raw.discount ?? 0);

    const normalized: OrderLogPayload = {
      customer_name: customerName,
      phone,
      fulfillment,
      payment_method: paymentMethod,
      cash_amount: cashAmount,
      table_label: fulfillment === "dine_in" && tableLabel ? tableLabel : null,
      items: (raw.items as OrderLogPayload["items"]) ?? [],
      subtotal: Number(raw.subtotal ?? 0),
      shipping: Number(raw.shipping ?? 0),
      total: Number(raw.total ?? 0),
      coupon_code: couponCode || null,
      discount: discountAmt > 0 ? discountAmt : 0,
    };

    // Delivery address is only stored when the business reads orders in the
    // panel; on the WhatsApp channel it stays in the chat message only.
    if (viaCrm && fulfillment === "delivery") {
      const address = String(raw.address ?? "").trim();
      const mapsUrl = String(raw.maps_url ?? raw.mapsUrl ?? "").trim();
      const references = String(raw.references ?? "").trim();
      if (address) normalized.address = address;
      if (mapsUrl) normalized.maps_url = mapsUrl;
      if (references) normalized.references = references;
    }

    await supabase.from("order_logs").insert({
      restaurant_id: body.restaurant_id,
      payload: normalized,
    });

    if (couponCode && discountAmt > 0) {
      try {
        const { createServiceClient } = await import("@/lib/supabase/admin");
        const { normalizeCouponCode } = await import("@/lib/coupons");
        const admin = createServiceClient();
        const code = normalizeCouponCode(couponCode);
        const { data: coupon } = await admin
          .from("tenant_coupons")
          .select("id, use_count, max_uses_per_customer")
          .eq("restaurant_id", body.restaurant_id)
          .eq("code", code)
          .maybeSingle();
        if (coupon) {
          await admin
            .from("tenant_coupons")
            .update({ use_count: Number(coupon.use_count ?? 0) + 1 })
            .eq("id", coupon.id);
          if (
            !coupon.max_uses_per_customer ||
            phone.length === 10
          ) {
            await admin.from("tenant_coupon_redemptions").insert({
              coupon_id: coupon.id,
              restaurant_id: body.restaurant_id,
              customer_phone: phone,
              discount_applied: discountAmt,
            });
          }
        }
      } catch {
        /* non-fatal */
      }
    }

    let orderId: string | null = null;
    let folio: number | null = null;

    if (can(plan, "crm")) {
      try {
        const { createServiceClient } = await import("@/lib/supabase/admin");
        const admin = createServiceClient();

        // A double tap (or a retried request) must not create a second order.
        const since = new Date(Date.now() - 60_000).toISOString();
        const { data: recent } = await admin
          .from("orders")
          .select("id, folio, payload, total")
          .eq("restaurant_id", body.restaurant_id)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(5);

        const duplicate = (recent ?? []).find(
          (o) =>
            Number(o.total) === normalized.total &&
            (o.payload as OrderLogPayload | null)?.phone === phone,
        );
        if (duplicate) {
          return NextResponse.json({
            ok: true,
            orderId: duplicate.id,
            folio: duplicate.folio ?? null,
            duplicate: true,
          });
        }

        const { data: customerId } = await admin.rpc(
          "upsert_customer_by_phone",
          {
            p_restaurant_id: body.restaurant_id,
            p_name: customerName,
            p_phone: phone,
            p_bump_order: true,
          },
        );

        const { data: inserted } = await admin
          .from("orders")
          .insert({
            restaurant_id: body.restaurant_id,
            customer_id: customerId ?? null,
            payload: normalized,
            total: normalized.total,
            status: "submitted",
          })
          .select("id, folio")
          .maybeSingle();

        orderId = inserted?.id ?? null;
        folio = inserted?.folio ?? null;

        try {
          const { emitTenantNotification } = await import(
            "@/lib/notifications/emit"
          );
          await emitTenantNotification({
            restaurantId: body.restaurant_id,
            type: "new_order",
            title: folio ? `Nuevo pedido #${folio}` : "Nuevo pedido",
            body: `${customerName} · ${normalized.total}`,
            href: "/admin/orders",
            payload: { phone, fulfillment },
          });
        } catch {
          /* non-fatal */
        }
      } catch (err) {
        console.error("[orders/log] crm", err);
      }
    }

    return NextResponse.json({ ok: true, orderId, folio });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
