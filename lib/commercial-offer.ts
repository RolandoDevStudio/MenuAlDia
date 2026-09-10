import type { PlanPricesMap, PlanType } from "./plans";

export type CommercialOfferKind = "none" | "founding" | "custom";
export type CommercialDuration = "lifetime" | "months";

export type FoundingPartnerPrices = Record<PlanType, number>;

export const FALLBACK_FOUNDING_PARTNER_PRICES: FoundingPartnerPrices = {
  catalog: 60,
  daily: 80,
  pro: 120,
};

export const FOUNDING_OFFER_LABEL = "Negocio Fundador";

/** Minimal restaurant shape for offer helpers (tenant or SA payloads). */
export type CommercialOfferRestaurant = {
  plan_type?: string | null;
  created_at?: string | null;
  subscription_end_date?: string | null;
  commercial_offer_kind?: string | null;
  commercial_offer_label?: string | null;
  commercial_free_months?: number | null;
  commercial_monthly_price?: number | null;
  commercial_duration?: string | null;
  commercial_duration_months?: number | null;
  commercial_starts_at?: string | null;
  commercial_ends_at?: string | null;
  is_founding_partner?: boolean | null;
};

export function parseFoundingPartnerPrices(raw: unknown): FoundingPartnerPrices {
  if (!raw || typeof raw !== "object") {
    return { ...FALLBACK_FOUNDING_PARTNER_PRICES };
  }
  const o = raw as Record<string, unknown>;
  return {
    catalog:
      Number(o.catalog) || FALLBACK_FOUNDING_PARTNER_PRICES.catalog,
    daily: Number(o.daily) || FALLBACK_FOUNDING_PARTNER_PRICES.daily,
    pro: Number(o.pro) || FALLBACK_FOUNDING_PARTNER_PRICES.pro,
  };
}

export async function getFoundingPartnerPrices(): Promise<FoundingPartnerPrices> {
  try {
    const { createPublicClient } = await import("./supabase/public");
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "founding_partner_prices")
      .maybeSingle();
    if (!data?.value) return { ...FALLBACK_FOUNDING_PARTNER_PRICES };
    return parseFoundingPartnerPrices(data.value);
  } catch {
    return { ...FALLBACK_FOUNDING_PARTNER_PRICES };
  }
}

export function normalizeOfferKind(
  raw: unknown,
): CommercialOfferKind {
  if (raw === "founding" || raw === "custom") return raw;
  return "none";
}

export function hasActiveCommercialOffer(
  restaurant: CommercialOfferRestaurant,
  now = new Date(),
): boolean {
  const kind = normalizeOfferKind(restaurant.commercial_offer_kind);
  if (kind === "none") return false;
  const price = Number(restaurant.commercial_monthly_price);
  if (!(price > 0)) return false;
  if (restaurant.commercial_duration === "months") {
    const ends = restaurant.commercial_ends_at;
    if (ends) {
      const endMs = new Date(`${ends}T23:59:59`).getTime();
      if (Number.isFinite(endMs) && endMs < now.getTime()) return false;
    }
  }
  return true;
}

export function resolveEffectiveMonthlyPrice(
  restaurant: CommercialOfferRestaurant,
  listPrices: PlanPricesMap,
  plan?: PlanType,
): number {
  const planType = (plan ||
    restaurant.plan_type ||
    "catalog") as PlanType;
  if (hasActiveCommercialOffer(restaurant)) {
    return Number(restaurant.commercial_monthly_price);
  }
  return listPrices[planType]?.monthly ?? 0;
}

/**
 * Courtesy = free months configured, still before subscription_end_date,
 * and no SPEI/payment recorded yet (caller passes hasPayments).
 */
