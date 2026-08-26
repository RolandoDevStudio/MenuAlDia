import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";
import { PlanGate } from "@/components/admin/plan-gate";
import { CustomersCrm } from "@/components/admin/customers-crm";
import { can } from "@/lib/plans";
import type { Customer } from "@/lib/types";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";

export default async function CustomersPage() {
  const session = await requireTenantSession();
  const plan = session.restaurant.plan_type || "catalog";
  if (!can(plan, "crm")) {
    return (
      <PlanGate
        plan={plan}
        feature="crm"
        title="Clientes y lealtad (Pro + CRM)"
      >
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          Haz que vuelvan: fichas visuales, visitas y recompensas por teléfono.
          Incluido en Pro + CRM.
        </p>
      </PlanGate>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("restaurant_id", session.restaurant.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const customers = (data ?? []) as Customer[];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">
              <Emoji char={UI_EMOJI.customers} />
              Clientes
            </h1>
            <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
              Pro
            </span>
          </div>
          <p className="text-sm text-muted">
            Fichas, lealtad y campañas de reactivación.
          </p>
        </div>
        <a
          href="/api/admin/export?type=customers"
          className="text-sm font-semibold text-brand"
        >
          <Emoji char={UI_EMOJI.csv} />
          CSV
        </a>
      </div>
      <CustomersCrm
        restaurantId={session.restaurant.id}
        restaurantName={session.restaurant.name}
        initialCustomers={customers}
        loyaltyGoal={Number(session.restaurant.loyalty_goal ?? 10)}
        loyaltyRewardLabel={
          session.restaurant.loyalty_reward_label || "Recompensa gratis"
        }
        businessType={session.restaurant.business_type}
      />
    </div>
  );
}
