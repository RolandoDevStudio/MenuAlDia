import { createClient } from "@/lib/supabase/server";
import {
  getPlanPrices,
  isSubscriptionActive,
  photoDishLimit,
  type PlanType,
} from "@/lib/plans";
import { isCanonicalDemoSlug } from "@/lib/canonical-demos";
import type { Restaurant } from "@/lib/types";
import {
  ACQUISITION_SOURCES,
  buildOnboardingWaMessage,
  ctrLabelFor,
  onboardingFlags,
  onboardingScoreFromFlags,
  pickWaTemplateKind,
  type CrmPayload,
  type CrmTenantRow,
} from "@/lib/super-admin-crm";

const DAY_MS = 24 * 60 * 60 * 1000;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function wasActiveAt(r: Restaurant, at: Date): boolean {
  if (r.is_active === false) {
    const end = new Date(r.subscription_end_date).getTime();
    return end > at.getTime();
  }
  const end = new Date(r.subscription_end_date).getTime();
  return Number.isFinite(end) ? end > at.getTime() : true;
}

export async function loadSuperAdminCrm(): Promise<CrmPayload> {
  const supabase = await createClient();
  const now = new Date();
  const nowMs = now.getTime();
  const d5 = new Date(nowMs - 5 * DAY_MS).toISOString();
  const d7 = nowMs + 7 * DAY_MS;
  const d30 = new Date(nowMs - 30 * DAY_MS);
  const d30Iso = d30.toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    restaurantsRes,
    paymentsRes,
    dishesRes,
    categoriesRes,
    viewsRes,
    clicksRes,
    ordersRes,
    planPrices,
  ] = await Promise.all([
    supabase
      .from("restaurants")
      .select(
        "id, slug, name, logo_url, theme_config, phone_whatsapp, plan_type, is_active, is_founding_partner, acquisition_source, internal_notes, created_at, subscription_end_date",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("tenant_payments")
      .select("restaurant_id, amount, paid_at, voided_at")
      .is("voided_at", null),
    supabase
      .from("dishes")
      .select("id, restaurant_id, photo_url, archived_at, updated_at, created_at")
      .is("archived_at", null),
    supabase.from("categories").select("id, restaurant_id, updated_at, created_at"),
    supabase
      .from("menu_view_days")
      .select("restaurant_id, views, view_date")
      .gte("view_date", d30.toISOString().slice(0, 10)),
    supabase
      .from("wa_click_days")
      .select("restaurant_id, clicks, view_date")
      .gte("view_date", d30.toISOString().slice(0, 10)),
    supabase
      .from("order_logs")
      .select("restaurant_id, payload, created_at")
      .gte("created_at", d30Iso),
    getPlanPrices(),
  ]);

  const all = (restaurantsRes.data ?? []) as Restaurant[];
  const tenants = all.filter((r) => !isCanonicalDemoSlug(r.slug));
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  const dishCount = new Map<string, number>();
  const photoCount = new Map<string, number>();
  const lastCatalog = new Map<string, number>();
  for (const d of dishesRes.data ?? []) {
    const id = d.restaurant_id as string;
    dishCount.set(id, (dishCount.get(id) ?? 0) + 1);
    if (String(d.photo_url ?? "").trim()) {
      photoCount.set(id, (photoCount.get(id) ?? 0) + 1);
    }
    const ts = new Date(String(d.updated_at || d.created_at || 0)).getTime();
    if (Number.isFinite(ts)) {
      lastCatalog.set(id, Math.max(lastCatalog.get(id) ?? 0, ts));
    }
  }
  const catCount = new Map<string, number>();
  for (const c of categoriesRes.data ?? []) {
    const id = c.restaurant_id as string;
    catCount.set(id, (catCount.get(id) ?? 0) + 1);
    const ts = new Date(String(c.updated_at || c.created_at || 0)).getTime();
    if (Number.isFinite(ts)) {
      lastCatalog.set(id, Math.max(lastCatalog.get(id) ?? 0, ts));
    }
  }

  const views30 = new Map<string, number>();
  for (const v of viewsRes.data ?? []) {
    const id = v.restaurant_id as string;
    views30.set(id, (views30.get(id) ?? 0) + Number(v.views ?? 0));
  }
  const clicks30 = new Map<string, number>();
  for (const v of clicksRes.data ?? []) {
    const id = v.restaurant_id as string;
    clicks30.set(id, (clicks30.get(id) ?? 0) + Number(v.clicks ?? 0));
  }

  const ordersMonthByTenant = new Map<string, number>();
  const lastOrder = new Map<string, number>();
  let ordersMonth = 0;
  let ordersPickup = 0;
  let ordersDelivery = 0;
  for (const o of ordersRes.data ?? []) {
    const id = o.restaurant_id as string;
    const ts = new Date(String(o.created_at)).getTime();
    lastOrder.set(id, Math.max(lastOrder.get(id) ?? 0, ts));
    if (String(o.created_at) >= monthStart) {
      ordersMonth += 1;
      ordersMonthByTenant.set(id, (ordersMonthByTenant.get(id) ?? 0) + 1);
      const fulfillment = String(
        (o.payload as { fulfillment?: string } | null)?.fulfillment ?? "",
      );
      if (fulfillment === "pickup") ordersPickup += 1;
      else ordersDelivery += 1;
    }
  }

  const paidSum = new Map<string, number>();
  const paidAny = new Set<string>();
  let cashMonth = 0;
  for (const p of paymentsRes.data ?? []) {
    const id = p.restaurant_id as string;
    const amt = Number(p.amount ?? 0);
    paidSum.set(id, (paidSum.get(id) ?? 0) + amt);
    paidAny.add(id);
    if (String(p.paid_at) >= monthStart) cashMonth += amt;
  }

  const active = tenants.filter((r) => isSubscriptionActive(r));
  const mrr = active.reduce((sum, r) => {
    const plan = (r.plan_type as PlanType) || "catalog";
    return sum + (planPrices[plan]?.monthly ?? 0);
  }, 0);

  const churned30 = tenants.filter((r) => {
    const end = new Date(r.subscription_end_date).getTime();
    return end > d30.getTime() && end <= nowMs;
  });
  const churnDenom = active.length + churned30.length;
  const churn30 = churnDenom > 0 ? churned30.length / churnDenom : 0;

  const paidConversion =
    tenants.length > 0 ? paidAny.size / tenants.length : null;
  const founders = tenants.filter((r) => r.is_founding_partner === true);
  const foundersPaidPct =
    founders.length > 0
      ? founders.filter((r) => paidAny.has(r.id)).length / founders.length
      : null;
  const ltvValues = [...paidSum.values()];
  const ltvAvg =
    ltvValues.length > 0
      ? ltvValues.reduce((a, b) => a + b, 0) / ltvValues.length
      : null;

  let viewsAll = 0;
  let clicksAll = 0;
  for (const r of tenants) {
    viewsAll += views30.get(r.id) ?? 0;
    clicksAll += clicks30.get(r.id) ?? 0;
  }
  const ctr30 = viewsAll > 0 ? clicksAll / viewsAll : null;

  const thisMonth = startOfMonth(now);
  const cohorts: CrmPayload["cohorts"] = [];
  for (let i = 5; i >= 0; i--) {
    const m = addMonths(thisMonth, -i);
    const next = addMonths(m, 1);
    const key = monthKey(m);
    const signed = tenants.filter((r) => {
      const c = new Date(r.created_at);
      return c >= m && c < next;
    });
    const inProgress = next > now;
    const checkpoint = inProgress ? now : next;
    const retained = signed.filter((r) => wasActiveAt(r, checkpoint)).length;
    cohorts.push({
      month: key,
      signedUp: signed.length,
      retained,
      rate: signed.length ? retained / signed.length : null,
      inProgress,
    });
  }
  const lastComplete = [...cohorts].reverse().find((c) => !c.inProgress);
  const retentionM1 = lastComplete?.rate ?? null;

  const rows: CrmTenantRow[] = tenants.map((r) => {
    const flags = onboardingFlags({
      logoUrl: r.logo_url,
      themeConfig: r.theme_config,
      dishCount: dishCount.get(r.id) ?? 0,
      phoneWhatsapp: r.phone_whatsapp,
      categoryCount: catCount.get(r.id) ?? 0,
    });
    const score = onboardingScoreFromFlags(flags);
    const v = views30.get(r.id) ?? 0;
    const c = clicks30.get(r.id) ?? 0;
    const photos = photoCount.get(r.id) ?? 0;
    const limit = photoDishLimit(r.plan_type);
    const createdMs = new Date(r.created_at).getTime();
    const lastAct = Math.max(lastOrder.get(r.id) ?? 0, lastCatalog.get(r.id) ?? 0);
    const inactive5d =
      Number.isFinite(createdMs) &&
      createdMs < new Date(d5).getTime() &&
      lastAct < new Date(d5).getTime();
    const end = new Date(r.subscription_end_date).getTime();
    const expiresIn7d = end > nowMs && end <= d7;
    const kind = score < 100 ? pickWaTemplateKind(flags) : null;
    const subOk = isSubscriptionActive(r);
    let health = 0;
    if (subOk) health += 35;
    const daysSinceOrder =
      lastOrder.get(r.id) != null
        ? (nowMs - (lastOrder.get(r.id) ?? 0)) / DAY_MS
        : 999;
    if (daysSinceOrder <= 7) health += 30;
    else if (daysSinceOrder <= 30) health += 15;
    if (!inactive5d) health += 20;
    if (limit > 0) health += Math.round(15 * Math.min(1, photos / limit));
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      plan_type: (r.plan_type as PlanType) || "catalog",
      is_active: r.is_active !== false,
      is_founding_partner: r.is_founding_partner === true,
      acquisition_source: r.acquisition_source ?? "",
      phone_whatsapp: r.phone_whatsapp ?? "",
      internal_notes: r.internal_notes ?? "",
      created_at: r.created_at,
      subscription_end_date: r.subscription_end_date,
      onboardingScore: score,
      onboardingFlags: flags,
      healthScore: Math.min(100, health),
      ctr: v > 0 ? c / v : null,
      ctrLabel: ctrLabelFor(v, c),
      views30: v,
      clicks30: c,
      ordersMonth: ordersMonthByTenant.get(r.id) ?? 0,
      photoCount: photos,
      photoLimit: limit,
      inactive5d,
      expiresIn7d,
      waTemplate: kind,
      waMessage: kind
        ? buildOnboardingWaMessage({
            kind,
            businessName: r.name,
            score,
          })
        : "",
    };
  });

  const trialCutoff = nowMs - 21 * DAY_MS;
  function onboardingEligible(row: CrmTenantRow): boolean {
    if (row.onboardingScore >= 100) return false;
    const created = new Date(row.created_at).getTime();
    const tenant = tenantById.get(row.id);
    const trialish = Boolean(
      tenant && !paidAny.has(row.id) && isSubscriptionActive(tenant),
    );
    return created >= trialCutoff || trialish;
  }

  const foundersQueue = rows
    .filter((r) => r.is_founding_partner && onboardingEligible(r))
    .sort((a, b) => a.onboardingScore - b.onboardingScore);
  const guidedQueue = rows
    .filter((r) => !r.is_founding_partner && onboardingEligible(r))
    .sort((a, b) => a.onboardingScore - b.onboardingScore);

  const risk = rows
    .filter(
      (r) =>
        r.healthScore < 50 ||
        r.ctrLabel === "visitas_sin_clic" ||
        r.inactive5d ||
        r.expiresIn7d,
    )
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 40);

  const byPlan = (["catalog", "daily", "pro"] as PlanType[]).map((plan) => ({
    plan,
    count: active.filter((r) => (r.plan_type || "catalog") === plan).length,
  }));
  const originKeys = ["", ...ACQUISITION_SOURCES];
  const byOrigin = originKeys.map((source) => ({
    source,
    count: tenants.filter((r) => (r.acquisition_source ?? "") === source).length,
  }));

  const photoFill =
    rows.length > 0
      ? rows.reduce(
          (s, r) => s + (r.photoLimit > 0 ? r.photoCount / r.photoLimit : 0),
          0,
        ) / rows.length
      : null;

  return {
    kpis: {
      active: active.length,
      foundersActive: active.filter((r) => r.is_founding_partner === true)
        .length,
      mrr,
      arr: mrr * 12,
      cashMonth,
      churn30,
      retentionM1,
      ctr30,
      paidConversion,
      foundersPaidPct,
      ltvAvg,
      ordersMonth,
      ordersPickup,
      ordersDelivery,
    },
    mix: {
      byPlan,
      founders: founders.length,
      byOrigin,
    },
    cohorts,
    foundersQueue,
    guidedQueue,
    risk,
    tenants: rows,
    usage: {
      topOrders: rows
        .slice()
        .sort((a, b) => b.ordersMonth - a.ordersMonth)
        .slice(0, 8)
        .map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          orders: r.ordersMonth,
        })),
      photoFillAvg: photoFill,
      proPct:
        active.length > 0
          ? active.filter((r) => r.plan_type === "pro").length / active.length
          : 0,
    },
  };
}
