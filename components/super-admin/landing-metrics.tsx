"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { LandingAnalyticsBundle } from "@/lib/landing-analytics";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Preset = "7d" | "30d";

function shortDate(ymd: string) {
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
}

export function LandingMetrics() {
  const [preset, setPreset] = useState<Preset>("7d");
  const [data, setData] = useState<LandingAnalyticsBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/super-admin/landing-analytics?preset=${preset}`,
        );
        const json = (await res.json()) as LandingAnalyticsBundle & {
          error?: string;
        };
        if (!res.ok) {
          setError(json.error ?? "No se pudieron cargar las métricas");
          setData(null);
          return;
        }
        setError(null);
        setData(json);
      } catch {
        setError("Error de red");
      }
    });
  }, [preset]);

  const k = data?.kpis;

  return (
    <section className="space-y-3 rounded-2xl border border-black/5 bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Métricas de la landing</h2>
          <p className="text-xs text-muted">
            Visitas y clics en menualdia.com.mx (día CDMX). No incluye tu
            sesión de superadmin.
          </p>
        </div>
        <div className="flex gap-1">
          {(["7d", "30d"] as const).map((id) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={preset === id ? "default" : "secondary"}
              className="min-h-9"
              onClick={() => setPreset(id)}
            >
              {id === "7d" ? "7 días" : "30 días"}
            </Button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {pending && !data ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : null}

      {k ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi label="Visitas" value={String(k.views)} />
          <Kpi label="WhatsApp" value={String(k.waClicks)} />
          <Kpi label="CTR WA" value={`${k.ctrPct}%`} />
          <Kpi label="Demos abiertas" value={String(k.demos)} />
        </div>
      ) : null}

      {k && k.tenantsLanding > 0 ? (
        <p className="text-xs text-muted">
          Tenants con origen “landing” en el periodo:{" "}
          <span className="font-medium text-foreground">{k.tenantsLanding}</span>
        </p>
      ) : null}

      {data && data.series.length > 0 ? (
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={{ fontSize: 11 }}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(v) => shortDate(String(v))}
                formatter={(value, name) => [
                  value,
                  name === "views"
                    ? "Visitas"
                    : name === "waClicks"
                      ? "WhatsApp"
                      : "Demos",
                ]}
              />
              <Bar dataKey="views" fill="#c45c26" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="waClicks" stroke="#2a6f6f" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {data ? (
        <ul className="space-y-1 text-sm">
          {data.breakdown.map((row) => (
            <li
              key={row.key}
              className={cn(
                "flex justify-between gap-2 rounded-lg px-2 py-1",
                row.count > 0 ? "bg-black/[0.03]" : "text-muted",
              )}
            >
              <span>{row.label}</span>
              <span className="font-medium tabular-nums">{row.count}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/5 bg-background px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
