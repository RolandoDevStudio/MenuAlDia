import { createClient } from "@/lib/supabase/server";
import { can, type PlanType } from "@/lib/plans";
import { daysUntil } from "@/lib/subscription-lifecycle";
import { mexicoCityTodayYmd } from "@/lib/dates";

export type AdminOpsStats = {
  planType: PlanType | string;
  daysRemaining: number | null;
  dailyMenuActive: boolean;
  dailyMainCount: number;
  viewsToday: number;
  viewsTotal: number;
  activeCoupons: number;
};

export async function getAdminOpsStats(
  restaurantId: string,
  planType: PlanType | string,
  subscriptionEndDate: string | null | undefined,
): Promise<AdminOpsStats> {
  const supabase = await createClient();
  const today = mexicoCityTodayYmd();

  const [
    { data: selection },
    { data: todayRow },
    { data: viewRows },
    { count: couponCount },
  ] = await Promise.all([
    supabase
      .from("daily_menu_selections")
      .select("id, is_active")
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
    supabase
      .from("menu_view_days")
      .select("views")
      .eq("restaurant_id", restaurantId)
      .eq("view_date", today)
      .maybeSingle(),
    supabase
      .from("menu_view_days")
      .select("views")
      .eq("restaurant_id", restaurantId),
    supabase
      .from("tenant_coupons")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`),
  ]);

  let dailyMainCount = 0;
  if (selection?.id && can(planType, "daily_menu")) {
    const { count } = await supabase
      .from("daily_menu_dishes")
      .select("dish_id", { count: "exact", head: true })
      .eq("daily_menu_id", selection.id);
    dailyMainCount = count ?? 0;
  }

  const viewsTotal = (viewRows ?? []).reduce(
    (s, r) => s + Number(r.views ?? 0),
    0,
  );

  return {
    planType,
    daysRemaining: daysUntil(subscriptionEndDate),
    dailyMenuActive: selection ? selection.is_active !== false : true,
    dailyMainCount,
    viewsToday: Number(todayRow?.views ?? 0),
    viewsTotal,
    activeCoupons: couponCount ?? 0,
  };
}