export function isInCommercialCourtesyPeriod(
  restaurant: CommercialOfferRestaurant,
  hasPayments: boolean,
  now = new Date(),
): boolean {
  if (!hasActiveCommercialOffer(restaurant, now)) return false;
  const free = Number(restaurant.commercial_free_months) || 0;
  if (free <= 0) return false;
  if (hasPayments) return false;
  const end = restaurant.subscription_end_date;
  if (!end) return false;
  return new Date(end).getTime() > now.getTime();
}

export function addFreeMonthsToDate(
  from: Date,
  freeMonths: number,
): Date {
  const months = Math.max(0, Math.floor(freeMonths));
  if (months === 0) {
    return new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  return new Date(from.getTime() + months * 30 * 24 * 60 * 60 * 1000);
}

export function computeCommercialEndsAt(
  startsAt: Date,
  duration: CommercialDuration,
  durationMonths: number | null | undefined,
): string | null {
  if (duration !== "months") return null;
  const n = Math.max(1, Math.floor(Number(durationMonths) || 1));
  const end = new Date(startsAt);
  end.setUTCMonth(end.getUTCMonth() + n);
  return end.toISOString().slice(0, 10);
}

export type CommercialOfferPayload = {
  commercial_offer_kind: CommercialOfferKind;
  commercial_offer_label: string;
  commercial_free_months: number;
  commercial_monthly_price: number | null;
  commercial_duration: CommercialDuration;
  commercial_duration_months: number | null;
  commercial_starts_at: string | null;
  commercial_ends_at: string | null;
};

export function buildOfferFromPreset(input: {
  kind: CommercialOfferKind;
  planType: PlanType;
  foundingPrices: FoundingPartnerPrices;
  freeMonths?: number;
  monthlyPrice?: number | null;
  duration?: CommercialDuration;
  durationMonths?: number | null;
  label?: string;
  now?: Date;
}): CommercialOfferPayload {
  const now = input.now ?? new Date();
  if (input.kind === "none") {
    return {
      commercial_offer_kind: "none",
      commercial_offer_label: "",
      commercial_free_months: 0,
      commercial_monthly_price: null,
      commercial_duration: "lifetime",
      commercial_duration_months: null,
      commercial_starts_at: null,
      commercial_ends_at: null,
    };
  }

  const freeMonths =
    input.freeMonths ?? (input.kind === "founding" ? 1 : 0);
  const monthly =
    input.monthlyPrice != null && Number(input.monthlyPrice) > 0
      ? Number(input.monthlyPrice)
      : input.foundingPrices[input.planType];
  const duration = input.duration ?? "lifetime";
  const durationMonths =
    duration === "months" ? (input.durationMonths ?? 12) : null;
  const label =
    input.label?.trim() ||
    (input.kind === "founding" ? FOUNDING_OFFER_LABEL : "Promoción comercial");

  return {
    commercial_offer_kind: input.kind,
    commercial_offer_label: label,
    commercial_free_months: Math.max(0, Math.min(12, freeMonths)),
    commercial_monthly_price: monthly,
    commercial_duration: duration,
    commercial_duration_months: durationMonths,
    commercial_starts_at: now.toISOString(),
    commercial_ends_at: computeCommercialEndsAt(now, duration, durationMonths),
  };
}

export function formatOfferPreview(input: {
  freeMonths: number;
  monthlyPrice: number;
  duration: CommercialDuration;
  durationMonths?: number | null;
  planLabel: string;
  label: string;
}): string {
  const free =
    input.freeMonths > 0
      ? `Mes${input.freeMonths === 1 ? "" : "es"} ${input.freeMonths === 1 ? "1" : `1–${input.freeMonths}`} gratis`
      : "Sin mes gratis";
  const vig =
    input.duration === "lifetime"
      ? "congelado de por vida"
      : `${input.durationMonths ?? "?"} meses`;
  return `${input.label}: ${free} → luego $${input.monthlyPrice} MXN/mes (${input.planLabel}), ${vig}. Un mes intermedio a tarifa especial se ajusta al registrar el pago.`;
}
