import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";
import { can } from "@/lib/plans";
import { parseOrderStatus } from "@/lib/fulfillment";

export async function PATCH(request: Request) {
  const session = await requireTenantSession();
  if (!can(session.restaurant.plan_type, "crm")) {
    return NextResponse.json({ error: "plan required: pro" }, { status: 403 });
  }

  const body = (await request.json()) as { id?: string; status?: string };
  const status = parseOrderStatus(body.status);
  if (!body.id || !status) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", body.id)
    .eq("restaurant_id", session.restaurant.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status });
}
