import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { Dish, MemberRole, Restaurant } from "@/lib/types";
import { parseThemeConfig } from "@/lib/theme";

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

  // Prefer tenant membership; fall back to any membership (incl. super_admin attached to a seed)
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
  const r = restaurant as Restaurant;
  r.theme_config = parseThemeConfig(r.theme_config);
  r.plan_type = (r.plan_type as Restaurant["plan_type"]) || "catalog";
  r.business_type =
    (r.business_type as Restaurant["business_type"]) || "restaurante";
  r.owner_name = r.owner_name ?? "";
  return {
    restaurant: r,
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

/** Deduped per-request (metadata + page share one fetch). */
export const getPublicMenuBySlug = cache(async (slug: string) => {
  const supabase = createPublicClient();

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (restaurantError) {
    console.error("[getPublicMenuBySlug] restaurant", restaurantError.message);
    return null;
  }
  if (!restaurant) return null;

  const r = restaurant as Restaurant;
  r.theme_config = parseThemeConfig(r.theme_config);
  r.plan_type = (r.plan_type as Restaurant["plan_type"]) || "catalog";

  const [
    { data: categories, error: catError },
    { data: dishes, error: dishError },
    { data: selection, error: selError },
  ] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", r.id)
      .order("sort_order"),
    supabase
      .from("dishes")
      .select("*")
      .eq("restaurant_id", r.id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("daily_menu_selections")
      .select("*")
      .eq("restaurant_id", r.id)
      .maybeSingle(),
  ]);

  if (catError || dishError || selError) {
    console.error("[getPublicMenuBySlug] related", {
      catError: catError?.message,
      dishError: dishError?.message,
      selError: selError?.message,
    });
  }

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

    const dishMap = new Map((dishes ?? []).map((d) => [d.id, d as Dish]));
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
    dishes: (dishes ?? []) as Dish[],
    dailyMenu: selection,
    dailyDishes,
    dailySides,
  };
});
