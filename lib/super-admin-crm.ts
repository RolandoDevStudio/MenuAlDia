import { parseThemeConfig } from "@/lib/theme";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp";
import type { PlanType } from "@/lib/plans";

export const ACQUISITION_SOURCES = [
  "landing",
  "dur_local",
  "redes",
  "boca_a_boca",
  "otro",
] as const;

export type AcquisitionSource = (typeof ACQUISITION_SOURCES)[number];

export const ACQUISITION_LABELS: Record<AcquisitionSource | "", string> = {
  "": "Sin origen",
  landing: "Landing",
  dur_local: "Durango local",
  redes: "Redes",
  boca_a_boca: "Boca a boca",
  otro: "Otro",
};

export type OnboardingFlags = {
  hasLogoOrBanner: boolean;
  hasEnoughDishes: boolean;
  hasWhatsApp: boolean;
  hasCategory: boolean;
};

export type WaTemplateKind = "no_whatsapp" | "no_photos" | "incomplete";

export type CtrLabel = "sin_visitas" | "visitas_sin_clic" | "convierte";

export type CrmTenantRow = {
  id: string;
  name: string;
  slug: string;
  plan_type: PlanType;
  is_active: boolean;
  is_founding_partner: boolean;
  acquisition_source: string;
  phone_whatsapp: string;
  internal_notes: string;
  created_at: string;
  subscription_end_date: string;
  onboardingScore: number;
  onboardingFlags: OnboardingFlags;
  healthScore: number;
  ctr: number | null;
  ctrLabel: CtrLabel;
  views30: number;
  clicks30: number;
  ordersMonth: number;
  photoCount: number;
  photoLimit: number;
  inactive5d: boolean;
  expiresIn7d: boolean;
  waTemplate: WaTemplateKind | null;
  waMessage: string;
};

export type CrmPayload = {
  kpis: {
    active: number;
    foundersActive: number;
    mrr: number;
    arr: number;
    cashMonth: number;
    churn30: number;
    retentionM1: number | null;
    ctr30: number | null;
    paidConversion: number | null;
    foundersPaidPct: number | null;
    ltvAvg: number | null;
    ordersMonth: number;
    ordersPickup: number;
    ordersDelivery: number;
    ordersDineIn: number;
  };
  mix: {
    byPlan: { plan: PlanType; count: number }[];
    founders: number;
    byOrigin: { source: string; count: number }[];
  };
  cohorts: {
    month: string;
    signedUp: number;
    retained: number;
    rate: number | null;
    inProgress: boolean;
  }[];
  foundersQueue: CrmTenantRow[];
  guidedQueue: CrmTenantRow[];
  risk: CrmTenantRow[];
  /** All non-demo tenants — charts + action list filters */
  tenants: CrmTenantRow[];
  usage: {
    topOrders: { id: string; name: string; slug: string; orders: number }[];
    photoFillAvg: number | null;
    proPct: number;
  };
};

export function onboardingFlags(params: {
  logoUrl?: string | null;
  themeConfig?: unknown;
  dishCount: number;
  phoneWhatsapp?: string | null;
  categoryCount: number;
}): OnboardingFlags {
  const theme = parseThemeConfig(params.themeConfig);
  const banner = (theme.bannerUrl ?? "").trim();
  return {
    hasLogoOrBanner: Boolean((params.logoUrl ?? "").trim() || banner),
    hasEnoughDishes: params.dishCount > 5,
    hasWhatsApp: normalizeWhatsAppPhone(params.phoneWhatsapp ?? "").length >= 10,
    hasCategory: params.categoryCount >= 1,
  };
}

export function onboardingScoreFromFlags(flags: OnboardingFlags): number {
  return (
    (flags.hasLogoOrBanner ? 25 : 0) +
    (flags.hasEnoughDishes ? 25 : 0) +
    (flags.hasWhatsApp ? 25 : 0) +
    (flags.hasCategory ? 25 : 0)
  );
}

export function missingOnboardingSteps(flags: OnboardingFlags): number {
  return (
    (flags.hasLogoOrBanner ? 0 : 1) +
    (flags.hasEnoughDishes ? 0 : 1) +
    (flags.hasWhatsApp ? 0 : 1) +
    (flags.hasCategory ? 0 : 1)
  );
}

export function pickWaTemplateKind(flags: OnboardingFlags): WaTemplateKind {
  if (!flags.hasWhatsApp) return "no_whatsapp";
  if (!flags.hasLogoOrBanner) return "no_photos";
  return "incomplete";
}

export function buildOnboardingWaMessage(params: {
  kind: WaTemplateKind;
  businessName: string;
  score: number;
}): string {
  const nombre = params.businessName.trim() || "tu negocio";
  if (params.kind === "no_whatsapp") {
    return `Hola, te escribe Menú al Día. Vi el menú de ${nombre} y para que te lleguen los pedidos falta configurar tu número de WhatsApp en Ajustes. ¿Lo vemos juntos en 2 minutos?`;
  }
  if (params.kind === "no_photos") {
    return `Hola, te escribe Menú al Día. El menú de ${nombre} aún no tiene logo ni portada. ¿Te mando un video de 1 minuto para subirlas?`;
  }
  return `Hola, te escribe Menú al Día. Vi que ${nombre} va al ${params.score}% en el menú. ¿Te ayudo a terminar lo que falta?`;
}

export function ctrLabelFor(views: number, clicks: number): CtrLabel {
  if (views <= 0) return "sin_visitas";
  if (clicks <= 0) return "visitas_sin_clic";
  return "convierte";
}
