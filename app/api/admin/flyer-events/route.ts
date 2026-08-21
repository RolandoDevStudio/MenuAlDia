import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionRestaurant } from "@/lib/restaurant";
import { can } from "@/lib/plans";

export async function POST(request: Request) {
  const session = await getSessionRestaurant();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.restaurant.plan_type, "flyer")) {
    return NextResponse.json({ error: "plan required" }, { status: 403 });
  }

  let body: { restaurant_id?: string; action?: string; flyer_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const action = body.action;
  if (
    action !== "download" &&
    action !== "share" &&
    action !== "copy" &&
    action !== "save"
  ) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  if (body.restaurant_id && body.restaurant_id !== session.restaurant.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("flyer_events").insert({
    restaurant_id: session.restaurant.id,
    action,
    flyer_id: body.flyer_id || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
