import { createClient } from "@/lib/supabase/server";
import {
  endOfMexicoCityDay,
  mexicoCityTodayYmd,
  startOfMexicoCityDay,
  ymdInMexicoCity,
} from "@/lib/dates";

export type AnalyticsSeriesPoint = {
  date: string;
  views: number;
  waClicks: number;
  orders: number;
};

export type AnalyticsTopDish = {
  dishId: string | null;
  name: string;
  opens: number;
  adds: number;
};

export type AnalyticsCouponRow = {
  code: string;
  redemptions: number;
};

export type AnalyticsChannel = {
  key: string;
  label: string;
  value: number;
};

export type AnalyticsHourly = {
  hour: number;
  views: number;
};

export type AnalyticsBundle = {
  series: AnalyticsSeriesPoint[];
  hourly: AnalyticsHourly[];
  topDishes: AnalyticsTopDish[];
  coupons: AnalyticsCouponRow[];
  channels: AnalyticsChannel[];
  kpis: {
    views: number;
    waClicks: number;
    orders: number;
    conversionPct: number;
    salesTotal: number;
    avgTicket: number;
    topCoupon: string | null;
    topDish: string | null;
    topChannel: string | null;
  };
  meta: {
    from: string;
    to: string;
    instrumentationSparse: boolean;
  };
};

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function formatYmdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of YYYY-MM-DD from → to (calendar dates). */
export function eachDateInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = parseYmd(from);
  const end = parseYmd(to);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime()) || cur > end) {
    return out;
  }
  while (cur <= end) {
    out.push(formatYmdUtc(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export function resolveAnalyticsRange(
  preset: string | null,
  fromParam: string | null,
  toParam: string | null,
): { from: string; to: string } {
  const today = mexicoCityTodayYmd();
  if (fromParam && toParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
    return fromParam <= toParam
      ? { from: fromParam, to: toParam }
      : { from: toParam, to: fromParam };
  }
  const to = today;
  if (preset === "today") return { from: today, to };
  if (preset === "30d") {
    const d = parseYmd(today);
    d.setUTCDate(d.getUTCDate() - 29);
    return { from: formatYmdUtc(d), to };
  }
  if (preset === "month") {
    return { from: `${today.slice(0, 7)}-01`, to };
  }
  // default 7d
  const d = parseYmd(today);
  d.setUTCDate(d.getUTCDate() - 6);
  return { from: formatYmdUtc(d), to };
}

function dayBoundsUtc(fromYmd: string, toYmd: string): { startIso: string; endIso: string } {
  return {
    startIso: startOfMexicoCityDay(fromYmd),
    endIso: endOfMexicoCityDay(toYmd),
  };
}

export async function getAnalyticsBundle(
  restaurantId: string,
  from: string,
  to: string,
): Promise<AnalyticsBundle> {
  const supabase = await createClient();
  const dates = eachDateInclusive(from, to);
  const { startIso, endIso } = dayBoundsUtc(from, to);

  const [
    viewsRes,
    waRes,
    hoursRes,
    engageRes,
    landingsRes,
    flyersRes,
    logsRes,
    ordersRes,
    redemptionsRes,
  ] = await Promise.all([
    supabase
      .from("menu_view_days")
      .select("view_date, views")
      .eq("restaurant_id", restaurantId)
      .gte("view_date", from)
      .lte("view_date", to),
    supabase
      .from("wa_click_days")
      .select("view_date, clicks")
      .eq("restaurant_id", restaurantId)
      .gte("view_date", from)
      .lte("view_date", to),
    supabase
      .from("menu_view_hours")
      .select("hour, views")
      .eq("restaurant_id", restaurantId)
      .gte("view_date", from)
      .lte("view_date", to),
    supabase
      .from("dish_engagement_days")
      .select("dish_id, opens, adds")
      .eq("restaurant_id", restaurantId)
      .gte("view_date", from)
      .lte("view_date", to),
    supabase
      .from("flyer_landing_days")
      .select("flyer_id, landings")
      .eq("restaurant_id", restaurantId)
      .gte("view_date", from)
      .lte("view_date", to),
    supabase
      .from("flyers")
      .select("id, title")
      .eq("restaurant_id", restaurantId),
    supabase
      .from("order_logs")
      .select("created_at, payload")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    supabase
      .from("orders")
      .select("created_at, total, payload")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    supabase
      .from("tenant_coupon_redemptions")
      .select("coupon_id, created_at, discount_applied, customer_phone, tenant_coupons(code)")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", startIso)
      .lte("created_at", endIso),
  ]);

  const viewsByDay = new Map<string, number>();
  for (const r of viewsRes.data ?? []) {
    viewsByDay.set(String(r.view_date), Number(r.views ?? 0));
  }
  const waByDay = new Map<string, number>();
  for (const r of waRes.data ?? []) {
    waByDay.set(String(r.view_date), Number(r.clicks ?? 0));
  }

  const ordersByDay = new Map<string, number>();
  for (const r of logsRes.data ?? []) {
    const day = ymdInMexicoCity(r.created_at);
    if (day < from || day > to) continue;
    ordersByDay.set(day, (ordersByDay.get(day) ?? 0) + 1);
  }

  const series: AnalyticsSeriesPoint[] = dates.map((date) => ({
    date,
    views: viewsByDay.get(date) ?? 0,
    waClicks: waByDay.get(date) ?? 0,
    orders: ordersByDay.get(date) ?? 0,
  }));

  const hourlyMap = new Map<number, number>();
  for (let h = 0; h < 24; h++) hourlyMap.set(h, 0);
  for (const r of hoursRes.data ?? []) {
    const h = Number(r.hour);
    if (h < 0 || h > 23) continue;
    hourlyMap.set(h, (hourlyMap.get(h) ?? 0) + Number(r.views ?? 0));
  }
  const hourly: AnalyticsHourly[] = [...hourlyMap.entries()].map(([hour, views]) => ({
    hour,
    views,
  }));

  const engageAgg = new Map<string, { opens: number; adds: number }>();
  for (const r of engageRes.data ?? []) {
    const id = String(r.dish_id);
    const cur = engageAgg.get(id) ?? { opens: 0, adds: 0 };
    cur.opens += Number(r.opens ?? 0);
    cur.adds += Number(r.adds ?? 0);
    engageAgg.set(id, cur);
  }

  let topDishes: AnalyticsTopDish[] = [];
  if (engageAgg.size > 0) {
    const dishIds = [...engageAgg.keys()];
    const { data: dishes } = await supabase
      .from("dishes")
      .select("id, name")
      .in("id", dishIds);
    const nameById = new Map((dishes ?? []).map((d) => [d.id, d.name]));
    topDishes = [...engageAgg.entries()]
      .map(([dishId, v]) => ({
        dishId,
        name: nameById.get(dishId) ?? "Platillo",
        opens: v.opens,
        adds: v.adds,
      }))
      .sort((a, b) => b.adds - a.adds || b.opens - a.opens)
      .slice(0, 5);
  } else {
    // Fallback: quantities from order_logs / orders
    const qty = new Map<string, number>();
    const sources = [
      ...(logsRes.data ?? []),
      ...(ordersRes.data ?? []),
    ];
    for (const row of sources) {
      const items = (row.payload as { items?: { name?: string; quantity?: number }[] })
        ?.items;
      if (!items) continue;
      for (const it of items) {
        const name = String(it.name ?? "").trim() || "Ítem";
        qty.set(name, (qty.get(name) ?? 0) + Number(it.quantity ?? 0));
      }
    }
    topDishes = [...qty.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, adds]) => ({
        dishId: null,
        name,
        opens: 0,
        adds,
      }));
  }

  const couponCounts = new Map<string, number>();
  for (const r of redemptionsRes.data ?? []) {
    const nested = r.tenant_coupons as { code?: string } | { code?: string }[] | null;
    const code = Array.isArray(nested)
      ? nested[0]?.code
      : nested?.code;
    const key = String(code ?? "—").toUpperCase();
    couponCounts.set(key, (couponCounts.get(key) ?? 0) + 1);
  }
  const coupons: AnalyticsCouponRow[] = [...couponCounts.entries()]
    .map(([code, redemptions]) => ({ code, redemptions }))
    .sort((a, b) => b.redemptions - a.redemptions);

  const flyerTitle = new Map(
    (flyersRes.data ?? []).map((f) => [f.id as string, String(f.title || "Flyer")]),
  );
  const landingByFlyer = new Map<string, number>();
  let landingSum = 0;
  for (const r of landingsRes.data ?? []) {
    const id = String(r.flyer_id);
    const n = Number(r.landings ?? 0);
    landingByFlyer.set(id, (landingByFlyer.get(id) ?? 0) + n);
    landingSum += n;
  }

  const viewsTotal = series.reduce((s, p) => s + p.views, 0);
  const waTotal = series.reduce((s, p) => s + p.waClicks, 0);
  const ordersTotal = series.reduce((s, p) => s + p.orders, 0);
  const direct = Math.max(0, viewsTotal - landingSum);

  const channels: AnalyticsChannel[] = [
    ...[...landingByFlyer.entries()]
      .map(([id, value]) => ({
        key: id,
        label: flyerTitle.get(id) ?? "Flyer",
        value,
      }))
      .sort((a, b) => b.value - a.value),
    { key: "direct", label: "Directo / otros", value: direct },
  ].filter((c) => c.value > 0 || c.key === "direct");

  const orderTotals = (ordersRes.data ?? []).map((o) => Number(o.total ?? 0));
  let salesTotal = orderTotals.reduce((s, n) => s + n, 0);
  if (salesTotal === 0 && (logsRes.data ?? []).length > 0) {
    salesTotal = (logsRes.data ?? []).reduce(
      (s, r) => s + Number((r.payload as { total?: number })?.total ?? 0),
      0,
    );
  }
  const ticketCount =
    orderTotals.length > 0 ? orderTotals.length : ordersTotal;
  const avgTicket = ticketCount ? salesTotal / ticketCount : 0;

  const conversionPct =
    viewsTotal > 0
      ? Math.round(((waTotal + ordersTotal) / viewsTotal) * 1000) / 10
      : 0;

  const hourlySum = hourly.reduce((s, h) => s + h.views, 0);
  const instrumentationSparse = hourlySum === 0 || waTotal === 0;

  const topCoupon = coupons[0]?.code ?? null;
  const topDish = topDishes[0]?.name ?? null;
  const topChannel =
    [...channels].sort((a, b) => b.value - a.value)[0]?.label ?? null;

  return {
    series,
    hourly,
    topDishes,
    coupons,
    channels,
    kpis: {
      views: viewsTotal,
      waClicks: waTotal,
      orders: ordersTotal,
      conversionPct,
      salesTotal,
      avgTicket,
      topCoupon,
      topDish,
      topChannel,
    },
    meta: {
      from,
      to,
      instrumentationSparse,
    },
  };
}
