import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";

export async function GET() {
  const session = await requireTenantSession();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("audience", "tenant")
    .eq("restaurant_id", session.restaurant.id)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const notifications = data ?? [];
  const unread = notifications.filter((n) => !n.read_at).length;
  return NextResponse.json({ notifications, unread });
}

export async function PATCH(request: Request) {
  const session = await requireTenantSession();
  const body = (await request.json()) as { id?: string; all?: boolean };
  const supabase = await createClient();
  const now = new Date().toISOString();

  if (body.all) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("audience", "tenant")
      .eq("restaurant_id", session.restaurant.id)
      .is("read_at", null);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: now })
    .eq("id", body.id)
    .eq("restaurant_id", session.restaurant.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
