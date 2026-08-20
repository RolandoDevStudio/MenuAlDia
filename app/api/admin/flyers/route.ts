import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionRestaurant } from "@/lib/restaurant";
import { can } from "@/lib/plans";
import { deleteStoragePublicUrl } from "@/lib/storage-cleanup";

export async function GET() {
  const session = await getSessionRestaurant();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.restaurant.plan_type, "flyer")) {
    return NextResponse.json({ error: "plan required" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("flyers")
    .select(
      "id, title, subtitle, headline, weekday_label, aspect, price_mode, package_price, png_path, created_at",
    )
    .eq("restaurant_id", session.restaurant.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ flyers: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSessionRestaurant();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.restaurant.plan_type, "flyer")) {
    return NextResponse.json({ error: "plan required" }, { status: 403 });
  }

  let body: {
    title?: string;
    subtitle?: string;
    headline?: string;
    weekday_label?: string;
    aspect?: string;
    price_mode?: string;
    package_price?: number | null;
    options_json?: Record<string, unknown>;
    items_json?: unknown[];
    png_path?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("flyers")
    .insert({
      restaurant_id: session.restaurant.id,
      title: body.title ?? "",
      subtitle: body.subtitle ?? "",
      headline: body.headline ?? "",
      weekday_label: body.weekday_label ?? "",
      aspect: body.aspect ?? "feed_4_5",
      price_mode: body.price_mode === "per_item" ? "per_item" : "package",
      package_price: body.package_price ?? null,
      options_json: body.options_json ?? {},
      items_json: body.items_json ?? [],
      png_path: body.png_path ?? null,
    })
    .select(
      "id, title, subtitle, headline, weekday_label, aspect, price_mode, package_price, png_path, created_at",
    )
    .single();

  if (error) {
    const quota =
      /límite|limit|flyer/i.test(error.message) || error.code === "P0001";
    return NextResponse.json(
      { error: error.message, quota },
      { status: quota ? 409 : 500 },
    );
  }

  void supabase.from("flyer_events").insert({
    restaurant_id: session.restaurant.id,
    action: "save",
  });

  return NextResponse.json({ flyer: data });
}

export async function DELETE(request: Request) {
  const session = await getSessionRestaurant();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.restaurant.plan_type, "flyer")) {
    return NextResponse.json({ error: "plan required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: row, error: fetchErr } = await supabase
    .from("flyers")
    .select("id, png_path")
    .eq("id", id)
    .eq("restaurant_id", session.restaurant.id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("flyers")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", session.restaurant.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await deleteStoragePublicUrl(supabase, row.png_path);

  return NextResponse.json({ ok: true });
}
