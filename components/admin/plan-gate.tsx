import Link from "next/link";
import type { PlanFeature, PlanType } from "@/lib/plans";
import { can, PLAN_LABELS } from "@/lib/plans";
import { Button } from "@/components/ui/button";

export function PlanGate({
  plan,
  feature,
  children,
  title = "No incluido en tu plan",
}: {
  plan: PlanType | string;
  feature: PlanFeature;
  children: React.ReactNode;
  title?: string;
}) {
  if (can(plan, feature)) return <>{children}</>;

  const next =
    feature === "crm" || feature === "analytics" || feature === "csv_export"
      ? "Pro + CRM"
      : "Menú al Día";

  return (
    <div className="rounded-2xl border border-dashed border-brand/30 bg-surface px-4 py-8 text-center">
      <p className="font-semibold text-brand-dark">{title}</p>
      <p className="mt-2 text-sm text-muted">
        Tu plan actual es <strong>{PLAN_LABELS[(plan as PlanType) || "catalog"]}</strong>.
        Esta función está en <strong>{next}</strong>.
      </p>
      <p className="mt-1 text-xs text-muted">
        Contacta a soporte para actualizar tu suscripción.
      </p>
      <Button asChild variant="secondary" className="mt-4">
        <Link href="/admin/settings">Ver ajustes</Link>
      </Button>
    </div>
  );
}
