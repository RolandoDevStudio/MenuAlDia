export type PlanType = "catalog" | "daily" | "pro";

export type PlanFeature =
  | "catalog"
  | "photos"
  | "branding"
  | "whatsapp_checkout"
  | "theme"
  | "daily_menu"
  | "flyer"
  | "crm"
  | "analytics"
  | "csv_export";

export const PLAN_PRICES_MXN: Record<PlanType, number> = {
  catalog: 199,
  daily: 349,
  pro: 599,
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
  ],
  pro: [
    "catalog",
    "photos",
    "branding",
    "whatsapp_checkout",
    "theme",
    "daily_menu",
    "flyer",
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
  return monthly * 10; // ~2 months free
}

export function dailyValue(monthly: number): number {
  return Math.round((monthly / 30) * 10) / 10;
}
