import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { can } from "@/lib/plans";
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
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("id, plan_type")
      .eq("id", body.restaurant_id)
      .maybeSingle();

    if (!restaurant) {
      return NextResponse.json({ error: "restaurant not found" }, { status: 404 });
    }

    const plan = (restaurant as Restaurant).plan_type || "catalog";
    const raw = body.payload;

    const customerName = String(
      raw.customer_name ?? raw.customerName ?? "Cliente",
    );
    const fulfillmentRaw = String(raw.fulfillment ?? "delivery");
    const fulfillment: "pickup" | "delivery" =
      fulfillmentRaw === "pickup" ? "pickup" : "delivery";
    const paymentMethod = (raw.payment_method ??
      raw.paymentMethod ??
      "cash") as OrderLogPayload["payment_method"];
    const cashAmount =
      (raw.cash_amount as number | null | undefined) ??
      (raw.cashAmount as number | null | undefined) ??
      null;
    const phone =
      (raw.phone as string | null | undefined)?.trim() || null;

    const couponCode = String(raw.coupon_code ?? "")
      .trim()
      .toUpperCase();
    const discountAmt = Number(raw.discount ?? 0);

    const normalized: OrderLogPayload = {
      customer_name: customerName,
      fulfillment,
      payment_method: paymentMethod,
      cash_amount: cashAmount,
      phone,
      items: (raw.items as OrderLogPayload["items"]) ?? [],
      subtotal: Number(raw.subtotal ?? 0),
      shipping: Number(raw.shipping ?? 0),
      total: Number(raw.total ?? 0),
      coupon_code: couponCode || null,
      discount: discountAmt > 0 ? discountAmt : 0,
      // Strip address / maps / references / full WA body for privacy
    };

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
          const phoneDigits = (phone ?? "").replace(/\D/g, "");
          if (
            !coupon.max_uses_per_customer ||
            phoneDigits.length >= 10
          ) {
            await admin.from("tenant_coupon_redemptions").insert({
              coupon_id: coupon.id,
              restaurant_id: body.restaurant_id,
              customer_phone: phoneDigits,
              discount_applied: discountAmt,
            });
          }
        }
      } catch {
        /* non-fatal */
      }
    }

    if (can(plan, "crm")) {
      const name = customerName.trim() || "Cliente";

      let customerId: string | null = null;

      if (phone) {
        const { data: existing } = await supabase
          .from("customers")
          .select("id, orders_count")
          .eq("restaurant_id", body.restaurant_id)
          .eq("phone", phone)
          .limit(1)
          .maybeSingle();
        if (existing) {
          customerId = existing.id;
          await supabase
            .from("customers")
            .update({
              name,
              orders_count: (existing.orders_count ?? 0) + 1,
              last_order_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        }
      }

      if (!customerId) {
        const { data: created } = await supabase
          .from("customers")
          .insert({
            restaurant_id: body.restaurant_id,
            name,
            phone,
            address: "",
            orders_count: 1,
            last_order_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        customerId = created?.id ?? null;
      }

      await supabase.from("orders").insert({
        restaurant_id: body.restaurant_id,
        customer_id: customerId,
        payload: normalized,
        total: normalized.total,
        status: "submitted",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
