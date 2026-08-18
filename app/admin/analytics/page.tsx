import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionRestaurant } from "@/lib/restaurant";
import { PlanGate } from "@/components/admin/plan-gate";
import { can } from "@/lib/plans";
import { formatMxn } from "@/lib/money";
import type { Order } from "@/lib/types";

export default async function AnalyticsPage() {
  const session = await getSessionRestaurant();
  if (!session) redirect("/admin/login");
  const plan = session.restaurant.plan_type || "catalog";
  if (!can(plan, "analytics")) {
    return (
      <PlanGate plan={plan} feature="analytics" title="Métricas (Pro)">
        {null}
      </PlanGate>
    );
  }

  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("restaurant_id", session.restaurant.id)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  const orders = (data ?? []) as Order[];
  const today = new Date().toDateString();
  const todayOrders = orders.filter(
    (o) => new Date(o.created_at).toDateString() === today,
  );
  const weekTotal = orders.reduce((s, o) => s + Number(o.total), 0);
  const avgTicket = orders.length ? weekTotal / orders.length : 0;

  const dishCount = new Map<string, number>();
  for (const o of orders) {
    for (const item of o.payload?.items ?? []) {
      dishCount.set(item.name, (dishCount.get(item.name) ?? 0) + item.quantity);
    }
  }
  const top = [...dishCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Métricas</h1>
        <p className="text-sm text-muted">Últimos 7 días.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-black/5 bg-surface p-4">
          <p className="text-xs text-muted">Pedidos hoy</p>
          <p className="mt-1 text-2xl font-semibold">{todayOrders.length}</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-surface p-4">
          <p className="text-xs text-muted">Pedidos (7d)</p>
          <p className="mt-1 text-2xl font-semibold">{orders.length}</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-surface p-4">
          <p className="text-xs text-muted">Ventas (7d)</p>
          <p className="mt-1 text-xl font-semibold">{formatMxn(weekTotal)}</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-surface p-4">
          <p className="text-xs text-muted">Ticket promedio</p>
          <p className="mt-1 text-xl font-semibold">{formatMxn(avgTicket)}</p>
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold">Top platillos</h2>
        {top.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Sin datos aún.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {top.map(([name, qty]) => (
              <li
                key={name}
                className="flex justify-between rounded-xl border border-black/5 bg-surface px-3 py-2 text-sm"
              >
                <span>{name}</span>
                <span className="font-semibold">{qty}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
