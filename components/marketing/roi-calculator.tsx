"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlanPricesMap } from "@/lib/plans";
import { FALLBACK_PLAN_PRICES } from "@/lib/plans";
import { formatMxn } from "@/lib/money";
import { dailyValue } from "@/lib/plans";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Mode = "hours" | "sales";

export function RoiCalculator() {
  const [mode, setMode] = useState<Mode>("hours");
  const [msgsPerDay, setMsgsPerDay] = useState(20);
  const [minsEach, setMinsEach] = useState(3);
  const [salesPerWeek, setSalesPerWeek] = useState(25);
  const [ticket, setTicket] = useState(150);
  const [planPrices, setPlanPrices] =
    useState<PlanPricesMap>(FALLBACK_PLAN_PRICES);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/plan-prices");
      if (!res.ok) return;
      const data = (await res.json()) as PlanPricesMap;
      setPlanPrices({
        catalog: data.catalog ?? FALLBACK_PLAN_PRICES.catalog,
        daily: data.daily ?? FALLBACK_PLAN_PRICES.daily,
        pro: data.pro ?? FALLBACK_PLAN_PRICES.pro,
      });
    })();
  }, []);

  const hoursPerMonth = useMemo(() => {
    const mins = Math.max(0, msgsPerDay) * Math.max(0, minsEach) * 30;
    return Math.round((mins / 60) * 10) / 10;
  }, [msgsPerDay, minsEach]);

  const lostPerMonth = useMemo(() => {
    // Escenario ejemplo: 2 clientes/semana perdidos por lentitud
    const lostPerWeek = 2;
    return Math.max(0, lostPerWeek) * Math.max(0, ticket) * 4;
  }, [ticket]);

  const subMonthly = planPrices.daily?.monthly ?? FALLBACK_PLAN_PRICES.daily.monthly;
  const salesToCover = ticket > 0 ? Math.ceil(subMonthly / ticket) : 0;

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-foreground">
        ¿Cuánto te cuesta seguir a mano?
      </p>
      <p className="mt-1 text-xs text-muted">
        Escenarios de ejemplo — ajusta los números a tu negocio.
      </p>

      <div className="mt-3 flex rounded-lg border border-black/10 bg-surface p-1">
        <button
          type="button"
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors",
            mode === "hours" ? "bg-brand text-white" : "text-muted",
          )}
          onClick={() => setMode("hours")}
        >
          Horas salvadas
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors",
            mode === "sales" ? "bg-brand text-white" : "text-muted",
          )}
          onClick={() => setMode("sales")}
        >
          Ventas perdidas
        </button>
      </div>

      {mode === "hours" ? (
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="msgs">
              ¿Cuántos mensajes o llamadas recibes al día pidiendo el menú o
              informes?
            </Label>
            <Input
              id="msgs"
              type="number"
              min={0}
              value={msgsPerDay}
              onChange={(e) => setMsgsPerDay(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mins">¿Cuántos minutos te toma atender cada uno?</Label>
            <Input
              id="mins"
              type="number"
              min={0}
              step={0.5}
              value={minsEach}
              onChange={(e) => setMinsEach(Number(e.target.value) || 0)}
            />
          </div>
          <p className="rounded-xl bg-brand/10 px-3 py-3 text-sm leading-relaxed text-foreground">
            Pierdes{" "}
            <strong>
              {hoursPerMonth} hora{hoursPerMonth === 1 ? "" : "s"}
            </strong>{" "}
            al mes respondiendo lo mismo por WhatsApp. Con Menú al Día tu
            cliente ve el catálogo completo y te envía el pedido listo
            {hoursPerMonth >= 20
              ? " — en este escenario, cerca de 1 hora diaria de trabajo."
              : "."}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sales">
              ¿Cuántas ventas haces a la semana por WhatsApp o en local?
            </Label>
            <Input
              id="sales"
              type="number"
              min={0}
              value={salesPerWeek}
              onChange={(e) => setSalesPerWeek(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket">¿Cuál es tu ticket promedio (MXN)?</Label>
            <Input
              id="ticket"
              type="number"
              min={0}
              value={ticket}
              onChange={(e) => setTicket(Number(e.target.value) || 0)}
            />
          </div>
          <p className="rounded-xl bg-brand/10 px-3 py-3 text-sm leading-relaxed text-foreground">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Escenario ejemplo · 2 clientes/semana
            </span>
            <br />
            Si pierdes solo 2 clientes a la semana por tardar en mandar tu lista
            de precios, dejas ir{" "}
            <strong>{formatMxn(lostPerMonth)} MXN</strong> al mes. Tu plan Menú
            al Día ({formatMxn(subMonthly)}/mes, ≈{" "}
            {formatMxn(dailyValue(subMonthly))}/día) se paga solo recuperando
            cerca de {salesToCover || "—"} venta
            {salesToCover === 1 ? "" : "s"} al mes.
          </p>
          <p className="text-[11px] text-muted">
            Referencia de volumen actual: ~{salesPerWeek} ventas/semana en tus
            números.
          </p>
        </div>
      )}
    </div>
  );
}
