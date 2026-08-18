import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";

export async function POST(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    source_slug?: string;
    new_slug?: string;
    new_name?: string;
  };

  const sourceSlug = body.source_slug?.trim();
  const newSlug = body.new_slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  const newName = body.new_name?.trim();

  if (!sourceSlug || !newSlug || !newName) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: source, error: srcErr } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", sourceSlug)
    .maybeSingle();

  if (srcErr || !source) {
    return NextResponse.json({ error: "source not found" }, { status: 404 });
  }

  const { data: created, error: createErr } = await supabase
    .from("restaurants")
    .insert({
      slug: newSlug,
      name: newName,
      slogan: source.slogan,
      logo_url: source.logo_url,
      phone_whatsapp: source.phone_whatsapp,
      address: source.address,
      maps_url: source.maps_url,
      schedule_text: source.schedule_text,
      shipping_cost: source.shipping_cost,
      free_shipping: source.free_shipping,
      plan_type: source.plan_type || "catalog",
      is_active: true,
      subscription_end_date: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      theme_config: source.theme_config,
    })
    .select("*")
    .single();

  if (createErr || !created) {
    return NextResponse.json(
      { error: createErr?.message ?? "create failed" },
      { status: 500 },
    );
  }

  const { data: cats } = await supabase
    .from("categories")
    .select("*")
    .eq("restaurant_id", source.id);

  const catMap = new Map<string, string>();
  for (const c of cats ?? []) {
    const { data: nc } = await supabase
      .from("categories")
      .insert({
        restaurant_id: created.id,
        name: c.name,
        sort_order: c.sort_order,
        is_fixed_catalog: c.is_fixed_catalog,
      })
      .select("id")
      .single();
    if (nc) catMap.set(c.id, nc.id);
  }

  const { data: dishes } = await supabase
    .from("dishes")
    .select("*")
    .eq("restaurant_id", source.id);

  const dishMap = new Map<string, string>();
  for (const d of dishes ?? []) {
    const { data: nd } = await supabase
      .from("dishes")
      .insert({
        restaurant_id: created.id,
        category_id: d.category_id ? catMap.get(d.category_id) ?? null : null,
        name: d.name,
        description: d.description,
        photo_url: d.photo_url,
        price: d.price,
        is_side: d.is_side,
        is_active: d.is_active,
        sort_order: d.sort_order,
      })
      .select("id")
      .single();
    if (nd) dishMap.set(d.id, nd.id);
  }

  const { data: selection } = await supabase
    .from("daily_menu_selections")
    .select("*")
    .eq("restaurant_id", source.id)
    .maybeSingle();

  if (selection) {
    const { data: ns } = await supabase
      .from("daily_menu_selections")
      .insert({
        restaurant_id: created.id,
        package_price: selection.package_price,
        max_sides: selection.max_sides,
        menu_date: selection.menu_date,
      })
      .select("id")
      .single();

    if (ns) {
      const [{ data: mains }, { data: sides }] = await Promise.all([
        supabase
          .from("daily_menu_dishes")
          .select("dish_id")
          .eq("daily_menu_id", selection.id),
        supabase
          .from("daily_menu_sides")
          .select("dish_id")
          .eq("daily_menu_id", selection.id),
      ]);

      const mainRows = (mains ?? [])
        .map((m) => dishMap.get(m.dish_id))
        .filter(Boolean)
        .map((dish_id) => ({ daily_menu_id: ns.id, dish_id: dish_id! }));
      const sideRows = (sides ?? [])
        .map((m) => dishMap.get(m.dish_id))
        .filter(Boolean)
        .map((dish_id) => ({ daily_menu_id: ns.id, dish_id: dish_id! }));

      if (mainRows.length)
        await supabase.from("daily_menu_dishes").insert(mainRows);
      if (sideRows.length)
        await supabase.from("daily_menu_sides").insert(sideRows);
    }
  }

  return NextResponse.json({ ok: true, slug: created.slug, id: created.id });
}
