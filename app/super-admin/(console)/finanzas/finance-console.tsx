"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { formatMxn } from "@/lib/money";
import { PLAN_LABELS, type PlanType } from "@/lib/plans";
import {
  INVOICE_STATUS_LABELS,
  resolveInvoiceStatus,
  type InvoiceStatus,
} from "@/lib/finance-invoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";

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
  invoice_status?: InvoiceStatus | string | null;
  invoice_folio?: string;
  voided_at?: string | null;
  void_reason?: string;
  restaurants?: {
    id?: string;
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "all" | "pending" | "issued" | "global" | "cancelled" | "voided"
  >("all");

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

  const visible = useMemo(() => {
    return payments.filter((p) => {
      const voided = Boolean(p.voided_at);
      if (filter === "voided") return voided;
      if (voided) return false;
      if (filter === "all") return true;
      return resolveInvoiceStatus(p) === filter;
    });
  }, [payments, filter]);

  const totals = useMemo(() => {
    const active = payments.filter((p) => !p.voided_at);
    const total = active.reduce((s, p) => s + Number(p.amount), 0);
    const pending = active.filter(
      (p) => resolveInvoiceStatus(p) === "pending",
    );
    const issued = active.filter((p) => resolveInvoiceStatus(p) === "issued");
    const globalRows = active.filter(
      (p) => resolveInvoiceStatus(p) === "global",
    );
    const pendingAmount = pending.reduce((s, p) => s + Number(p.amount), 0);
    const globalAmount = globalRows.reduce((s, p) => s + Number(p.amount), 0);
    return {
      total,
      count: active.length,
      pendingAmount,
      pendingCount: pending.length,
      issuedCount: issued.length,
      globalAmount,
      voidedCount: payments.filter((p) => p.voided_at).length,
    };
  }, [payments]);

  async function patchPayment(
    id: string,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      const json = (await res.json()) as {
        payment?: PaymentRow;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "No se pudo actualizar");
        return false;
      }
      if (json.payment) {
        setPayments((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ...json.payment } : p)),
        );
      } else {
        await load();
      }
      return true;
    } catch {
      setError("Error de red");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function onInvoiceChange(p: PaymentRow, status: InvoiceStatus) {
    let folio = p.invoice_folio ?? "";
    if (status === "issued") {
      const typed = window.prompt(
        "Folio CFDI (opcional)",
        folio || "",
      );
      if (typed === null) return;
      folio = typed.trim();
    }
    await patchPayment(p.id, {
      action: "update_invoice",
      invoice_status: status,
      invoice_folio: folio,
    });
  }

  async function onClearReceipt(p: PaymentRow) {
    if (
      !window.confirm(
        "¿Quitar el comprobante de este pago? (no borra el registro de pago)",
      )
    ) {
      return;
    }
    await patchPayment(p.id, { action: "clear_receipt" });
  }

  async function onVoid(p: PaymentRow) {
    if (
      !window.confirm(
        `Anular pago de ${formatMxn(Number(p.amount))} a ${p.restaurants?.name ?? "este tenant"}?\n\nEsto lo saca de los totales del mes y queda en auditoría.\nNO revierte la fecha de vigencia del plan: ajústala en Editar tenant si hace falta.`,
      )
    ) {
      return;
    }
    const reason =
      window.prompt("Motivo de anulación (recomendado)") ?? "";
    if (reason === null) return;
    await patchPayment(p.id, {
      action: "void",
      void_reason: reason,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">
            <Emoji char={UI_EMOJI.finance} />
            Finanzas
          </h1>
          <p className="text-sm text-muted">
            Pagos SPEI del mes, cola CFDI y export para el contador.
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
          <div className="space-y-1">
            <Label htmlFor="fin-filter">Filtro</Label>
            <select
              id="fin-filter"
              className="flex h-11 rounded-lg border border-black/10 bg-background px-3 text-sm"
              value={filter}
              onChange={(e) =>
                setFilter(e.target.value as typeof filter)
              }
            >
              <option value="all">Activos</option>
              <option value="pending">Pendiente CFDI</option>
              <option value="issued">Emitidas</option>
              <option value="global">Global</option>
              <option value="cancelled">Canceladas</option>
              <option value="voided">Anulados</option>
            </select>
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

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div className="rounded-xl border border-black/5 bg-surface p-3">
          <p className="text-xs text-muted">Ingresos del mes</p>
          <p className="text-xl font-semibold">{formatMxn(totals.total)}</p>
          <p className="text-xs text-muted">
            {totals.count} pagos
            {totals.voidedCount
              ? ` · ${totals.voidedCount} anulados`
              : ""}
          </p>
        </div>
        <div className="rounded-xl border border-black/5 bg-surface p-3">
          <p className="text-xs text-muted">Pendiente CFDI</p>
          <p className="text-xl font-semibold">
            {formatMxn(totals.pendingAmount)}
          </p>
          <p className="text-xs text-muted">{totals.pendingCount} pagos</p>
        </div>
        <div className="rounded-xl border border-black/5 bg-surface p-3">
          <p className="text-xs text-muted">Para factura global</p>
          <p className="text-xl font-semibold">
            {formatMxn(totals.globalAmount)}
          </p>
          <p className="text-xs text-muted">RFC genérico XAXX010101000</p>
        </div>
        <div className="rounded-xl border border-black/5 bg-surface p-3">
          <p className="text-xs text-muted">CFDI emitidas</p>
          <p className="text-xl font-semibold">{totals.issuedCount}</p>
          <p className="text-xs text-muted">este mes (activas)</p>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-muted">
          Sin pagos en este filtro ({month}).
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/5">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-surface text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Fecha</th>
                <th className="px-3 py-2 font-semibold">Negocio</th>
                <th className="px-3 py-2 font-semibold">Monto</th>
                <th className="px-3 py-2 font-semibold">Plan</th>
                <th className="px-3 py-2 font-semibold">SPEI</th>
                <th className="px-3 py-2 font-semibold">Factura</th>
                <th className="px-3 py-2 font-semibold">Comp.</th>
                <th className="px-3 py-2 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const status = resolveInvoiceStatus(p);
                const voided = Boolean(p.voided_at);
                const rid = p.restaurants?.id ?? p.restaurant_id;
                return (
                  <tr
                    key={p.id}
                    className={`border-t border-black/5 ${voided ? "opacity-60" : ""}`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(p.paid_at).toLocaleDateString("es-MX")}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/super-admin/tenants?edit=${encodeURIComponent(rid)}`}
                        className="font-medium text-brand hover:underline"
                      >
                        {p.restaurants?.name ?? "—"}
                      </Link>
                      <p className="text-xs text-muted">
                        /{p.restaurants?.slug}
                      </p>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatMxn(Number(p.amount))}
                      {voided ? (
                        <span className="ml-1 text-[10px] font-semibold uppercase text-red-700">
                          anulado
                        </span>
                      ) : null}
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
                    <td className="px-3 py-2">
                      {voided ? (
                        <span className="text-xs text-muted">—</span>
                      ) : (
                        <select
                          className="h-9 max-w-[9rem] rounded-md border border-black/10 bg-background px-2 text-xs"
                          value={status}
                          disabled={busyId === p.id}
                          onChange={(e) =>
                            void onInvoiceChange(
                              p,
                              e.target.value as InvoiceStatus,
                            )
                          }
                        >
                          {(
                            Object.keys(
                              INVOICE_STATUS_LABELS,
                            ) as InvoiceStatus[]
                          ).map((k) => (
                            <option key={k} value={k}>
                              {INVOICE_STATUS_LABELS[k]}
                            </option>
                          ))}
                        </select>
                      )}
                      {p.invoice_folio && !voided ? (
                        <p className="mt-0.5 text-[10px] text-muted">
                          {p.invoice_folio}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {p.receipt_url ? (
                        <div className="flex flex-col gap-0.5">
                          <a
                            href={p.receipt_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-brand"
                          >
                            Ver
                          </a>
                          {!voided ? (
                            <button
                              type="button"
                              className="text-left text-[10px] text-muted hover:text-red-700"
                              disabled={busyId === p.id}
                              onClick={() => void onClearReceipt(p)}
                            >
                              Quitar
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {!voided ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
                          disabled={busyId === p.id}
                          onClick={() => void onVoid(p)}
                        >
                          Anular
                        </button>
                      ) : (
                        <span className="text-[10px] text-muted">
                          {p.void_reason || "Anulado"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted">
        Tip: registra cada SPEI desde{" "}
        <Link href="/super-admin/tenants" className="font-semibold text-brand">
          Tenants → Pagos
        </Link>
        . Anular un pago no acorta la vigencia; ajústala en el modal del
        tenant. El CSV excluye anulados y usa el estatus CFDI actual.
      </p>
    </div>
  );
}
