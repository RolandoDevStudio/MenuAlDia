import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";
import { writeAuditLog, logFieldChanges } from "@/lib/audit";
import {
  isInvoiceStatus,
  needsInvoiceFromStatus,
  type InvoiceStatus,
} from "@/lib/finance-invoice";

export async function GET(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const restaurantId = searchParams.get("restaurant_id");
  const month = searchParams.get("month"); // YYYY-MM
  const includeVoided = searchParams.get("include_voided") === "1";

  const supabase = await createClient();

  if (restaurantId) {
    let query = supabase
      .from("tenant_payments")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("paid_at", { ascending: false });
    if (!includeVoided) {
      query = query.is("voided_at", null);
    }
    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ payments: data ?? [] });
  }

  let query = supabase
    .from("tenant_payments")
    .select("*, restaurants ( id, name, slug, owner_name )")
    .order("paid_at", { ascending: false });

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const end = new Date(Date.UTC(y, m, 1)).toISOString();
    query = query.gte("paid_at", start).lt("paid_at", end);
  }

  const { data, error } = await query.limit(500);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ payments: data ?? [] });
}

export async function POST(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    restaurant_id?: string;
    amount?: number;
    paid_at?: string;
    method?: string;
    plan_type?: string;
    period_days?: number;
    reference?: string;
    notes?: string;
    receipt_url?: string | null;
    needs_invoice?: boolean;
    coupon_code?: string | null;
    list_amount?: number | null;
  };

  if (!body.restaurant_id) {
    return NextResponse.json(
      { error: "missing restaurant_id" },
      { status: 400 },
    );
  }

  const periodDays =
    typeof body.period_days === "number" && body.period_days > 0
      ? body.period_days
      : 30;
  const amount = Number(body.amount ?? 0);
  if (!(amount > 0)) {
    return NextResponse.json({ error: "monto inválido" }, { status: 400 });
  }

  const method = body.method?.trim() || "transfer";
  const planType = body.plan_type?.trim() || "catalog";
  const paidAt = body.paid_at || new Date().toISOString();
  const reference = body.reference?.trim() ?? "";
  const notes = body.notes?.trim() ?? "";
  const receiptUrl = body.receipt_url?.trim() || null;
  const needsInvoice = Boolean(body.needs_invoice);
  const invoiceStatus: InvoiceStatus = needsInvoice ? "pending" : "global";

  let couponCode: string | null = null;
  let discountAmount = 0;
  let listAmount =
    body.list_amount != null && Number(body.list_amount) > 0
      ? Number(body.list_amount)
      : null;
  let couponId: string | null = null;

  if (body.coupon_code) {
    const { normalizeCouponCode, clampDiscount } = await import(
      "@/lib/coupons"
    );
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const code = normalizeCouponCode(body.coupon_code);
    try {
      const admin = createServiceClient();
      const { data: coupon } = await admin
        .from("platform_coupons")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (
        coupon?.is_active &&
        !(
          coupon.max_redemptions != null &&
          Number(coupon.redemption_count) >= Number(coupon.max_redemptions)
        ) &&
        !(coupon.ends_at && new Date(coupon.ends_at).getTime() < Date.now()) &&
        !(coupon.starts_at && new Date(coupon.starts_at).getTime() > Date.now()) &&
        (coupon.plan_scope === "all" || coupon.plan_scope === planType)
      ) {
        const base = listAmount ?? amount;
        discountAmount = clampDiscount({
          type: coupon.discount_type,
          value: Number(coupon.discount_value),
          base,
        });
        listAmount = base;
        couponCode = code;
        couponId = coupon.id;
      }
    } catch {
      /* ignore coupon if service missing */
    }
  }

  if (method === "transfer" && reference.length < 4) {
    return NextResponse.json(
      {
        error:
          "Para transferencia SPEI indica la clave de rastreo / referencia bancaria",
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const { data: restaurant, error: loadErr } = await supabase
    .from("restaurants")
    .select("id, subscription_end_date, plan_type")
    .eq("id", body.restaurant_id)
    .maybeSingle();

  if (loadErr || !restaurant) {
    return NextResponse.json(
      { error: loadErr?.message ?? "restaurant not found" },
      { status: loadErr ? 500 : 404 },
    );
  }

  const { data: payment, error: payErr } = await supabase
    .from("tenant_payments")
    .insert({
      restaurant_id: body.restaurant_id,
      amount,
      paid_at: paidAt,
      method,
      plan_type: planType,
      period_days: periodDays,
      reference,
      notes,
      receipt_url: receiptUrl,
      needs_invoice: needsInvoice,
      invoice_status: invoiceStatus,
      created_by: actor?.id ?? null,
      coupon_code: couponCode,
      discount_amount: discountAmount,
      list_amount: listAmount,
    })
    .select("*")
    .single();

  if (payErr || !payment) {
    return NextResponse.json(
      { error: payErr?.message ?? "payment insert failed" },
      { status: 500 },
    );
  }

  if (couponId && couponCode) {
    try {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      const admin = createServiceClient();
      await admin.from("platform_coupon_redemptions").insert({
        coupon_id: couponId,
        restaurant_id: body.restaurant_id,
        payment_id: payment.id,
        discount_applied: discountAmount,
      });
      const { data: cRow } = await admin
        .from("platform_coupons")
        .select("redemption_count")
        .eq("id", couponId)
        .maybeSingle();
      await admin
        .from("platform_coupons")
        .update({
          redemption_count: Number(cRow?.redemption_count ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", couponId);
    } catch {
      /* non-fatal */
    }
  }

  const now = Date.now();
  const currentEnd = restaurant.subscription_end_date
    ? new Date(restaurant.subscription_end_date).getTime()
    : 0;
  const base = Math.max(now, currentEnd);
  const newEnd = new Date(
    base + periodDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const restaurantUpdate: Record<string, unknown> = {
    subscription_end_date: newEnd,
    is_active: true,
    grace_ends_at: null,
    purge_scheduled_at: null,
    purged_at: null,
  };
  if (planType) restaurantUpdate.plan_type = planType;

  const { data: updated, error: updErr } = await supabase
    .from("restaurants")
    .update(restaurantUpdate)
    .eq("id", body.restaurant_id)
    .select("*")
    .single();

  if (updErr || !updated) {
    return NextResponse.json(
      { error: updErr?.message ?? "subscription update failed" },
      { status: 500 },
    );
  }

  await writeAuditLog({
    restaurantId: body.restaurant_id,
    actorUserId: actor?.id,
    actorLabel: actor?.email ?? "super_admin",
    action: "payment",
    fieldName: "amount",
    oldValue: null,
    newValue: String(amount),
    summary: `Registró pago ${amount} (${method}, SPEI:${reference || "—"}, ${periodDays} días${
      couponCode ? `, Campaña ${couponCode}` : ""
    })`,
  });

  await logFieldChanges({
    restaurantId: body.restaurant_id,
    actorUserId: actor?.id,
    actorLabel: actor?.email ?? "super_admin",
    before: restaurant as Record<string, unknown>,
    after: updated as Record<string, unknown>,
    fields: ["subscription_end_date", "plan_type"],
  });

  try {
    const { emitSuperAdminNotification } = await import(
      "@/lib/notifications/emit"
    );
    const { enqueueExternalWebhook } = await import(
      "@/lib/notifications/webhook"
    );
    if (receiptUrl) {
      await emitSuperAdminNotification({
        restaurantId: body.restaurant_id,
        type: "sa_payment_receipt",
        title: "Pago registrado con comprobante",
        body: `${updated.name ?? body.restaurant_id} · $${amount}`,
        href: `/super-admin/tenants?edit=${body.restaurant_id}`,
        payload: { payment_id: payment.id, receipt_url: receiptUrl },
      });
      await enqueueExternalWebhook("spei_receipt_uploaded", {
        restaurant_id: body.restaurant_id,
        payment_id: payment.id,
        amount,
        receipt_url: receiptUrl,
      });
    }
    if (needsInvoice) {
      await emitSuperAdminNotification({
        restaurantId: body.restaurant_id,
        type: "sa_invoice_request",
        title: "Solicitud de factura CFDI",
        body: `${updated.name ?? body.restaurant_id} · $${amount}`,
        href: "/super-admin/finanzas",
        payload: { payment_id: payment.id },
      });
    }
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({
    ok: true,
    payment,
    restaurant: updated,
  });
}

export async function PATCH(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    action?: "update_invoice" | "clear_receipt" | "void";
    invoice_status?: string;
    invoice_folio?: string;
    void_reason?: string;
  };

  if (!body.id || !body.action) {
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const { data: payment, error: loadErr } = await supabase
    .from("tenant_payments")
    .select("*")
    .eq("id", body.id)
    .maybeSingle();

  if (loadErr || !payment) {
    return NextResponse.json(
      { error: loadErr?.message ?? "pago no encontrado" },
      { status: loadErr ? 500 : 404 },
    );
  }

  if (payment.voided_at && body.action !== "update_invoice") {
    return NextResponse.json(
      { error: "El pago ya está anulado" },
      { status: 409 },
    );
  }

  if (body.action === "clear_receipt") {
    if (!payment.receipt_url) {
      return NextResponse.json({ ok: true, payment });
    }
    const { data: updated, error } = await supabase
      .from("tenant_payments")
      .update({ receipt_url: null })
      .eq("id", body.id)
      .select("*")
      .single();
    if (error || !updated) {
      return NextResponse.json(
        { error: error?.message ?? "No se pudo quitar el comprobante" },
        { status: 500 },
      );
    }
    await writeAuditLog({
      restaurantId: payment.restaurant_id,
      actorUserId: actor?.id,
      actorLabel: actor?.email ?? "super_admin",
      action: "payment_update",
      fieldName: "receipt_url",
      oldValue: payment.receipt_url,
      newValue: null,
      summary: "Quitó comprobante de pago",
    });
    return NextResponse.json({ ok: true, payment: updated });
  }

  if (body.action === "void") {
    if (payment.voided_at) {
      return NextResponse.json({ ok: true, payment });
    }
    const reason = (body.void_reason ?? "").trim().slice(0, 500);
    const { data: updated, error } = await supabase
      .from("tenant_payments")
      .update({
        voided_at: new Date().toISOString(),
        void_reason: reason,
      })
      .eq("id", body.id)
      .select("*")
      .single();
    if (error || !updated) {
      return NextResponse.json(
        { error: error?.message ?? "No se pudo anular" },
        { status: 500 },
      );
    }
    await writeAuditLog({
      restaurantId: payment.restaurant_id,
      actorUserId: actor?.id,
      actorLabel: actor?.email ?? "super_admin",
      action: "payment_void",
      fieldName: "voided_at",
      oldValue: null,
      newValue: updated.voided_at,
      summary: `Anuló pago ${payment.amount} (no revierte vigencia; ${reason || "sin motivo"})`,
    });
    return NextResponse.json({ ok: true, payment: updated });
  }

  if (body.action === "update_invoice") {
    if (!isInvoiceStatus(body.invoice_status)) {
      return NextResponse.json(
        { error: "estatus de factura inválido" },
        { status: 400 },
      );
    }
    const folio = (body.invoice_folio ?? "").trim().slice(0, 120);
    const updates: Record<string, unknown> = {
      invoice_status: body.invoice_status,
      needs_invoice: needsInvoiceFromStatus(body.invoice_status),
      invoice_folio: folio,
    };
    if (body.invoice_status === "issued") {
      updates.invoice_at = payment.invoice_at ?? new Date().toISOString();
    }
    if (body.invoice_status === "global") {
      updates.invoice_at = null;
      updates.invoice_folio = "";
    }

    const { data: updated, error } = await supabase
      .from("tenant_payments")
      .update(updates)
      .eq("id", body.id)
      .select("*")
      .single();
    if (error || !updated) {
      return NextResponse.json(
        { error: error?.message ?? "No se pudo actualizar factura" },
        { status: 500 },
      );
    }
    await writeAuditLog({
      restaurantId: payment.restaurant_id,
      actorUserId: actor?.id,
      actorLabel: actor?.email ?? "super_admin",
      action: "payment_update",
      fieldName: "invoice_status",
      oldValue: payment.invoice_status ?? null,
      newValue: body.invoice_status,
      summary: `Factura → ${body.invoice_status}${folio ? ` (${folio})` : ""}`,
    });
    return NextResponse.json({ ok: true, payment: updated });
  }

  return NextResponse.json({ error: "acción desconocida" }, { status: 400 });
}
