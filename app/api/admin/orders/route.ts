import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";
import { can } from "@/lib/plans";
import { parseOrderStatus } from "@/lib/fulfillment";
import type { OrderLogPayload } from "@/lib/types";

/** Orders created after `?after=<iso>`, used by the board to poll for new ones. */
export async function GET(request: Request) {
  const session = await requireTenantSession();
  if (!can(session.restaurant.plan_type, "crm")) {
    return NextResponse.json({ error: "plan required: pro" }, { status: 403 });
  }

  const after = new URL(request.url).searchParams.get("after");
  if (!after || Number.isNaN(Date.parse(after))) {
    return NextResponse.json({ error: "invalid after" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("restaurant_id", session.restaurant.id)
    .gt("created_at", after)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ orders: data ?? [] });
}

export async function PATCH(request: Request) {
  const session = await requireTenantSession();
  if (!can(session.restaurant.plan_type, "crm")) {
    return NextResponse.json({ error: "plan required: pro" }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    status?: string;
    shipping?: number | null;
  };
  if (!body.id) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: existing, error: loadError } = await supabase
    .from("orders")
    .select("id, payload, total, status")
    .eq("id", body.id)
    .eq("restaurant_id", session.restaurant.id)
    .maybeSingle();

  if (loadError || !existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const payload = {
    ...((existing.payload as OrderLogPayload | null) ?? {}),
  } as OrderLogPayload;

  const updates: Record<string, unknown> = {};
  let nextStatus = existing.status as string;

  if (body.status !== undefined) {
    const status = parseOrderStatus(body.status);
    if (!status) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    nextStatus = status;
    updates.status = status;
  }

  if (body.shipping !== undefined && body.shipping !== null) {
    const shipping = Math.max(0, Number(body.shipping));
    if (!Number.isFinite(shipping)) {
      return NextResponse.json({ error: "invalid shipping" }, { status: 400 });
    }
    const subtotal = Number(payload.subtotal ?? 0);
    const discount = Number(payload.discount ?? 0);
    payload.shipping = shipping;
    payload.shipping_pending = false;
    payload.total = Math.max(0, subtotal - discount) + shipping;
    updates.payload = payload;
    updates.total = payload.total;
  } else if (
    (nextStatus === "ready" || nextStatus === "closed") &&
    payload.shipping_pending === true
  ) {
    // No amount set → treat as included when finishing the order.
    const subtotal = Number(payload.subtotal ?? 0);
    const discount = Number(payload.discount ?? 0);
    payload.shipping = 0;
    payload.shipping_pending = false;
    payload.total = Math.max(0, subtotal - discount);
    updates.payload = payload;
    updates.total = payload.total;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", body.id)
    .eq("restaurant_id", session.restaurant.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    status: nextStatus,
    total: updates.total ?? existing.total,
    payload: updates.payload ?? payload,
  });
}
