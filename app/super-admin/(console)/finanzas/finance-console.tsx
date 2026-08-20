"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { formatMxn } from "@/lib/money";
import { PLAN_LABELS, type PlanType } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PaymentRow = {
  id: string;
  restaurant_id: string;
  amount: number;
  currency: string;
  paid_at: string;
  method: string;
  plan_type: string;
  period_days: number;
  reference: string;
  notes: string;
  receipt_url?: string | null;
  needs_invoice?: boolean;
  restaurants?: {
    name?: string;
    slug?: string;
    owner_name?: string;
  } | null;
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function FinanceConsole() {
  const [month, setMonth] = useState(currentMonth);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/super-admin/payments?month=${encodeURIComponent(month)}`,
      );
      const json = (await res.json()) as {
        payments?: PaymentRow[];
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "No se pudo cargar");
        setPayments([]);
        return;
      }
      setPayments(json.payments ?? []);
    } catch {
      setError("Error de red");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const total = payments.reduce((s, p) => s + Number(p.amount), 0);
    const needsInvoice = payments.filter((p) => p.needs_invoice);
    const invoiceAsk = needsInvoice.reduce(
      (s, p) => s + Number(p.amount),
      0,
    );
    return {
      total,
      count: payments.length,
      invoiceAsk,
      invoiceAskCount: needsInvoice.length,
      globalAmount: total - invoiceAsk,
    };
  }, [payments]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Finanzas</h1>
          <p className="text-sm text-muted">
            Pagos SPEI del mes y export para el contador.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="fin-month">Mes</Label>
            <Input
              id="fin-month"
              type="month"
              className="w-[160px]"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => void load()}
            disabled={loading}
          >
            Actualizar
          </Button>
          <Button asChild className="min-h-11">
            <a
              href={`/api/super-admin/finance-export?month=${encodeURIComponent(month)}`}
            >
              <Download className="h-4 w-4" />
              CSV contador
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-black/5 bg-surface p-3">
          <p className="text-xs text-muted">Ingresos del mes</p>
          <p className="text-xl font-semibold">{formatMxn(totals.total)}</p>
          <p className="text-xs text-muted">{totals.count} pagos</p>
        </div>
        <div className="rounded-xl border border-black/5 bg-surface p-3">
          <p className="text-xs text-muted">Piden factura</p>
          <p className="text-xl font-semibold">
            {formatMxn(totals.invoiceAsk)}
          </p>
          <p className="text-xs text-muted">
            {totals.invoiceAskCount} pagos (cola CFDI)
          </p>
        </div>
        <div className="rounded-xl border border-black/5 bg-surface p-3">
          <p className="text-xs text-muted">Para factura global</p>
          <p className="text-xl font-semibold">
            {formatMxn(totals.globalAmount)}
          </p>
          <p className="text-xs text-muted">RFC genérico XAXX010101000</p>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : payments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-muted">
          Sin pagos en {month}. Regístralos desde Tenants → Pagos.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/5">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surface text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Fecha</th>
                <th className="px-3 py-2 font-semibold">Negocio</th>
                <th className="px-3 py-2 font-semibold">Monto</th>
                <th className="px-3 py-2 font-semibold">Plan</th>
                <th className="px-3 py-2 font-semibold">SPEI</th>
                <th className="px-3 py-2 font-semibold">Factura</th>
                <th className="px-3 py-2 font-semibold">Comp.</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-black/5">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(p.paid_at).toLocaleDateString("es-MX")}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium">
                      {p.restaurants?.name ?? "—"}
                    </p>
                    <p className="text-xs text-muted">
                      /{p.restaurants?.slug}
                    </p>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatMxn(Number(p.amount))}
                  </td>
                  <td className="px-3 py-2">
                    {PLAN_LABELS[p.plan_type as PlanType] ?? p.plan_type}
                    <span className="text-xs text-muted">
                      {" "}
                      · {p.period_days}d
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {p.reference || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {p.needs_invoice ? (
                      <span className="font-semibold text-amber-700">
                        Pendiente
                      </span>
                    ) : (
                      <span className="text-muted">Global</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {p.receipt_url ? (
                      <a
                        href={p.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-brand"
                      >
                        Ver
                      </a>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted">
        Tip: registra cada SPEI desde{" "}
        <Link href="/super-admin/tenants" className="font-semibold text-brand">
          Tenants → Pagos
        </Link>{" "}
        con clave de rastreo. El CSV lista RFC genérico para montos sin factura
        individual (para tu contador).
      </p>
    </div>
  );
}
