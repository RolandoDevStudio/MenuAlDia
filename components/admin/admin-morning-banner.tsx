"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  effectiveAcceptingOrders,
  type OrdersOverride,
} from "@/lib/store-hours";

function greetingForHour(hour: number): string {
  if (hour < 12) return "¡Buenos días";
  if (hour < 19) return "¡Buenas tardes";
  return "¡Buenas noches";
}

export function AdminMorningBanner({
  restaurantName,
  publicSlug,
  initialAcceptingOrders,
  logoUrl,
  scheduleAuto = false,
  scheduleHours,
  initialOverride = null,
  initialClosedMessage = "",
}: {
  restaurantName: string;
  publicSlug: string;
  initialAcceptingOrders: boolean;
  logoUrl?: string | null;
  scheduleAuto?: boolean;
  scheduleHours?: unknown;
  initialOverride?: OrdersOverride;
  initialClosedMessage?: string;
}) {
  const [now, setNow] = useState(() => new Date());
  const [override, setOverride] = useState<OrdersOverride>(initialOverride);
  const [storedAccepting, setStoredAccepting] = useState(initialAcceptingOrders);
  const [open, setOpen] = useState(() =>
    effectiveAcceptingOrders({
      accepting_orders: initialAcceptingOrders,
      schedule_auto: scheduleAuto,
      schedule_hours: scheduleHours,
      orders_override: initialOverride,
    }),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closeMsg, setCloseMsg] = useState(initialClosedMessage);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [pendingCloseMsg, setPendingCloseMsg] = useState(initialClosedMessage);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Refresh effective open when following schedule (no override)
  useEffect(() => {
    if (!scheduleAuto || override) return;
    const next = effectiveAcceptingOrders({
      accepting_orders: storedAccepting,
      schedule_auto: true,
      schedule_hours: scheduleHours,
      orders_override: null,
    });
    setOpen(next);
  }, [now, scheduleAuto, override, scheduleHours, storedAccepting]);

  const hourFmt = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "numeric",
    hour12: false,
  });
  const hour = Number(hourFmt.format(now));
  const dateLine = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  const timeLine = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(now);

  async function revalidatePublic() {
    await fetch("/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: publicSlug }),
    });
  }

  async function applyStatus(accepting: boolean, message?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/store-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accepting,
          closed_message: message,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        accepting_orders?: boolean;
        orders_override?: OrdersOverride;
        closed_message?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "No se pudo actualizar");
        return false;
      }
      setOpen(Boolean(json.accepting_orders));
      setStoredAccepting(Boolean(json.accepting_orders));
      setOverride((json.orders_override as OrdersOverride) ?? null);
      if (json.closed_message !== undefined) {
        setCloseMsg(json.closed_message);
      }
      await revalidatePublic();
      return true;
    } catch {
      setError("Error de red");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onToggle(next: boolean) {
    if (!next) {
      setPendingCloseMsg(closeMsg);
      setShowCloseForm(true);
      return;
    }
    setShowCloseForm(false);
    const ok = await applyStatus(true, "");
    if (!ok) setOpen(false);
  }

  async function confirmClose() {
    const ok = await applyStatus(false, pendingCloseMsg);
    if (ok) {
      setShowCloseForm(false);
      setOpen(false);
    }
  }

  async function clearOverride() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/store-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear_override: true }),
      });
      const json = (await res.json()) as {
        error?: string;
        accepting_orders?: boolean;
      };
      if (!res.ok) {
        setError(json.error ?? "No se pudo quitar el override");
        return;
      }
      setOverride(null);
      setOpen(Boolean(json.accepting_orders));
      setStoredAccepting(Boolean(json.accepting_orders));
      await revalidatePublic();
    } finally {
      setBusy(false);
    }
  }

  const hasLogo = Boolean(logoUrl?.trim());
  const overrideLabel =
    override === "force_open"
      ? "Forzado abierto"
      : override === "force_closed"
        ? "Forzado cerrado"
        : null;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border px-4 py-4 text-white shadow-sm",
        open
          ? "border-emerald-700/20 bg-gradient-to-br from-emerald-700 to-teal-800"
          : "border-red-800/20 bg-gradient-to-br from-stone-700 to-stone-900",
      )}
    >
      {hasLogo ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-0 flex w-[55%] items-center justify-end overflow-hidden"
          aria-hidden
          style={{
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.35) 28%, black 58%)",
            maskImage:
              "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.35) 28%, black 58%)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl!}
            alt=""
            className="h-[115%] max-h-none w-auto max-w-none translate-x-[6%] object-contain object-right opacity-[0.28] brightness-110 contrast-90 sm:opacity-[0.32]"
          />
        </div>
      ) : null}

      <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-[min(100%,22rem)] sm:max-w-[58%]">
          <p className="text-lg font-semibold leading-tight drop-shadow-sm">
            {greetingForHour(Number.isFinite(hour) ? hour : 12)}, {restaurantName}!
          </p>
          <p className="mt-1 text-sm capitalize text-white/85">
            {dateLine} · {timeLine}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 backdrop-blur-[2px]">
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              open ? "bg-emerald-300" : "bg-red-300",
            )}
          />
          <span className="text-xs font-semibold">
            {open ? "Abierto" : "Cerrado"}
          </span>
          <Switch
            checked={open}
            disabled={busy}
            onCheckedChange={(v) => void onToggle(v)}
            aria-label="Aceptando pedidos"
          />
        </div>
      </div>

      <p className="relative z-10 mt-2 max-w-[min(100%,22rem)] text-[11px] text-white/75 sm:max-w-[58%]">
        {open
          ? scheduleAuto && !override
            ? "Abierto según horario"
            : "Aceptando pedidos por WhatsApp"
          : !open && closeMsg
            ? closeMsg
            : "Cerrado — el menú sigue visible"}
      </p>

      {scheduleAuto ? (
        <div className="relative z-10 mt-2 flex flex-wrap items-center gap-2">
          {overrideLabel ? (
            <>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium">
                {overrideLabel}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-white hover:bg-white/10 hover:text-white"
                disabled={busy}
                onClick={() => void clearOverride()}
              >
                Seguir horario
              </Button>
            </>
          ) : (
            <span className="text-[10px] text-white/70">
              Horario automático activo · el switch fuerza un override
            </span>
          )}
        </div>
      ) : null}

      {showCloseForm ? (
        <div className="relative z-10 mt-3 space-y-2 rounded-xl bg-black/25 p-3">
          <Label className="text-xs text-white/90" htmlFor="close-msg">
            Mensaje al cliente (opcional)
          </Label>
          <Input
            id="close-msg"
            value={pendingCloseMsg}
            maxLength={160}
            onChange={(e) => setPendingCloseMsg(e.target.value)}
            placeholder="Ej. Cerrado por inventarios, regresamos mañana 9am"
            className="min-h-11 border-white/20 bg-white/95 text-foreground"
          />
          <p className="text-[10px] text-white/65">
            Vacío = mensaje por defecto en el menú público.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              className="bg-white text-stone-900 hover:bg-white/90"
              onClick={() => void confirmClose()}
            >
              Confirmar cierre
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/10 hover:text-white"
              disabled={busy}
              onClick={() => setShowCloseForm(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="relative z-10 mt-1 text-xs text-red-200" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
