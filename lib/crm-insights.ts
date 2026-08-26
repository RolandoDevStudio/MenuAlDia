import type { CrmPayload } from "@/lib/super-admin-crm";

export type ActionFilterKey =
  | "founders_onboarding"
  | "guided_onboarding"
  | "sin_visitas"
  | "visitas_sin_clic"
  | "inactive_5d"
  | "expires_7d";

export type CrmInsight = {
  id: string;
  title: string;
  body: string;
  filterKey: ActionFilterKey;
  chip: string;
  count: number;
  extraHref?: { href: string; label: string };
};

const ACTION_CHIPS: Record<ActionFilterKey, string> = {
  founders_onboarding: "Fundadores incompletos",
  guided_onboarding: "Onboarding guiado",
  sin_visitas: "Sin visitas al menú",
  visitas_sin_clic: "Visitas sin clic a WA",
  inactive_5d: "Inactivos 5 días",
  expires_7d: "Vencen en 7 días",
};

export function actionFilterLabel(key: ActionFilterKey | null): string {
  if (!key) return "";
  return ACTION_CHIPS[key];
}

export function buildCrmInsights(data: CrmPayload): CrmInsight[] {
  const out: CrmInsight[] = [];
  const tenants = data.tenants ?? [];
  const sinVisitas = tenants.filter((t) => t.ctrLabel === "sin_visitas").length;
  const sinClic = tenants.filter((t) => t.ctrLabel === "visitas_sin_clic").length;
  const inactive = tenants.filter((t) => t.inactive5d).length;
  const expiring = tenants.filter((t) => t.expiresIn7d).length;
  const nFounders = data.foundersQueue.length;
  const nGuided = data.guidedQueue.length;
  const k = data.kpis;

  if (nFounders > 0) {
    out.push({
      id: "founders",
      title: `${nFounders} socio${nFounders === 1 ? "" : "s"} fundador${nFounders === 1 ? "" : "es"} incompleto${nFounders === 1 ? "" : "s"}`,
      body: "Hazlo tú: entra en modo Soporte y termina el menú. No les mandes el video genérico.",
      filterKey: "founders_onboarding",
      chip: ACTION_CHIPS.founders_onboarding,
      count: nFounders,
    });
  }
  if (nGuided > 0) {
    out.push({
      id: "guided",
      title: `${nGuided} negocio${nGuided === 1 ? "" : "s"} para guiar por WhatsApp`,
      body: "Onboarding a medias. Un mensaje corto basta; si no hay número, copia el texto.",
      filterKey: "guided_onboarding",
      chip: ACTION_CHIPS.guided_onboarding,
      count: nGuided,
    });
  }
  if (sinVisitas > 0 && (k.ctr30 == null || k.ctr30 === 0 || sinVisitas >= sinClic)) {
    out.push({
      id: "no-views",
      title: `${sinVisitas} menú${sinVisitas === 1 ? "" : "s"} sin visitas`,
      body: "El cuello es difusión: no están compartiendo el link. No es un problema de fotos todavía.",
      filterKey: "sin_visitas",
      chip: ACTION_CHIPS.sin_visitas,
      count: sinVisitas,
    });
  }
  if (sinClic > 0) {
    out.push({
      id: "no-click",
      title: `${sinClic} con visitas y sin clic a WhatsApp`,
      body: "Sí entran y no piden. Revisa fotos, precios o el botón. Soporte si es fundador.",
      filterKey: "visitas_sin_clic",
      chip: ACTION_CHIPS.visitas_sin_clic,
      count: sinClic,
    });
  }
  if (k.retentionM1 != null && k.retentionM1 < 0.6 && expiring > 0) {
    out.push({
      id: "retention",
      title: "Se caen al mes 1",
      body: "La última cohorte cerrada retuvo menos del 60%. Habla antes de que venza la prueba.",
      filterKey: "expires_7d",
      chip: ACTION_CHIPS.expires_7d,
      count: expiring,
    });
  }
  if (k.churn30 >= 0.15 && k.active > 0 && expiring > 0) {
    out.push({
      id: "churn",
      title: "Churn reciente alto",
      body: "Hay salidas en los últimos 30 días. Prioriza a quienes vencen esta semana.",
      filterKey: "expires_7d",
      chip: ACTION_CHIPS.expires_7d,
      count: expiring,
    });
  }
  if (k.mrr > 0 && k.cashMonth < k.mrr * 0.5) {
    out.push({
      id: "cash",
      title: "Caja muy por debajo del MRR",
      body: "La lista de activos no se está cobrando al mismo ritmo. Revisa Finanzas y vencimientos.",
      filterKey: "expires_7d",
      chip: ACTION_CHIPS.expires_7d,
      count: expiring,
      extraHref: { href: "/super-admin/finanzas", label: "Finanzas" },
    });
  }
  if (inactive > 0) {
    out.push({
      id: "inactive",
      title: `${inactive} sin uso en 5 días`,
      body: "No hubo pedidos ni cambios de catálogo. Un WhatsApp o Soporte evita que vuelvan al PDF.",
      filterKey: "inactive_5d",
      chip: ACTION_CHIPS.inactive_5d,
      count: inactive,
    });
  }

  const seen = new Set<ActionFilterKey>();
  const unique: CrmInsight[] = [];
  for (const item of out) {
    if (seen.has(item.filterKey)) continue;
    seen.add(item.filterKey);
    unique.push(item);
    if (unique.length >= 4) break;
  }
  return unique;
}
