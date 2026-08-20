import type { Customer } from "@/lib/types";
import { buildWaMeUrl } from "@/lib/whatsapp";

export type CampaignFilter = "all" | "inactive" | "birthday" | "risk";

export const CAMPAIGN_FILTER_LABELS: Record<CampaignFilter, string> = {
  all: "Todos",
  inactive: "Inactivos +30d",
  birthday: "Cumple (7d)",
  risk: "En riesgo",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSinceVisit(c: Customer, now = Date.now()): number | null {
  if (!c.last_visit_at) {
    // Never visited: treat as inactive relative to created_at if present
    const created = c.created_at ? new Date(c.created_at).getTime() : null;
    if (created == null) return null;
    return Math.floor((now - created) / DAY_MS);
  }
  return Math.floor((now - new Date(c.last_visit_at).getTime()) / DAY_MS);
}

/** Birthday falls within the next `withinDays` days (incl. today), ignoring year. */
export function isBirthdayWithinDays(
  birthday: string | null | undefined,
  withinDays: number,
  now = new Date(),
): boolean {
  if (!birthday) return false;
  const b = new Date(birthday + "T12:00:00");
  const thisYear = new Date(
    now.getFullYear(),
    b.getMonth(),
    b.getDate(),
    12,
    0,
    0,
  );
  let next = thisYear;
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
  );
  if (next.getTime() < startOfToday.getTime()) {
    next = new Date(now.getFullYear() + 1, b.getMonth(), b.getDate(), 12, 0, 0);
  }
  const diff = Math.floor((next.getTime() - startOfToday.getTime()) / DAY_MS);
  return diff >= 0 && diff <= withinDays;
}

export function isInactive30d(c: Customer, now = Date.now()): boolean {
  const days = daysSinceVisit(c, now);
  if (days == null) return true; // no visit data → treat as inactive
  return days >= 30;
}

/** Regulars (3+ visits) who went silent 30+ days — churn risk. */
export function isAtRisk(c: Customer, now = Date.now()): boolean {
  return (c.visit_count ?? 0) >= 3 && isInactive30d(c, now);
}

export function filterCampaignCustomers(
  customers: Customer[],
  filter: CampaignFilter,
): Customer[] {
  const now = Date.now();
  switch (filter) {
    case "inactive":
      return customers.filter((c) => isInactive30d(c, now));
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
