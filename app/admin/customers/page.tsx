import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionRestaurant } from "@/lib/restaurant";
import { PlanGate } from "@/components/admin/plan-gate";
import { can } from "@/lib/plans";
import type { Customer } from "@/lib/types";

export default async function CustomersPage() {
  const session = await getSessionRestaurant();
  if (!session) redirect("/admin/login");
  const plan = session.restaurant.plan_type || "catalog";
  if (!can(plan, "crm")) {
    return (
      <PlanGate plan={plan} feature="crm" title="Clientes CRM (Pro)">
        {null}
      </PlanGate>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("restaurant_id", session.restaurant.id)
    .order("last_order_at", { ascending: false })
    .limit(100);

  const customers = (data ?? []) as Customer[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Clientes</h1>
          <p className="text-sm text-muted">Historial de compradores.</p>
        </div>
        <a
          href="/api/admin/export?type=customers"
          className="text-sm font-semibold text-brand"
        >
          CSV
        </a>
      </div>
      {customers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-muted">
          Todavía no hay clientes registrados.
        </p>
      ) : (
        <ul className="space-y-2">
          {customers.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-black/5 bg-surface px-3 py-3"
            >
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted">
                {c.phone || "Sin teléfono"} · {c.orders_count} pedido
                {c.orders_count === 1 ? "" : "s"}
              </p>
              {c.address ? (
                <p className="mt-1 line-clamp-1 text-xs text-muted">{c.address}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
