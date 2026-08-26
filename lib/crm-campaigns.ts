import type { Customer } from "@/lib/types";
import { buildWaMeUrl } from "@/lib/whatsapp";
import { addCalendarDaysYmd, mexicoCityTodayYmd } from "@/lib/dates";

export type CampaignFilter = "all" | "inactive" | "birthday" | "risk" | "regulars";

export const CAMPAIGN_FILTER_LABELS: Record<CampaignFilter, string> = {
  all: "Todos",
  regulars: "Frecuentes",
  inactive: "Inactivos +30d",
  birthday: "Cumple (7d)",
  risk: "En riesgo",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function lastActivityAt(c: Customer): number | null {
  const visit = c.last_visit_at ? new Date(c.last_visit_at).getTime() : 0;
  const order = c.last_order_at ? new Date(c.last_order_at).getTime() : 0;
  const created = c.created_at ? new Date(c.created_at).getTime() : 0;
  const latest = Math.max(visit, order, created);
  return latest > 0 ? latest : null;
}

function daysSinceActivity(c: Customer, now = Date.now()): number | null {
  const at = lastActivityAt(c);
  if (at == null) return null;
  return Math.floor((now - at) / DAY_MS);
}

/** Birthday falls within the next `withinDays` days (incl. today), ignoring year. */
export function isBirthdayWithinDays(
  birthday: string | null | undefined,
  withinDays: number,
  now = new Date(),
): boolean {
  if (!birthday) return false;
  const mmdd = birthday.trim().slice(0, 10).slice(5);
  if (!/^\d{2}-\d{2}$/.test(mmdd)) return false;
  const today = mexicoCityTodayYmd(now);
  for (let i = 0; i <= withinDays; i++) {
    if (addCalendarDaysYmd(today, i).slice(5) === mmdd) return true;
  }
  return false;
}

export function isInactive30d(c: Customer, now = Date.now()): boolean {
  const days = daysSinceActivity(c, now);
  if (days == null) return true;
  return days >= 30;
}

/** Regulars (3+ visits or orders) who went silent 30+ days — churn risk. */
export function isAtRisk(c: Customer, now = Date.now()): boolean {
  const activity = (c.visit_count ?? 0) + (c.orders_count ?? 0);
  return activity >= 3 && isInactive30d(c, now);
}

export function isRegular(c: Customer): boolean {
  return (c.visit_count ?? 0) >= 3 || (c.orders_count ?? 0) >= 3;
}

export function filterCampaignCustomers(
  customers: Customer[],
  filter: CampaignFilter,
): Customer[] {
  const now = Date.now();
  switch (filter) {
    case "inactive":
      return customers.filter((c) => isInactive30d(c, now));
    case "regulars":
      return customers.filter((c) => isRegular(c));
    case "birthday":
      return customers.filter((c) =>
        isBirthdayWithinDays(c.birthday, 7, new Date(now)),
      );
    case "risk":
      return customers.filter((c) => isAtRisk(c, now));
    default:
      return customers;
  }
}

export function campaignCounts(customers: Customer[]) {
  const now = Date.now();
  const d = new Date(now);
  return {
    inactive: customers.filter((c) => isInactive30d(c, now)).length,
    birthday: customers.filter((c) => isBirthdayWithinDays(c.birthday, 7, d))
      .length,
    risk: customers.filter((c) => isAtRisk(c, now)).length,
    regulars: customers.filter((c) => isRegular(c)).length,
  };
}

export type CampaignTemplateKind = "reactivate" | "birthday" | "risk";

export function templateKindForFilter(
  filter: CampaignFilter,
): CampaignTemplateKind {
  if (filter === "birthday") return "birthday";
  if (filter === "risk") return "risk";
  return "reactivate";
}

export function buildCampaignMessage(params: {
  kind: CampaignTemplateKind;
  customerName: string;
  businessName: string;
  discountHint?: string;
}): string {
  const first = params.customerName.trim().split(/\s+/)[0] || "amigo/a";
  const biz = params.businessName;
  const offer =
    params.discountHint?.trim() ||
    "Presenta este mensaje y recibe 10% de descuento en tu próxima visita";

  if (params.kind === "birthday") {
    return [
      `🎂 ¡Feliz cumpleaños, ${first}!`,
      "",
      `En *${biz}* queremos celebrarte.`,
      offer.endsWith(".") ? offer : `${offer}.`,
      "",
      "¿Agendamos tu visita?",
    ].join("\n");
  }

  if (params.kind === "risk") {
    return [
      `¡Hola ${first}! Te extrañamos en *${biz}*.`,
      "",
      "Hace tiempo que no te vemos y tu lugar te está esperando.",
      offer.endsWith(".") ? offer : `${offer}.`,
      "",
      "¿Cuándo pasas?",
    ].join("\n");
  }

  return [
    `¡Hola ${first}! Te extrañamos en *${biz}*.`,
    "",
    offer.endsWith(".") ? offer : `${offer}.`,
    "",
    "¿Te vemos pronto?",
  ].join("\n");
}

export function openCampaignWhatsApp(phone: string, message: string) {
  const url = buildWaMeUrl(phone, message);
  window.open(url, "_blank", "noopener,noreferrer");
}
