import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { Dish, Restaurant } from "@/lib/types";

export async function getSessionRestaurant(): Promise<{
  restaurant: Restaurant;
  userId: string;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("restaurant_members")
    .select("restaurant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", membership.restaurant_id)
    .single();

  if (!restaurant) return null;
  return { restaurant: restaurant as Restaurant, userId: user.id };
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

  const [
    { data: categories, error: catError },
    { data: dishes, error: dishError },
    { data: selection, error: selError },
  ] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order"),
    supabase
      .from("dishes")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("daily_menu_selections")
      .select("*")
      .eq("restaurant_id", restaurant.id)
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
    restaurant: restaurant as Restaurant,
    categories: categories ?? [],
    dishes: (dishes ?? []) as Dish[],
    dailyMenu: selection,
    dailyDishes,
    dailySides,
  };
});
