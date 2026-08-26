import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";
import { PlanGate } from "@/components/admin/plan-gate";
import { OpenMapsButton } from "@/components/admin/open-maps-button";
import { can } from "@/lib/plans";
import { formatMxn } from "@/lib/money";
import type { Order, OrderLogPayload } from "@/lib/types";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";

function customerName(p: OrderLogPayload) {
  return p.customer_name || p.customerName || "Cliente";
}

function mapsUrl(p: OrderLogPayload) {
  return (p.maps_url || p.mapsUrl || "").trim();
}

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
    .limit(50);

  const orders = (data ?? []) as Order[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            <Emoji char={UI_EMOJI.orders} />
            Pedidos
          </h1>
          <p className="text-sm text-muted">Últimos pedidos registrados.</p>
        </div>
          <a
          href="/api/admin/export?type=orders"
          className="text-sm font-semibold text-brand"
        >
          <Emoji char={UI_EMOJI.csv} />
          CSV
        </a>
      </div>
      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-muted">
          Aún no hay pedidos Pro.
        </p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => {
            const payload = o.payload ?? ({} as OrderLogPayload);
            const map = mapsUrl(payload);
            return (
              <li
                key={o.id}
                className="rounded-xl border border-black/5 bg-surface px-3 py-3"
              >
                <div className="flex justify-between gap-2">
                  <p className="font-medium">{customerName(payload)}</p>
                  <p className="text-sm font-semibold text-brand">
                    {formatMxn(Number(o.total))}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {new Date(o.created_at).toLocaleString("es-MX")} · {o.status}
                </p>
                {payload.address ? (
                  <p className="mt-1 text-xs text-muted">{payload.address}</p>
                ) : null}
                <p className="mt-1 line-clamp-2 text-xs text-muted">
                  {(payload.items ?? [])
                    .map((i) => `${i.quantity}x ${i.name}`)
                    .join(", ")}
                </p>
                {map ? (
                  <div className="mt-2">
                    <OpenMapsButton url={map} className="min-h-11" />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
