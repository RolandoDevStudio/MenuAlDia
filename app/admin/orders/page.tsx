import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";
import { PlanGate } from "@/components/admin/plan-gate";
import { OrdersBoard } from "@/components/admin/orders-board";
import { can } from "@/lib/plans";
import type { Order } from "@/lib/types";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";

export default async function OrdersPage() {
  const session = await requireTenantSession();
  const plan = session.restaurant.plan_type || "catalog";
  if (!can(plan, "crm")) {
    return (
      <PlanGate plan={plan} feature="crm" title="Pedidos CRM (Pro)">
        {null}
      </PlanGate>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("restaurant_id", session.restaurant.id)
    .order("created_at", { ascending: false })
    .limit(80);

  const orders = (data ?? []) as Order[];
  const channelCrm = session.restaurant.orders_via_crm === true;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            <Emoji char={UI_EMOJI.orders} />
            Pedidos
          </h1>
          <p className="text-sm text-muted">
            {channelCrm
              ? "Los pedidos llegan aquí. Marca el estado conforme avanzan."
              : "Intenciones enviadas a WhatsApp. Confirma en el chat y marca el estado aquí."}
          </p>
        </div>
        <a
          href="/api/admin/export?type=orders"
          className="text-sm font-semibold text-brand"
        >
          <Emoji char={UI_EMOJI.csv} />
          CSV
        </a>
      </div>
      <OrdersBoard initialOrders={orders} channelCrm={channelCrm} />
    </div>
  );
}
