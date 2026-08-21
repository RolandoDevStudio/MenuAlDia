import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionRestaurant } from "@/lib/restaurant";
import { can } from "@/lib/plans";
import { deleteStoragePublicUrl } from "@/lib/storage-cleanup";

const FLYER_SELECT =
  "id, title, subtitle, headline, weekday_label, aspect, price_mode, package_price, options_json, items_json, png_path, created_at, source, is_active, expires_at";

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
    .select(FLYER_SELECT)
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
    source?: string;
    is_active?: boolean;
    expires_at?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.png_path) {
    return NextResponse.json({ error: "imagen requerida" }, { status: 400 });
  }

  const source = body.source === "upload" ? "upload" : "studio";

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
      source,
      is_active: body.is_active !== false,
      expires_at: body.expires_at || null,
    })
    .select(FLYER_SELECT)
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

export async function PATCH(request: Request) {
  const session = await getSessionRestaurant();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.restaurant.plan_type, "flyer")) {
    return NextResponse.json({ error: "plan required" }, { status: 403 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const id = String(body.id ?? "");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = String(body.title).trim();
  if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);
  if (body.expires_at !== undefined) {
    updates.expires_at = body.expires_at ? String(body.expires_at) : null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("flyers")
    .update(updates)
    .eq("id", id)
    .eq("restaurant_id", session.restaurant.id)
    .select(FLYER_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
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
