import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";

export async function GET(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const restaurantId = new URL(request.url).searchParams.get("restaurant_id");
  if (!restaurantId) {
    return NextResponse.json(
      { error: "missing restaurant_id" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data ?? [] });
}
