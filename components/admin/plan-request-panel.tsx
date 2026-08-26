"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PLAN_LABELS, type PlanType } from "@/lib/plans";
import {
  cancelConsequencesCopy,
  changePlanConsequencesCopy,
  daysUntil,
  getLifecyclePhase,
  type PlanChangeRequest,
} from "@/lib/subscription-lifecycle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMexicoCityDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

function daysLabel(n: number): string {
  return n === 1 ? "1 día" : `${n} días`;
}

export function PlanRequestPanel({
  currentPlan,
  subscriptionEndDate,
  isActive,
  graceEndsAt,
  purgeScheduledAt,
}: {
  currentPlan: PlanType;
  subscriptionEndDate?: string | null;
  isActive?: boolean;
  graceEndsAt?: string | null;
  purgeScheduledAt?: string | null;
}) {
  const [requests, setRequests] = useState<PlanChangeRequest[]>([]);
  const [mode, setMode] = useState<"idle" | "cancel" | "change_plan">("idle");
  const [toPlan, setToPlan] = useState<PlanType>(
    currentPlan === "pro" ? "daily" : "pro",
  );
  const [reason, setReason] = useState("");
  const [acked, setAcked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/plan-requests");
    const json = (await res.json()) as {
      requests?: PlanChangeRequest[];
      error?: string;
    };
    if (res.ok) setRequests(json.requests ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = requests.find((r) => r.status === "pending");
  const phase = getLifecyclePhase({
    is_active: isActive,
    subscription_end_date: subscriptionEndDate,
    grace_ends_at: graceEndsAt,
    purge_scheduled_at: purgeScheduledAt,
  });
  const daysLeft = daysUntil(subscriptionEndDate);
  const graceDaysLeft = daysUntil(graceEndsAt);
  const vigenteHasta = subscriptionEndDate
    ? formatMexicoCityDate(subscriptionEndDate, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;
  let statusLine = "Sin fecha de vigencia";
  if (phase === "active") {
    if (daysLeft == null) statusLine = "Activo";
    else if (daysLeft < 0) statusLine = "Vencido · menú público oculto";
    else if (daysLeft === 0) statusLine = "Vence hoy";
    else statusLine = `Activo · ${daysLabel(daysLeft)}`;
  } else if (phase === "expired_grace") {
    statusLine = "Vencido · menú público oculto";
  } else if (phase === "expired_pre_purge" || phase === "purge_due") {
    statusLine = "Vencido · exporta tus datos pronto";
  } else if (phase === "purged") {
    statusLine = "Cuenta en proceso de baja";
  }
  const warn =
    phase !== "active" || (daysLeft != null && daysLeft <= 7);

  const consequences =
    mode === "cancel"
      ? cancelConsequencesCopy(currentPlan)
      : mode === "change_plan"
        ? changePlanConsequencesCopy(currentPlan, toPlan)
        : [];

  async function submit() {
    if (mode === "idle") return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/plan-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_type: mode,
          to_plan: mode === "change_plan" ? toPlan : null,
          reason,
          acknowledged_consequences: acked,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "No se pudo enviar");
        return;
      }
      setMessage("Solicitud enviada. Soporte la revisará pronto.");
      setMode("idle");
      setReason("");
      setAcked(false);
      await load();
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  }

  async function cancelPending(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/plan-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "cancel_request" }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "No se pudo cancelar");
        return;
      }
      setMessage("Solicitud cancelada");
      await load();
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-black/5 bg-surface p-4">
      <div>
        <h2 className="text-sm font-semibold">Plan y suscripción</h2>
        <p className="mt-1 text-xs text-muted">
          Los cambios de plan requieren aprobación de soporte.
        </p>
      </div>

      <div
        className={cn(
          "rounded-lg px-3 py-2.5 text-xs",
          warn
            ? "bg-amber-50 text-amber-950"
            : "border border-black/5 bg-background text-foreground",
        )}
      >
        <p>
          <span className="text-muted">Plan</span>{" "}
          <span className="font-semibold">{PLAN_LABELS[currentPlan]}</span>
        </p>
        <p className="mt-1">
          <span className="text-muted">Vigente hasta</span>{" "}
          <span className="font-semibold">{vigenteHasta ?? "Sin fecha"}</span>
        </p>
        <p className="mt-1 font-medium">{statusLine}</p>
        {phase === "expired_grace" && graceEndsAt ? (
          <p className="mt-1 text-amber-900">
            {graceDaysLeft != null && graceDaysLeft > 0
              ? `Tienes ${daysLabel(graceDaysLeft)} de gracia para exportar (hasta ${formatMexicoCityDate(graceEndsAt, { day: "numeric", month: "long" })}).`
              : "Estás en periodo de gracia: exporta tus datos pronto."}{" "}
            Renueva con el SPEI de abajo o contacta a soporte.
          </p>
        ) : null}
        {phase === "expired_pre_purge" || phase === "purge_due" ? (
          <p className="mt-1 text-amber-900">
            El periodo de gracia terminó. Renueva con soporte o exporta lo que
            puedas.
          </p>
        ) : null}
        <p className="mt-2">
          <Link
            href="/admin/history"
            className="font-medium text-brand underline-offset-2 hover:underline"
          >
            Ver pagos
          </Link>
        </p>
      </div>

      {pending ? (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-medium">
            Solicitud pendiente:{" "}
            {pending.request_type === "cancel"
              ? "cancelación"
              : `cambio a ${PLAN_LABELS[(pending.to_plan as PlanType) || "catalog"] ?? pending.to_plan}`}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-8 px-2 text-amber-900"
            disabled={loading}
            onClick={() => void cancelPending(pending.id)}
          >
            Retirar solicitud
          </Button>
        </div>
      ) : mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setMode("change_plan");
              setAcked(false);
              setError(null);
            }}
          >
            Cambiar plan
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-red-700"
            onClick={() => {
              setMode("cancel");
              setAcked(false);
              setError(null);
            }}
          >
            Cancelar suscripción
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {mode === "change_plan" ? (
            <div className="space-y-1.5">
              <Label htmlFor="to_plan">Nuevo plan</Label>
              <select
                id="to_plan"
                className="flex h-11 w-full rounded-lg border border-black/10 bg-background px-3 text-sm"
                value={toPlan}
                onChange={(e) => setToPlan(e.target.value as PlanType)}
              >
                {(["catalog", "daily", "pro"] as PlanType[])
                  .filter((p) => p !== currentPlan)
                  .map((p) => (
                    <option key={p} value={p}>
                      {PLAN_LABELS[p]}
                    </option>
                  ))}
              </select>
            </div>
          ) : null}

          <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
            {consequences.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          <div className="space-y-1.5">
            <Label htmlFor="plan_reason">Motivo (opcional)</Label>
            <Input
              id="plan_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. ya no uso el menú diario"
            />
          </div>

          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={acked}
              onChange={(e) => setAcked(e.target.checked)}
            />
            <span>He leído y acepto las consecuencias anteriores.</span>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!acked || loading}
              onClick={() => void submit()}
            >
              {loading ? "Enviando…" : "Enviar solicitud"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={() => {
                setMode("idle");
                setAcked(false);
              }}
            >
              Volver
            </Button>
          </div>
        </div>
      )}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {message ? <p className="text-xs text-accent">{message}</p> : null}

      {requests.length > 0 ? (
        <div className="border-t border-black/5 pt-3">
          <p className="text-[11px] font-medium text-muted">Historial reciente</p>
          <ul className="mt-1 space-y-1 text-[11px] text-muted">
            {requests.slice(0, 5).map((r) => (
              <li key={r.id}>
                {formatMexicoCityDate(r.created_at)} ·{" "}
                {r.request_type === "cancel" ? "Cancelar" : "Cambio"} ·{" "}
                {r.status}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
