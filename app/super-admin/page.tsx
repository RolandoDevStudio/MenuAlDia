import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/super-admin";
import { getPlanPrices, type PlanType } from "@/lib/plans";
import { formatMxn } from "@/lib/money";
import type { Restaurant } from "@/lib/types";

export default async function SuperAdminHomePage() {
  await requireSuperAdmin();
  const supabase = await createClient();
  const [{ data }, planPrices] = await Promise.all([
    supabase.from("restaurants").select("*"),
    getPlanPrices(),
  ]);
  const restaurants = (data ?? []) as Restaurant[];

  const now = Date.now();
  const in7 = now + 7 * 24 * 60 * 60 * 1000;
  const active = restaurants.filter(
    (r) =>
      r.is_active !== false &&
      new Date(r.subscription_end_date).getTime() > now,
  );
  const mrr = active.reduce((sum, r) => {
    const plan = (r.plan_type as PlanType) || "catalog";
    return sum + (planPrices[plan]?.monthly ?? 0);
  }, 0);
  const expiring = restaurants.filter((r) => {
    const t = new Date(r.subscription_end_date).getTime();
    return t > now && t <= in7;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-black/5 bg-surface p-4">
          <p className="text-xs text-muted">Suscriptores activos</p>
          <p className="mt-1 text-3xl font-semibold">{active.length}</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-surface p-4">
          <p className="text-xs text-muted">MRR estimado</p>
          <p className="mt-1 text-2xl font-semibold">{formatMxn(mrr)}</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-surface p-4">
          <p className="text-xs text-muted">Total tenants</p>
          <p className="mt-1 text-3xl font-semibold">{restaurants.length}</p>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold">Vencen en 7 días</h2>
        {expiring.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nadie por vencer.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {expiring.map((r) => (
              <li
                key={r.id}
                className="flex justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
              >
                <span>
                  {r.name}{" "}
                  <span className="text-muted">/{r.slug}</span>
                </span>
                <span>
                  {new Date(r.subscription_end_date).toLocaleDateString("es-MX")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
