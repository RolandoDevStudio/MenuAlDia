import Link from "next/link";
import { ImageIcon, Users } from "lucide-react";
import type { AdminImpactStats } from "@/lib/admin-impact";
import { can, type PlanType } from "@/lib/plans";

type Props = {
  stats: AdminImpactStats;
  plan: PlanType | string | null | undefined;
};

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-black/5 bg-background/60 px-3 py-2.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function ImpactCard({ stats, plan }: Props) {
  const planType = (plan ?? "catalog") as PlanType;
  const hasFlyer = can(planType, "flyer");
  const hasCrm = can(planType, "crm");

  return (
    <section className="rounded-2xl border border-black/5 bg-surface p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Impacto de este mes</h2>
        <p className="text-xs capitalize text-muted">{stats.monthLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric
          label="Flyers exportados"
          value={hasFlyer ? String(stats.flyerActions) : "—"}
          hint={
            hasFlyer
              ? "Descargas, shares y copias"
              : "Incluido desde Menú al Día"
          }
        />
        <Metric
          label="Clientes con actividad"
          value={
            hasCrm && stats.loyaltyCustomers != null
              ? String(stats.loyaltyCustomers)
              : "—"
          }
          hint={
            hasCrm && stats.totalCustomers != null
              ? `${stats.totalCustomers} en tu CRM`
              : "Incluido en Pro + CRM"
          }
        />
        <Metric
          label="Vistas al menú"
          value="—"
          hint="Próximamente"
        />
        <Metric
          label="Clics a WhatsApp"
          value="—"
          hint="Próximamente"
        />
      </div>

      {(hasFlyer || hasCrm) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {hasFlyer ? (
            <Link
              href="/admin/flyer"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-black/10 bg-surface px-2.5 text-xs font-semibold text-foreground hover:bg-white"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Flyer
            </Link>
          ) : null}
          {hasCrm ? (
            <Link
              href="/admin/customers"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-black/10 bg-surface px-2.5 text-xs font-semibold text-foreground hover:bg-white"
            >
              <Users className="h-3.5 w-3.5" />
              Clientes
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
