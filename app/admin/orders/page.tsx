import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionRestaurant } from "@/lib/restaurant";
import { PlanGate } from "@/components/admin/plan-gate";
import { can } from "@/lib/plans";
import { formatMxn } from "@/lib/money";
import type { Order } from "@/lib/types";

export default async function OrdersPage() {
  const session = await getSessionRestaurant();
  if (!session) redirect("/admin/login");
  const plan = session.restaurant.plan_type || "catalog";
  if (!can(plan, "crm")) {
    return <PlanGate plan={plan} feature="crm" title="Pedidos CRM (Pro)" >{null}</PlanGate>;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("restaurant_id", session.restaurant.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const orders = (data ?? []) as Order[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Pedidos</h1>
          <p className="text-sm text-muted">Últimos pedidos registrados.</p>
        </div>
        <a
          href="/api/admin/export?type=orders"
          className="text-sm font-semibold text-brand"
        >
          CSV
        </a>
      </div>
      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-muted">
          Aún no hay pedidos Pro.
        </p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li
              key={o.id}
              className="rounded-xl border border-black/5 bg-surface px-3 py-3"
            >
              <div className="flex justify-between gap-2">
                <p className="font-medium">
                  {o.payload?.customer_name ?? "Cliente"}
                </p>
                <p className="text-sm font-semibold text-brand">
                  {formatMxn(Number(o.total))}
                </p>
              </div>
              <p className="mt-1 text-xs text-muted">
                {new Date(o.created_at).toLocaleString("es-MX")} · {o.status}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-muted">
                {(o.payload?.items ?? [])
                  .map((i) => `${i.quantity}x ${i.name}`)
                  .join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
