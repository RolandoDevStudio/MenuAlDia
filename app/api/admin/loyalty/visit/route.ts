import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";
import { emitTenantNotification } from "@/lib/notifications/emit";
import { can } from "@/lib/plans";

/** Record a loyalty visit; emit notification when goal is reached. */
export async function POST(request: Request) {
  const session = await requireTenantSession();
  if (!can(session.restaurant.plan_type, "crm")) {
    return NextResponse.json({ error: "plan required: pro" }, { status: 403 });
  }

  const body = (await request.json()) as { customer_id?: string };
  const customerId = body.customer_id?.trim();
  if (!customerId) {
    return NextResponse.json({ error: "customer_id required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: customer, error: cErr } = await supabase
    .from("customers")
    .select("id, name, visits_toward_reward, visit_count, restaurant_id")
    .eq("id", customerId)
    .eq("restaurant_id", session.restaurant.id)
    .maybeSingle();

  if (cErr || !customer) {
    return NextResponse.json(
      { error: cErr?.message ?? "cliente no encontrado" },
      { status: cErr ? 500 : 404 },
    );
  }

  const goal = Math.max(1, Number(session.restaurant.loyalty_goal ?? 10));
  const toward = (customer.visits_toward_reward ?? 0) + 1;
  const visitCount = Number(
    (customer as { visit_count?: number }).visit_count ?? 0,
  ) + 1;
  const now = new Date().toISOString();

  const { error: vErr } = await supabase.from("customer_visits").insert({
    restaurant_id: session.restaurant.id,
    customer_id: customer.id,
  });
  if (vErr) {
    return NextResponse.json({ error: vErr.message }, { status: 500 });
  }

  const { data: updated, error: uErr } = await supabase
    .from("customers")
    .update({
      visits_toward_reward: toward,
      visit_count: visitCount,
      last_visit_at: now,
    })
    .eq("id", customer.id)
    .select("*")
    .single();
  if (uErr || !updated) {
    return NextResponse.json(
      { error: uErr?.message ?? "update failed" },
      { status: 500 },
    );
  }

  const goalReached = toward >= goal;
  if (goalReached) {
    try {
      await emitTenantNotification({
        restaurantId: session.restaurant.id,
        type: "loyalty_goal",
        title: "Meta de lealtad alcanzada",
        body: `${customer.name || "Un cliente"} llegó a ${toward}/${goal} visitas.`,
        href: "/admin/customers",
        payload: { customer_id: customer.id, toward, goal },
      });
    } catch {
      /* non-fatal */
    }
  }

  return NextResponse.json({
    ok: true,
    toward,
    goal,
    goalReached,
    customer: updated,
  });
}
