import { requireTenantSession } from "@/lib/admin-session";
import { PlanGate } from "@/components/admin/plan-gate";
import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";
import { can } from "@/lib/plans";

export default async function AnalyticsPage() {
  const session = await requireTenantSession();
  const plan = session.restaurant.plan_type || "catalog";
  if (!can(plan, "analytics")) {
    return (
      <PlanGate plan={plan} feature="analytics" title="Métricas (Pro)">
        {null}
      </PlanGate>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Métricas</h1>
        <p className="text-sm text-muted">
          Visitas, conversión y rendimiento del menú (zona horaria CDMX).
        </p>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}
