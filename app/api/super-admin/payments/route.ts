import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";
import { writeAuditLog, logFieldChanges } from "@/lib/audit";

export async function GET(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const restaurantId = searchParams.get("restaurant_id");
  const month = searchParams.get("month"); // YYYY-MM

  const supabase = await createClient();

  if (restaurantId) {
    const { data, error } = await supabase
      .from("tenant_payments")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("paid_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ payments: data ?? [] });
  }

  // Month list for finance console
  let query = supabase
    .from("tenant_payments")
    .select(
      "*, restaurants ( id, name, slug, owner_name )",
    )
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
      created_by: actor?.id ?? null,
    })
    .select("*")
    .single();

  if (payErr || !payment) {
    return NextResponse.json(
      { error: payErr?.message ?? "payment insert failed" },
      { status: 500 },
    );
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
    summary: `Registró pago ${amount} (${method}, SPEI:${reference || "—"}, ${periodDays} días)`,
  });

  await logFieldChanges({
    restaurantId: body.restaurant_id,
    actorUserId: actor?.id,
    actorLabel: actor?.email ?? "super_admin",
    before: restaurant as Record<string, unknown>,
    after: updated as Record<string, unknown>,
    fields: ["subscription_end_date", "plan_type"],
  });

  return NextResponse.json({
    ok: true,
    payment,
    restaurant: updated,
  });
}
