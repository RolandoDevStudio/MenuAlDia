import type { SupabaseClient } from "@supabase/supabase-js";

export type SnapshotCategory = {
  temp_id: string;
  name: string;
  sort_order: number;
  is_fixed_catalog: boolean;
};

export type SnapshotDish = {
  temp_id: string;
  category_temp_id: string | null;
  name: string;
  description: string;
  photo_url: string | null;
  price: number;
  is_side: boolean;
  is_active: boolean;
  sort_order: number;
};

export type SnapshotDailyMenu = {
  package_price: number;
  max_sides: number;
  menu_date: string;
  main_temp_ids: string[];
  side_temp_ids: string[];
} | null;

export type RestaurantSnapshot = {
  categories: SnapshotCategory[];
  dishes: SnapshotDish[];
  daily_menu: SnapshotDailyMenu;
};

export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
}

/** Build a portable snapshot from a restaurant's categories, dishes, and daily menu. */
export async function buildRestaurantSnapshot(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantSnapshot> {
  const [{ data: cats }, { data: dishes }, { data: selection }] =
    await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("sort_order"),
      supabase
        .from("dishes")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("sort_order"),
      supabase
        .from("daily_menu_selections")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .maybeSingle(),
    ]);

  const categories: SnapshotCategory[] = (cats ?? []).map((c) => ({
    temp_id: c.id,
    name: c.name,
    sort_order: c.sort_order,
    is_fixed_catalog: c.is_fixed_catalog,
  }));

  const snapshotDishes: SnapshotDish[] = (dishes ?? []).map((d) => ({
    temp_id: d.id,
    category_temp_id: d.category_id ?? null,
    name: d.name,
    description: d.description ?? "",
    photo_url: d.photo_url ?? null,
    price: d.price,
    is_side: d.is_side,
    is_active: d.is_active,
    sort_order: d.sort_order,
  }));

  let daily_menu: SnapshotDailyMenu = null;
  if (selection) {
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
    daily_menu = {
      package_price: selection.package_price,
      max_sides: selection.max_sides,
      menu_date: selection.menu_date,
      main_temp_ids: (mains ?? []).map((m) => m.dish_id),
      side_temp_ids: (sides ?? []).map((s) => s.dish_id),
    };
  }

  return { categories, dishes: snapshotDishes, daily_menu };
}

/** Apply a snapshot into a newly created restaurant (categories → dishes → daily). */
export async function applySnapshotToRestaurant(
  supabase: SupabaseClient,
  restaurantId: string,
  snapshot: unknown,
): Promise<void> {
  const snap = parseSnapshot(snapshot);
  if (!snap) return;

  const catMap = new Map<string, string>();
  for (const c of snap.categories) {
    const { data: nc } = await supabase
      .from("categories")
      .insert({
        restaurant_id: restaurantId,
        name: c.name,
        sort_order: c.sort_order,
        is_fixed_catalog: c.is_fixed_catalog,
      })
      .select("id")
      .single();
    if (nc) catMap.set(c.temp_id, nc.id);
  }

  const dishMap = new Map<string, string>();
  for (const d of snap.dishes) {
    const categoryId = d.category_temp_id
      ? (catMap.get(d.category_temp_id) ?? null)
      : null;
    const { data: nd } = await supabase
      .from("dishes")
      .insert({
        restaurant_id: restaurantId,
        category_id: categoryId,
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
    if (nd) dishMap.set(d.temp_id, nd.id);
  }

  if (!snap.daily_menu) return;

  const { data: ns } = await supabase
    .from("daily_menu_selections")
    .insert({
      restaurant_id: restaurantId,
      package_price: snap.daily_menu.package_price,
      max_sides: snap.daily_menu.max_sides,
      menu_date: snap.daily_menu.menu_date,
    })
    .select("id")
    .single();

  if (!ns) return;

  const mainRows = snap.daily_menu.main_temp_ids
    .map((id) => dishMap.get(id))
    .filter(Boolean)
    .map((dish_id) => ({ daily_menu_id: ns.id, dish_id: dish_id! }));
  const sideRows = snap.daily_menu.side_temp_ids
    .map((id) => dishMap.get(id))
    .filter(Boolean)
    .map((dish_id) => ({ daily_menu_id: ns.id, dish_id: dish_id! }));

  if (mainRows.length) await supabase.from("daily_menu_dishes").insert(mainRows);
  if (sideRows.length) await supabase.from("daily_menu_sides").insert(sideRows);
}

function parseSnapshot(raw: unknown): RestaurantSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const categories = Array.isArray(obj.categories) ? obj.categories : [];
  const dishes = Array.isArray(obj.dishes) ? obj.dishes : [];
  if (categories.length === 0 && dishes.length === 0 && !obj.daily_menu) {
    return null;
  }

  return {
    categories: categories.map((c, i) => {
      const row = (c ?? {}) as Record<string, unknown>;
      return {
        temp_id: String(row.temp_id ?? row.id ?? `cat-${i}`),
        name: String(row.name ?? ""),
        sort_order: Number(row.sort_order ?? i),
        is_fixed_catalog: Boolean(row.is_fixed_catalog),
      };
    }),
    dishes: dishes.map((d, i) => {
      const row = (d ?? {}) as Record<string, unknown>;
      const catRef =
        row.category_temp_id ?? row.category_id ?? null;
      return {
        temp_id: String(row.temp_id ?? row.id ?? `dish-${i}`),
        category_temp_id: catRef == null ? null : String(catRef),
        name: String(row.name ?? ""),
        description: String(row.description ?? ""),
        photo_url:
          row.photo_url == null ? null : String(row.photo_url),
        price: Number(row.price ?? 0),
        is_side: Boolean(row.is_side),
        is_active: row.is_active === undefined ? true : Boolean(row.is_active),
        sort_order: Number(row.sort_order ?? i),
      };
    }),
    daily_menu: parseDaily(obj.daily_menu),
  };
}

function parseDaily(raw: unknown): SnapshotDailyMenu {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const mains = Array.isArray(row.main_temp_ids)
    ? row.main_temp_ids
    : Array.isArray(row.main_dish_ids)
      ? row.main_dish_ids
      : [];
  const sides = Array.isArray(row.side_temp_ids)
    ? row.side_temp_ids
    : Array.isArray(row.side_dish_ids)
      ? row.side_dish_ids
      : [];
  return {
    package_price: Number(row.package_price ?? 0),
    max_sides: Number(row.max_sides ?? 2),
    menu_date: String(row.menu_date ?? new Date().toISOString().slice(0, 10)),
    main_temp_ids: mains.map(String),
    side_temp_ids: sides.map(String),
  };
}

/** Clone categories/dishes/daily from one restaurant into another (live clone). */
export async function cloneRestaurantMenu(
  supabase: SupabaseClient,
  sourceId: string,
  targetId: string,
): Promise<void> {
  const snapshot = await buildRestaurantSnapshot(supabase, sourceId);
  await applySnapshotToRestaurant(supabase, targetId, snapshot);
}
