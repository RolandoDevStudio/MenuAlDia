import { createClient } from "@/lib/supabase/server";
import {
  addCalendarDaysYmd,
  mexicoCityTodayYmd,
  startOfMexicoCityDay,
} from "@/lib/dates";
import { eachDateInclusive } from "@/lib/analytics-queries";
import {
  LANDING_EVENT_KEYS,
  LANDING_EVENT_LABELS,
  isLandingWaKey,
  type LandingEventKey,
} from "@/lib/landing-events";

export type LandingSeriesPoint = {
  date: string;
  views: number;
  waClicks: number;
  demos: number;
};

export type LandingBreakdownRow = {
  key: LandingEventKey;
  label: string;
  count: number;
};

export type LandingAnalyticsBundle = {
  series: LandingSeriesPoint[];
  breakdown: LandingBreakdownRow[];
  kpis: {
    views: number;
    waClicks: number;
    demos: number;
    ctrPct: number;
    tenantsLanding: number;
  };
  meta: { from: string; to: string };
};

function rangeForPreset(preset: string): { from: string; to: string } {
  const to = mexicoCityTodayYmd();
  if (preset === "today") return { from: to, to };
  if (preset === "30d") return { from: addCalendarDaysYmd(to, -29), to };
  return { from: addCalendarDaysYmd(to, -6), to };
}

export async function getLandingAnalyticsBundle(
  preset: string = "7d",
): Promise<LandingAnalyticsBundle> {
  const { from, to } = rangeForPreset(preset);
  const supabase = await createClient();
  const dates = eachDateInclusive(from, to);

  const [{ data: viewRows, error: viewErr }, { data: eventRows, error: eventErr }, tenantsLanding] =
    await Promise.all([
      supabase
        .from("platform_landing_view_days")
        .select("view_date, views")
        .gte("view_date", from)
        .lte("view_date", to),
      supabase
        .from("platform_landing_event_days")
        .select("view_date, event_key, count")
        .gte("view_date", from)
        .lte("view_date", to),
      countLandingTenants(from),
    ]);

  if (viewErr || eventErr) {
    const series: LandingSeriesPoint[] = dates.map((date) => ({
      date,
      views: 0,
      waClicks: 0,
      demos: 0,
    }));
    return {
      series,
      breakdown: LANDING_EVENT_KEYS.map((key) => ({
        key,
        label: LANDING_EVENT_LABELS[key],
        count: 0,
      })),
      kpis: {
        views: 0,
        waClicks: 0,
        demos: 0,
        ctrPct: 0,
        tenantsLanding,
      },
      meta: { from, to },
    };
  }

  const viewsByDay = new Map<string, number>();
  for (const r of viewRows ?? []) {
    viewsByDay.set(String(r.view_date).slice(0, 10), Number(r.views) || 0);
  }

  const eventsByDayKey = new Map<string, number>();
  const totals = new Map<LandingEventKey, number>();
  for (const k of LANDING_EVENT_KEYS) totals.set(k, 0);

  for (const r of eventRows ?? []) {
    const key = String(r.event_key);
    const day = String(r.view_date).slice(0, 10);
    const n = Number(r.count) || 0;
    eventsByDayKey.set(`${day}:${key}`, n);
    if (totals.has(key as LandingEventKey)) {
      totals.set(key as LandingEventKey, (totals.get(key as LandingEventKey) ?? 0) + n);
    }
  }

  const series: LandingSeriesPoint[] = dates.map((date) => {
    let waClicks = 0;
    let demos = 0;
    for (const k of LANDING_EVENT_KEYS) {
      const n = eventsByDayKey.get(`${date}:${k}`) ?? 0;
      if (isLandingWaKey(k)) waClicks += n;
      if (k === "demo_open") demos += n;
    }
    return {
      date,
      views: viewsByDay.get(date) ?? 0,
      waClicks,
      demos,
    };
  });

  const views = series.reduce((s, p) => s + p.views, 0);
  const waClicks = series.reduce((s, p) => s + p.waClicks, 0);
  const demos = series.reduce((s, p) => s + p.demos, 0);

  const breakdown: LandingBreakdownRow[] = LANDING_EVENT_KEYS.map((key) => ({
    key,
    label: LANDING_EVENT_LABELS[key],
    count: totals.get(key) ?? 0,
  })).sort((a, b) => b.count - a.count);

  return {
    series,
    breakdown,
    kpis: {
      views,
      waClicks,
      demos,
      ctrPct: views > 0 ? Math.round((waClicks / views) * 1000) / 10 : 0,
      tenantsLanding,
    },
    meta: { from, to },
  };
}

async function countLandingTenants(fromYmd: string): Promise<number> {
  const supabase = await createClient();
  const startIso = startOfMexicoCityDay(fromYmd);
  const { count } = await supabase
    .from("restaurants")
    .select("id", { count: "exact", head: true })
    .eq("acquisition_source", "landing")
    .gte("created_at", startIso);
  return count ?? 0;
}
