import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type {
  Combo,
  ComboItem,
  ComboWithItems,
  Dish,
  DishAddon,
  MemberRole,
  PublicRestaurantMenu,
  Restaurant,
} from "@/lib/types";
import { parseThemeConfig } from "@/lib/theme";
import { normalizeBusinessType } from "@/lib/business-labels";

function normalizeRestaurant(raw: Restaurant): Restaurant {
  const r = { ...raw };
  r.theme_config = parseThemeConfig(r.theme_config);
  r.plan_type = (r.plan_type as Restaurant["plan_type"]) || "catalog";
  r.business_type = normalizeBusinessType(r.business_type);
  r.owner_name = r.owner_name ?? "";
  r.city = r.city ?? "";
  r.state = r.state ?? "";
  r.instagram_url = r.instagram_url ?? null;
  r.facebook_url = r.facebook_url ?? null;
  r.tiktok_url = r.tiktok_url ?? null;
  r.offers_delivery = r.offers_delivery ?? true;
  return r;
}

export async function getSessionRestaurant(): Promise<{
  restaurant: Restaurant;
  userId: string;
  role: MemberRole;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role")
    .eq("user_id", user.id)
    .neq("role", "super_admin")
    .limit(1)
    .maybeSingle();

  let row = membership;
  if (!row) {
    const { data: anyMem } = await supabase
      .from("restaurant_members")
      .select("restaurant_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    row = anyMem;
  }

  if (!row) return null;

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", row.restaurant_id)
    .single();

  if (!restaurant) return null;
  return {
    restaurant: normalizeRestaurant(restaurant as Restaurant),
    userId: user.id,
    role: (row.role as MemberRole) || "owner",
  };
}

export async function isCurrentUserSuperAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("restaurant_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

async function fetchPublicMenuBySlug(
  slug: string,
): Promise<PublicRestaurantMenu | null> {
  const supabase = createPublicClient();

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select(
      "id, slug, name, slogan, logo_url, phone_whatsapp, address, maps_url, city, state, schedule_text, shipping_cost, free_shipping, created_at, plan_type, is_active, subscription_end_date, theme_config, business_type, owner_name, instagram_url, facebook_url, tiktok_url, offers_delivery",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (restaurantError) {
    console.error("[getPublicMenuBySlug] restaurant", restaurantError.message);
    return null;
  }
  if (!restaurant) return null;

  const r = normalizeRestaurant(restaurant as Restaurant);

  const [
    { data: categories },
    { data: dishes },
    { data: selection },
    { data: combosRows },
  ] = await Promise.all([
    supabase
      .from("categories")
      .select("id, restaurant_id, name, sort_order, is_fixed_catalog")
      .eq("restaurant_id", r.id)
      .order("sort_order"),
    supabase
      .from("dishes")
      .select(
        "id, restaurant_id, category_id, name, description, photo_url, price, is_side, is_active, sort_order",
      )
      .eq("restaurant_id", r.id)
      .eq("is_active", true)
      .is("archived_at", null)
      .order("sort_order"),
    supabase
      .from("daily_menu_selections")
      .select(
        "id, restaurant_id, package_price, max_sides, menu_date, updated_at",
      )
      .eq("restaurant_id", r.id)
      .maybeSingle(),
    supabase
      .from("combos")
      .select(
        "id, restaurant_id, slug, title, description, photo_url, fixed_price, is_active, sort_order",
      )
      .eq("restaurant_id", r.id)
      .eq("is_active", true)
      .is("archived_at", null)
      .order("sort_order"),
  ]);

  const dishList = (dishes ?? []) as Dish[];
  const dishIds = dishList.map((d) => d.id);

  let addons: DishAddon[] = [];
  if (dishIds.length > 0) {
    const { data: addonRows } = await supabase
      .from("dish_addons")
      .select("id, dish_id, name, price_delta, sort_order, is_active")
      .in("dish_id", dishIds)
      .eq("is_active", true)
      .is("archived_at", null)
      .order("sort_order");
    addons = (addonRows ?? []) as DishAddon[];
  }

  const addonsByDishId: Record<string, DishAddon[]> = {};
  for (const a of addons) {
    (addonsByDishId[a.dish_id] ??= []).push(a);
  }

  const comboList = (combosRows ?? []) as Combo[];
  const comboIds = comboList.map((c) => c.id);
  let comboItems: ComboItem[] = [];
  if (comboIds.length > 0) {
    const { data: itemRows } = await supabase
      .from("combo_items")
      .select("combo_id, dish_id, quantity, sort_order")
      .in("combo_id", comboIds)
      .order("sort_order");
    comboItems = (itemRows ?? []) as ComboItem[];
  }

  const dishMap = new Map(dishList.map((d) => [d.id, d]));
  const combos: ComboWithItems[] = comboList.map((c) => ({
    ...c,
    items: comboItems
      .filter((i) => i.combo_id === c.id)
      .map((i) => {
        const dish = dishMap.get(i.dish_id);
        return dish
          ? { ...i, dish }
          : null;
      })
      .filter(Boolean) as ComboWithItems["items"],
  })).filter((c) => c.items.length >= 2);

  let dailyDishes: Dish[] = [];
  let dailySides: Dish[] = [];

  if (selection) {
    const [{ data: mainLinks }, { data: sideLinks }] = await Promise.all([
      supabase
        .from("daily_menu_dishes")
        .select("dish_id")
        .eq("daily_menu_id", selection.id),
      supabase
        .from("daily_menu_sides")
        .select("dish_id")
        .eq("daily_menu_id", selection.id),
    ]);

    dailyDishes = (mainLinks ?? [])
      .map((l) => dishMap.get(l.dish_id))
      .filter(Boolean) as Dish[];
    dailySides = (sideLinks ?? [])
      .map((l) => dishMap.get(l.dish_id))
      .filter(Boolean) as Dish[];
  }

  return {
    restaurant: r,
    categories: categories ?? [],
    dishes: dishList,
    addonsByDishId,
    combos,
    dailyMenu: selection,
    dailyDishes,
    dailySides,
  };
}

export function menuCacheTag(slug: string) {
  return `menu-${slug}`;
}

/** Cached public menu; invalidate via revalidateTag(menuCacheTag(slug), 'max'). */
export function getCachedPublicMenuBySlug(slug: string) {
  return unstable_cache(
    () => fetchPublicMenuBySlug(slug),
    ["public-menu", slug],
    { tags: [menuCacheTag(slug)], revalidate: 3600 },
  )();
}

/** Deduped per-request (metadata + page share one fetch). */
export const getPublicMenuBySlug = cache(async (slug: string) => {
  return getCachedPublicMenuBySlug(slug);
});
