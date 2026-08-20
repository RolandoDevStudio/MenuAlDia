import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";
import { writeAuditLog } from "@/lib/audit";
import { PLAN_LABELS, type PlanType } from "@/lib/plans";

export async function GET() {
  const session = await requireTenantSession();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_change_requests")
    .select("*")
    .eq("restaurant_id", session.restaurant.id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(request: Request) {
  const session = await requireTenantSession();
  const body = (await request.json()) as {
    request_type?: string;
    to_plan?: string | null;
    reason?: string;
    acknowledged_consequences?: boolean;
  };

  const requestType = body.request_type?.trim();
  if (requestType !== "cancel" && requestType !== "change_plan") {
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  }
  if (!body.acknowledged_consequences) {
    return NextResponse.json(
      { error: "Debes confirmar que leíste las consecuencias" },
      { status: 400 },
    );
  }

  let toPlan: string | null = null;
  if (requestType === "change_plan") {
    toPlan = body.to_plan?.trim() || null;
    if (!toPlan || !["catalog", "daily", "pro"].includes(toPlan)) {
      return NextResponse.json({ error: "plan destino inválido" }, { status: 400 });
    }
    if (toPlan === session.restaurant.plan_type) {
      return NextResponse.json(
        { error: "Ya tienes ese plan" },
        { status: 400 },
      );
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: pending } = await supabase
    .from("plan_change_requests")
    .select("id")
    .eq("restaurant_id", session.restaurant.id)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (pending) {
    return NextResponse.json(
      { error: "Ya tienes una solicitud pendiente. Cancélala o espera la revisión." },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("plan_change_requests")
    .insert({
      restaurant_id: session.restaurant.id,
      requested_by: user?.id ?? null,
      request_type: requestType,
      from_plan: session.restaurant.plan_type || "catalog",
      to_plan: toPlan,
      reason: (body.reason ?? "").trim().slice(0, 1000),
      acknowledged_consequences: true,
      status: "pending",
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "No se pudo crear la solicitud" },
      { status: 500 },
    );
  }

  const summary =
    requestType === "cancel"
      ? "Solicitó cancelar suscripción"
      : `Solicitó cambio de plan a ${PLAN_LABELS[toPlan as PlanType] ?? toPlan}`;

  await writeAuditLog({
    restaurantId: session.restaurant.id,
    actorUserId: user?.id,
    actorLabel: user?.email ?? "owner",
    action: "plan_request",
    fieldName: "plan_type",
    oldValue: session.restaurant.plan_type,
    newValue: requestType === "cancel" ? "cancel" : toPlan,
    summary,
  });

  return NextResponse.json({ ok: true, request: data });
}

/** Owner cancels own pending request */
export async function PATCH(request: Request) {
  const session = await requireTenantSession();
  const body = (await request.json()) as {
    id?: string;
    action?: string;
  };
  if (!body.id || body.action !== "cancel_request") {
    return NextResponse.json({ error: "acción inválida" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("plan_change_requests")
    .update({ status: "cancelled" })
    .eq("id", body.id)
    .eq("restaurant_id", session.restaurant.id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }

  await writeAuditLog({
    restaurantId: session.restaurant.id,
    actorUserId: user?.id,
    actorLabel: user?.email ?? "owner",
    action: "plan_request",
    summary: "Canceló su solicitud de plan pendiente",
  });

  return NextResponse.json({ ok: true, request: data });
}
