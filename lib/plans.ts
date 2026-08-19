import { createPublicClient } from "@/lib/supabase/public";

export type PlanType = "catalog" | "daily" | "pro";

export type PlanPriceRow = { monthly: number; annual: number };

export type PlanPricesMap = Record<PlanType, PlanPriceRow>;

export const FALLBACK_PLAN_PRICES: PlanPricesMap = {
  catalog: { monthly: 199, annual: 1990 },
  daily: { monthly: 349, annual: 3490 },
  pro: { monthly: 599, annual: 5990 },
};

export type PlanFeature =
  | "catalog"
  | "photos"
  | "branding"
  | "whatsapp_checkout"
  | "theme"
  | "daily_menu"
  | "flyer"
  | "combos"
  | "crm"
  | "analytics"
  | "csv_export";

export const PLAN_PRICES_MXN: Record<PlanType, number> = {
  catalog: FALLBACK_PLAN_PRICES.catalog.monthly,
  daily: FALLBACK_PLAN_PRICES.daily.monthly,
  pro: FALLBACK_PLAN_PRICES.pro.monthly,
};

export const PLAN_LABELS: Record<PlanType, string> = {
  catalog: "Catálogo Digital",
  daily: "Menú al Día",
  pro: "Pro + CRM",
};

const FEATURES: Record<PlanType, readonly PlanFeature[]> = {
  catalog: [
    "catalog",
    "photos",
    "branding",
    "whatsapp_checkout",
    "theme",
  ],
  daily: [
    "catalog",
    "photos",
    "branding",
    "whatsapp_checkout",
    "theme",
    "daily_menu",
    "flyer",
    "combos",
  ],
  pro: [
    "catalog",
    "photos",
    "branding",
    "whatsapp_checkout",
    "theme",
    "daily_menu",
    "flyer",
    "combos",
    "crm",
    "analytics",
    "csv_export",
  ],
};

export function can(
  plan: PlanType | string | null | undefined,
  feature: PlanFeature,
): boolean {
  const p = (plan ?? "catalog") as PlanType;
  const list = FEATURES[p] ?? FEATURES.catalog;
  return list.includes(feature);
}

/** Soft product cap for catalog plan only. */
export function dishLimit(plan: PlanType | string | null | undefined): number | null {
  return (plan ?? "catalog") === "catalog" ? 30 : null;
}

export function isSubscriptionActive(restaurant: {
  is_active?: boolean;
  subscription_end_date?: string | null;
}): boolean {
  if (restaurant.is_active === false) return false;
  if (!restaurant.subscription_end_date) return true;
  return new Date(restaurant.subscription_end_date).getTime() > Date.now();
}

export function annualPrice(monthly: number): number {
  return monthly * 10;
}

export function dailyValue(monthly: number): number {
  return Math.round((monthly / 30) * 10) / 10;
}

function parsePlanPrices(raw: unknown): PlanPricesMap {
  if (!raw || typeof raw !== "object") return { ...FALLBACK_PLAN_PRICES };
  const o = raw as Record<string, Partial<PlanPriceRow>>;
  const out = { ...FALLBACK_PLAN_PRICES };
  for (const key of ["catalog", "daily", "pro"] as PlanType[]) {
    const row = o[key];
    if (!row) continue;
    out[key] = {
      monthly: Number(row.monthly) || FALLBACK_PLAN_PRICES[key].monthly,
      annual: Number(row.annual) || FALLBACK_PLAN_PRICES[key].annual,
    };
  }
  return out;
}

/** Server helper: read dynamic prices from platform_settings (fallback constants). */
export async function getPlanPrices(): Promise<PlanPricesMap> {
  try {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "plan_prices")
      .maybeSingle();
    if (!data?.value) return { ...FALLBACK_PLAN_PRICES };
    return parsePlanPrices(data.value);
  } catch {
    return { ...FALLBACK_PLAN_PRICES };
  }
}

export function monthlyFromPrices(
  prices: PlanPricesMap,
  plan: PlanType,
): number {
  return prices[plan]?.monthly ?? PLAN_PRICES_MXN[plan];
}
