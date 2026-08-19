"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AuditLog,
  BusinessType,
  Restaurant,
  TenantPayment,
} from "@/lib/types";
import type { PlanType } from "@/lib/plans";
import { PLAN_LABELS, PLAN_PRICES_MXN } from "@/lib/plans";
import {
  BUSINESS_TYPE_LABELS,
  BUSINESS_TYPES,
} from "@/lib/business-labels";
import { formatMxn } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Tab = "datos" | "pagos" | "cambios";

type Props = {
  restaurant: Restaurant | null;
  ownerEmail: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (restaurant?: Restaurant) => void;
};

const selectClass =
  "h-11 w-full rounded-lg border border-black/10 bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand";

export function TenantEditModal({
  restaurant,
  ownerEmail,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [tab, setTab] = useState<Tab>("datos");
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [slug, setSlug] = useState("");
  const [phone, setPhone] = useState("");
  const [planType, setPlanType] = useState<PlanType>("catalog");
  const [businessType, setBusinessType] =
    useState<BusinessType>("restaurante");
  const [isActive, setIsActive] = useState(true);
  const [endDate, setEndDate] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [payments, setPayments] = useState<TenantPayment[]>([]);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [method, setMethod] = useState("transfer");
  const [payPlan, setPayPlan] = useState<PlanType>("catalog");
  const [periodDays, setPeriodDays] = useState("30");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [payBusy, setPayBusy] = useState(false);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurant || !open) return;
    setTab("datos");
    setName(restaurant.name);
    setOwnerName(restaurant.owner_name ?? "");
    setSlug(restaurant.slug);
    setPhone(restaurant.phone_whatsapp ?? "");
    setPlanType((restaurant.plan_type || "catalog") as PlanType);
    setBusinessType(
      (restaurant.business_type || "restaurante") as BusinessType,
    );
    setIsActive(restaurant.is_active !== false);
    setEndDate(restaurant.subscription_end_date?.slice(0, 10) ?? "");
    setEmail(ownerEmail ?? "");
    setPassword("");
    setError(null);
    setMessage(null);
    setAmount(String(PLAN_PRICES_MXN[(restaurant.plan_type || "catalog") as PlanType] ?? ""));
    setPaidAt(new Date().toISOString().slice(0, 10));
    setMethod("transfer");
    setPayPlan((restaurant.plan_type || "catalog") as PlanType);
    setPeriodDays("30");
    setReference("");
    setNotes("");
  }, [restaurant, ownerEmail, open]);

  const loadPayments = useCallback(async () => {
    if (!restaurant) return;
    setPaymentsError(null);
    const res = await fetch(
      `/api/super-admin/payments?restaurant_id=${restaurant.id}`,
    );
    const json = (await res.json()) as {
      payments?: TenantPayment[];
      error?: string;
    };
    if (!res.ok) {
      setPaymentsError(json.error ?? "No se pudieron cargar pagos");
      return;
    }
    setPayments(json.payments ?? []);
  }, [restaurant]);

  const loadAudit = useCallback(async () => {
    if (!restaurant) return;
    setLogsError(null);
    const res = await fetch(
      `/api/super-admin/audit?restaurant_id=${restaurant.id}`,
    );
    const json = (await res.json()) as { logs?: AuditLog[]; error?: string };
    if (!res.ok) {
      setLogsError(json.error ?? "No se pudo cargar el historial");
      return;
    }
    setLogs(json.logs ?? []);
  }, [restaurant]);

  useEffect(() => {
    if (!open || !restaurant) return;
    if (tab === "pagos") void loadPayments();
    if (tab === "cambios") void loadAudit();
  }, [open, restaurant, tab, loadPayments, loadAudit]);

  async function saveDatos() {
    if (!restaurant) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const body: Record<string, unknown> = {
      id: restaurant.id,
      name,
      owner_name: ownerName,
      slug,
      phone_whatsapp: phone,
      plan_type: planType,
      business_type: businessType,
      is_active: isActive,
      subscription_end_date: endDate
        ? new Date(endDate + "T23:59:59").toISOString()
        : null,
      owner_email: email || undefined,
    };
    if (password.trim()) body.owner_password = password.trim();

    const res = await fetch("/api/super-admin/tenants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      error?: string;
      restaurant?: Restaurant;
    };
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "No se pudo guardar");
      return;
    }
    setPassword("");
    setMessage("Guardado");
    onSaved(json.restaurant);
  }

  async function registerPayment() {
    if (!restaurant) return;
    setPayBusy(true);
    setPaymentsError(null);
    const res = await fetch("/api/super-admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurant_id: restaurant.id,
        amount: Number(amount),
        paid_at: paidAt
          ? new Date(paidAt + "T12:00:00").toISOString()
          : undefined,
        method,
        plan_type: payPlan,
        period_days: Number(periodDays) || 30,
        reference,
        notes,
      }),
    });
    const json = (await res.json()) as {
      error?: string;
      restaurant?: Restaurant;
    };
    setPayBusy(false);
    if (!res.ok) {
      setPaymentsError(json.error ?? "No se pudo registrar el pago");
      return;
    }
    setReference("");
    setNotes("");
    await loadPayments();
    onSaved(json.restaurant);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "datos", label: "Datos" },
    { id: "pagos", label: "Pagos" },
    { id: "cambios", label: "Cambios" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {restaurant ? restaurant.name : "Editar tenant"}
          </DialogTitle>
          <DialogDescription>
            {restaurant ? `/${restaurant.slug}` : "Actualiza datos del negocio"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 border-b border-black/10 pb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "bg-brand text-white"
                  : "text-muted hover:bg-black/5 hover:text-brand"
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "datos" ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Dueño</Label>
                <Input
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Cambiar el slug invalida QR y enlaces públicos anteriores
                (`/{restaurant?.slug}`).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="52155…"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <select
                  className={selectClass}
                  value={planType}
                  onChange={(e) => setPlanType(e.target.value as PlanType)}
                >
                  {(Object.keys(PLAN_LABELS) as PlanType[]).map((p) => (
                    <option key={p} value={p}>
                      {PLAN_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Giro</Label>
                <select
                  className={selectClass}
                  value={businessType}
                  onChange={(e) =>
                    setBusinessType(e.target.value as BusinessType)
                  }
                >
                  {BUSINESS_TYPES.map((bt) => (
                    <option key={bt} value={bt}>
                      {BUSINESS_TYPE_LABELS[bt]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-black/5 bg-background/50 px-3 py-2">
              <Label>Activo</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="space-y-1.5">
              <Label>Vence</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Email de login</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nueva contraseña</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Dejar vacío para no cambiar"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {message ? (
              <p className="text-sm text-accent">{message}</p>
            ) : null}

            <Button
              type="button"
              className="w-full"
              disabled={busy}
              onClick={() => void saveDatos()}
            >
              {busy ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        ) : null}

        {tab === "pagos" ? (
          <div className="space-y-4">
            <div className="max-h-48 overflow-auto rounded-xl border border-black/5">
              {payments.length === 0 ? (
                <p className="p-3 text-sm text-muted">Sin pagos registrados.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-surface text-muted">
                    <tr>
                      <th className="px-2 py-2 font-semibold">Fecha</th>
                      <th className="px-2 py-2 font-semibold">Monto</th>
                      <th className="px-2 py-2 font-semibold">Método</th>
                      <th className="px-2 py-2 font-semibold">Plan</th>
                      <th className="px-2 py-2 font-semibold">Días</th>
                      <th className="px-2 py-2 font-semibold">Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-t border-black/5">
                        <td className="px-2 py-2">
                          {new Date(p.paid_at).toLocaleDateString("es-MX")}
                        </td>
                        <td className="px-2 py-2">{formatMxn(p.amount)}</td>
                        <td className="px-2 py-2">{p.method}</td>
                        <td className="px-2 py-2">
                          {PLAN_LABELS[p.plan_type] ?? p.plan_type}
                        </td>
                        <td className="px-2 py-2">{p.period_days}</td>
                        <td className="px-2 py-2">{p.reference || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-black/10 p-3">
              <p className="text-sm font-semibold">Registrar Pago</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Monto</Label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha de pago</Label>
                  <Input
                    type="date"
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Método</Label>
                  <select
                    className={selectClass}
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    <option value="transfer">Transferencia</option>
                    <option value="cash">Efectivo</option>
                    <option value="card">Tarjeta</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Plan</Label>
                  <select
                    className={selectClass}
                    value={payPlan}
                    onChange={(e) => setPayPlan(e.target.value as PlanType)}
                  >
                    {(Object.keys(PLAN_LABELS) as PlanType[]).map((p) => (
                      <option key={p} value={p}>
                        {PLAN_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Días de periodo</Label>
                  <Input
                    type="number"
                    value={periodDays}
                    onChange={(e) => setPeriodDays(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Referencia</Label>
                  <Input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notas</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              {paymentsError ? (
                <p className="text-sm text-red-600">{paymentsError}</p>
              ) : null}
              <Button
                type="button"
                className="w-full"
                disabled={payBusy || !amount}
                onClick={() => void registerPayment()}
              >
                {payBusy ? "Registrando…" : "Registrar pago"}
              </Button>
            </div>
          </div>
        ) : null}

        {tab === "cambios" ? (
          <div className="space-y-2">
            {logsError ? (
              <p className="text-sm text-red-600">{logsError}</p>
            ) : null}
            <div className="max-h-80 overflow-auto rounded-xl border border-black/5">
              {logs.length === 0 ? (
                <p className="p-3 text-sm text-muted">Sin cambios registrados.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-surface text-muted">
                    <tr>
                      <th className="px-2 py-2 font-semibold">Campo</th>
                      <th className="px-2 py-2 font-semibold">Antes</th>
                      <th className="px-2 py-2 font-semibold">Después</th>
                      <th className="px-2 py-2 font-semibold">Actor</th>
                      <th className="px-2 py-2 font-semibold">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-t border-black/5">
                        <td className="px-2 py-2">
                          {log.field_name ?? log.action}
                        </td>
                        <td className="max-w-[8rem] truncate px-2 py-2">
                          {log.old_value ?? "—"}
                        </td>
                        <td className="max-w-[8rem] truncate px-2 py-2">
                          {log.new_value ?? "—"}
                        </td>
                        <td className="px-2 py-2">{log.actor_label}</td>
                        <td className="whitespace-nowrap px-2 py-2">
                          {new Date(log.created_at).toLocaleString("es-MX")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
