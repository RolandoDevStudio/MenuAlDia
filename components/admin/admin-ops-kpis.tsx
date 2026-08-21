"use client";

import Link from "next/link";
import { PLAN_LABELS, type PlanType } from "@/lib/plans";
import { can } from "@/lib/plans";
import type { AdminOpsStats } from "@/lib/admin-ops-stats";
import { labelsFor } from "@/lib/business-labels";

function formatInt(n: number): string {
  return new Intl.NumberFormat("es-MX").format(n);
}

export function AdminOpsKpis({
  stats,
  businessType,
}: {
  stats: AdminOpsStats;
  businessType?: string | null;
}) {
  const labels = labelsFor(businessType);
  const planLabel =
    PLAN_LABELS[(stats.planType as PlanType) || "catalog"] ?? stats.planType;

  let planHint = "Sin fecha de renovación";
  if (stats.daysRemaining != null) {
    if (stats.daysRemaining < 0) planHint = "Vencido — revisa SPEI";
    else if (stats.daysRemaining === 0) planHint = "Vence hoy";
    else planHint = `${stats.daysRemaining} días para renovar`;
  }

  let dailyValue = "—";
  let dailyHint = "";
  if (!can(stats.planType, "daily_menu")) {
    dailyValue = "No incluido";
    dailyHint = "Mejora a Menú al Día";
  } else if (!stats.dailyMenuActive) {
    dailyValue = "Oculto";
    dailyHint = "Actívalo en Ajustes";
  } else if (stats.dailyMainCount === 0) {
    dailyValue = "Falta configurar";
    dailyHint = `Sin ${labels.dishes.toLowerCase()} hoy`;
  } else {
    dailyValue = "Publicado";
    dailyHint = `${stats.dailyMainCount} opciones`;
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-xl border border-black/5 bg-surface px-3 py-2.5">
        <p className="text-[11px] text-muted">{labels.dailyMenu}</p>
        <p className="mt-0.5 text-base font-semibold leading-tight">{dailyValue}</p>
        {dailyHint ? (
          <p className="mt-0.5 text-[10px] text-muted">{dailyHint}</p>
        ) : null}
      </div>

      <div className="rounded-xl border border-black/5 bg-surface px-3 py-2.5">
        <p className="text-[11px] text-muted">Visitas hoy</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums">
          {formatInt(stats.viewsToday)}
        </p>
        <p className="mt-0.5 text-[10px] text-muted">
          {formatInt(stats.viewsTotal)} visitas en total
        </p>
      </div>

      <div className="rounded-xl border border-black/5 bg-surface px-3 py-2.5">
        <p className="text-[11px] text-muted">Cupones activos</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums">
          {formatInt(stats.activeCoupons)}
        </p>
        <Link
          href="/admin/promociones"
          className="mt-0.5 text-[10px] font-medium text-brand"
        >
          Ver promociones
        </Link>
      </div>

      <div className="rounded-xl border border-black/5 bg-surface px-3 py-2.5">
        <p className="text-[11px] text-muted">Plan</p>
        <p className="mt-0.5 text-base font-semibold leading-tight">{planLabel}</p>
        <p className="mt-0.5 text-[10px] text-muted">{planHint}</p>
      </div>
    </div>
  );
}
