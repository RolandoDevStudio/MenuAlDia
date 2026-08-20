import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";
import { writeAuditLog } from "@/lib/audit";
import { PLAN_LABELS, type PlanType } from "@/lib/plans";
import { computeGraceWindow } from "@/lib/subscription-lifecycle";

export async function GET(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const status = new URL(request.url).searchParams.get("status") || "pending";
  const supabase = await createClient();
  let query = supabase
    .from("plan_change_requests")
    .select(
      "*, restaurants ( id, name, slug, plan_type, subscription_end_date, is_active, grace_ends_at, purge_scheduled_at )",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (status !== "all") {
    query = query.eq("status", status);
  }
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ requests: data ?? [] });
}

export async function PATCH(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    action?: "approve" | "reject";
    review_note?: string;
  };

  if (!body.id || (body.action !== "approve" && body.action !== "reject")) {
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: reqRow, error: loadErr } = await supabase
    .from("plan_change_requests")
    .select("*")
    .eq("id", body.id)
    .maybeSingle();

  if (loadErr || !reqRow) {
    return NextResponse.json(
      { error: loadErr?.message ?? "no encontrada" },
      { status: loadErr ? 500 : 404 },
    );
  }
  if (reqRow.status !== "pending") {
    return NextResponse.json(
      { error: "La solicitud ya fue revisada" },
      { status: 409 },
    );
  }

  const note = (body.review_note ?? "").trim().slice(0, 1000);

  if (body.action === "reject") {
    const { error } = await supabase
      .from("plan_change_requests")
      .update({
        status: "rejected",
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
        review_note: note,
      })
      .eq("id", body.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await writeAuditLog({
      restaurantId: reqRow.restaurant_id,
      actorUserId: user?.id,
      actorLabel: user?.email ?? "super_admin",
      action: "plan_reject",
      summary: `Rechazó solicitud de plan (${reqRow.request_type})`,
      newValue: note || null,
    });
    return NextResponse.json({ ok: true });
  }

  // approve
  const now = new Date();
  const restaurantUpdate: Record<string, unknown> = {};

  if (reqRow.request_type === "cancel") {
    const window = computeGraceWindow(now);
    restaurantUpdate.is_active = false;
    restaurantUpdate.subscription_end_date = now.toISOString();
    restaurantUpdate.grace_ends_at = window.grace_ends_at;
    restaurantUpdate.purge_scheduled_at = window.purge_scheduled_at;
  } else if (reqRow.request_type === "change_plan" && reqRow.to_plan) {
    restaurantUpdate.plan_type = reqRow.to_plan;
  }

  if (Object.keys(restaurantUpdate).length > 0) {
    const { error: updErr } = await supabase
      .from("restaurants")
      .update(restaurantUpdate)
      .eq("id", reqRow.restaurant_id);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  }

  const { error: reqErr } = await supabase
    .from("plan_change_requests")
    .update({
      status: "approved",
      reviewed_by: user?.id ?? null,
      reviewed_at: now.toISOString(),
      review_note: note,
    })
    .eq("id", body.id);

  if (reqErr) {
    return NextResponse.json({ error: reqErr.message }, { status: 500 });
  }

  const summary =
    reqRow.request_type === "cancel"
      ? "Aprobó cancelación: menú off + periodo de gracia"
      : `Aprobó cambio de plan → ${PLAN_LABELS[reqRow.to_plan as PlanType] ?? reqRow.to_plan}`;

  await writeAuditLog({
    restaurantId: reqRow.restaurant_id,
    actorUserId: user?.id,
    actorLabel: user?.email ?? "super_admin",
    action: "plan_approve",
    fieldName: reqRow.request_type === "cancel" ? "is_active" : "plan_type",
    oldValue: reqRow.from_plan,
    newValue:
      reqRow.request_type === "cancel" ? "cancelled" : String(reqRow.to_plan),
    summary,
  });

  return NextResponse.json({ ok: true });
}
