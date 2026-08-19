import { requireTenantSession } from "@/lib/admin-session";
import { can } from "@/lib/plans";
import { PlanGate } from "@/components/admin/plan-gate";
import { CombosManager } from "@/components/admin/combos-manager";

export default async function CombosPage() {
  const session = await requireTenantSession();

  const plan = session.restaurant.plan_type || "catalog";
  if (!can(plan, "combos")) {
    return (
      <PlanGate
        plan={plan}
        feature="combos"
        title="Combos Express no incluido"
      >
        {null}
      </PlanGate>
    );
  }

  return <CombosManager restaurant={session.restaurant} />;
}
