import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";
import { formatMxn } from "@/lib/money";
import { PLAN_LABELS } from "@/lib/plans";
import type { AuditLog, PlanType, TenantPayment } from "@/lib/types";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";
import { formatMexicoCityDateTime } from "@/lib/dates";

const METHOD_LABELS: Record<TenantPayment["method"], string> = {
  transfer: "Transferencia",
  cash: "Efectivo",
  card: "Tarjeta",
  other: "Otro",
};

export default async function HistoryPage() {
  const session = await requireTenantSession();

  const restaurantId = session.restaurant.id;
  const supabase = await createClient();

  const [{ data: auditRows }, { data: paymentRows }] = await Promise.all([
    supabase
      .from("audit_logs")
      .select(
        "id, restaurant_id, action, field_name, old_value, new_value, summary, actor_label, created_at",
      )
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("tenant_payments")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("paid_at", { ascending: false })
      .limit(50),
  ]);

  const logs = (auditRows ?? []) as AuditLog[];
  const payments = (paymentRows ?? []) as TenantPayment[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">
          <Emoji char={UI_EMOJI.history} />
          Historial
        </h1>
        <p className="text-sm text-muted">
          Cambios y pagos de suscripción (solo lectura).
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Cambios</h2>
        {logs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-muted">
            Aún no hay cambios registrados.
          </p>
        ) : (
          <ul className="space-y-2">
            {logs.map((log) => (
              <li
                key={log.id}
                className="rounded-xl border border-black/5 bg-surface px-3 py-3"
              >
                <div className="flex justify-between gap-2">
                  <p className="font-medium">
                    {log.summary || log.action || "Cambio"}
                  </p>
                  <p className="shrink-0 text-xs text-muted">
                    {formatMexicoCityDateTime(log.created_at)}
                  </p>
                </div>
                {log.actor_label ? (
                  <p className="mt-0.5 text-xs text-muted">{log.actor_label}</p>
                ) : null}
                {log.field_name ? (
                  <p className="mt-1 text-xs text-muted">
                    Campo: {log.field_name}
                    {log.old_value != null || log.new_value != null
                      ? ` · ${log.old_value ?? "—"} → ${log.new_value ?? "—"}`
                      : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Pagos de suscripción</h2>
        {payments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-muted">
            Aún no hay pagos registrados.
          </p>
        ) : (
          <ul className="space-y-2">
            {payments.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-black/5 bg-surface px-3 py-3"
              >
                <div className="flex justify-between gap-2">
                  <p className="font-medium">
                    {PLAN_LABELS[(p.plan_type as PlanType) || "catalog"] ??
                      p.plan_type}
                  </p>
                  <p className="text-sm font-semibold text-brand">
                    {formatMxn(Number(p.amount))}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {formatMexicoCityDateTime(p.paid_at)} ·{" "}
                  {METHOD_LABELS[p.method] ?? p.method} · {p.period_days} días
                  {p.coupon_code
                    ? ` · Campaña ${p.coupon_code}${
                        Number(p.discount_amount) > 0
                          ? ` (−${formatMxn(Number(p.discount_amount))})`
                          : ""
                      }`
                    : ""}
                </p>
                {p.reference ? (
                  <p className="mt-1 text-xs text-muted">Ref: {p.reference}</p>
                ) : null}
                {p.notes ? (
                  <p className="mt-1 text-xs text-muted">{p.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
