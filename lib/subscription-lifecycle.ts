import type { PlanType } from "@/lib/plans";
import { PLAN_LABELS, isSubscriptionActive } from "@/lib/plans";
import { calendarDaysUntilMexicoCity } from "@/lib/dates";

/** Days after cancel/expiry when tenant may still export data. */
export const GRACE_DAYS = 30;
/** Days after cancel/expiry when purge may run (includes grace). */
export const PURGE_AFTER_DAYS = 60;

export type PlanRequestType = "cancel" | "change_plan";
export type PlanRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type PlanChangeRequest = {
  id: string;
  restaurant_id: string;
  requested_by: string | null;
  request_type: PlanRequestType;
  from_plan: string;
  to_plan: string | null;
  reason: string;
  status: PlanRequestStatus;
  acknowledged_consequences: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string;
  created_at: string;
  restaurants?: {
    name?: string;
    slug?: string;
    plan_type?: string;
  } | null;
};

export type LifecyclePhase =
  | "active"
  | "expired_grace"
  | "expired_pre_purge"
  | "purge_due"
  | "purged";

export function addDaysIso(from: Date | string, days: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function computeGraceWindow(from: Date = new Date()) {
  return {
    grace_ends_at: addDaysIso(from, GRACE_DAYS),
    purge_scheduled_at: addDaysIso(from, PURGE_AFTER_DAYS),
  };
}

export function getLifecyclePhase(restaurant: {
  is_active?: boolean;
  subscription_end_date?: string | null;
  grace_ends_at?: string | null;
  purge_scheduled_at?: string | null;
  purged_at?: string | null;
}): LifecyclePhase {
  if (restaurant.purged_at) return "purged";
  const now = Date.now();
  const purgeAt = restaurant.purge_scheduled_at
    ? new Date(restaurant.purge_scheduled_at).getTime()
    : null;
  if (purgeAt != null && purgeAt <= now) return "purge_due";

  const active = isSubscriptionActive(restaurant);
  if (active) return "active";

  const graceEnd = restaurant.grace_ends_at
    ? new Date(restaurant.grace_ends_at).getTime()
    : null;
  if (graceEnd != null && graceEnd > now) return "expired_grace";
  return "expired_pre_purge";
}

export function daysUntil(iso: string | null | undefined): number | null {
  return calendarDaysUntilMexicoCity(iso);
}

export function cancelConsequencesCopy(plan: PlanType | string): string[] {
  const label = PLAN_LABELS[(plan as PlanType) || "catalog"] ?? plan;
  return [
    `Tu plan actual (${label}) quedará cancelado tras la aprobación de soporte.`,
    "El menú público se ocultará de inmediato al aprobarse.",
    `Tendrás ${GRACE_DAYS} días de gracia para exportar clientes (CSV) y respaldar fotos.`,
    `Tras ${PURGE_AFTER_DAYS} días desde la cancelación, tu información y archivos en Storage podrán eliminarse de forma permanente.`,
    "Si renovas antes del borrado, se reactivará el acceso (si los datos aún no se purgaron).",
  ];
}

export function changePlanConsequencesCopy(
  from: PlanType | string,
  to: PlanType | string,
): string[] {
  const fromL = PLAN_LABELS[(from as PlanType) || "catalog"] ?? from;
  const toL = PLAN_LABELS[(to as PlanType) || "catalog"] ?? to;
  const lines = [
    `Solicitas pasar de ${fromL} a ${toL}. El cambio aplica cuando soporte lo apruebe.`,
    "No se borran catálogo ni pedidos al cambiar de plan.",
  ];
  if (from === "pro" && to !== "pro") {
    lines.push(
      "Perderás acceso a Clientes PRO, campañas y métricas avanzadas (los datos se conservan).",
      `Las fotos privadas CRM pueden programarse para limpieza tras ${GRACE_DAYS} días si no vuelves a Pro.`,
    );
  }
  if (to === "catalog" && (from === "daily" || from === "pro")) {
    lines.push(
      "Menú del día, flyer y combos dejarán de estar disponibles en el panel.",
    );
  }
  return lines;
}
