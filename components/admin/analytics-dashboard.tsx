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
  BarChart,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { AnalyticsBundle } from "@/lib/analytics-queries";
import { formatMxn } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Preset = "today" | "7d" | "30d" | "month" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Hoy" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "month", label: "Este mes" },
  { id: "custom", label: "Personalizado" },
];

const CHANNEL_COLORS = ["#c45c26", "#2a6f6f", "#d4a017", "#5c6bc0", "#6b7280"];

function shortDate(ymd: string) {
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
}

export function AnalyticsDashboard() {
  const [preset, setPreset] = useState<Preset>("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<AnalyticsBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load(nextPreset: Preset, nextFrom = from, nextTo = to) {
    startTransition(async () => {
      setError(null);
      const params = new URLSearchParams();
      if (nextPreset === "custom" && nextFrom && nextTo) {
        params.set("from", nextFrom);
        params.set("to", nextTo);
      } else if (nextPreset !== "custom") {
        params.set("preset", nextPreset);
      } else {
        params.set("preset", "7d");
      }
      try {
        const res = await fetch(`/api/admin/analytics?${params}`);
        const json = (await res.json()) as AnalyticsBundle & { error?: string };
        if (!res.ok) {
          setError(json.error ?? "No se pudieron cargar las métricas");
          return;
        }
        setData(json);
        setFrom(json.meta.from);
        setTo(json.meta.to);
      } catch {
        setError("Error de red");
      }
    });
  }

  useEffect(() => {
    load("7d");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const rangeQs =
    data?.meta.from && data?.meta.to
      ? `from=${encodeURIComponent(data.meta.from)}&to=${encodeURIComponent(data.meta.to)}`
      : "";

  const trafficChart =
    data?.series.map((p) => ({
      ...p,
      label: shortDate(p.date),
    })) ?? [];

  const dishesChart =
    data?.topDishes.map((d) => ({
      name: d.name.length > 22 ? `${d.name.slice(0, 20)}…` : d.name,
      adds: d.adds,
      full: d.name,
    })) ?? [];

  const couponsChart = data?.coupons ?? [];
  const hourlyChart = data?.hourly ?? [];
  const channelChart = (data?.channels ?? []).filter((c) => c.value > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={preset === p.id ? "default" : "outline"}
            className={cn(preset === p.id && "bg-brand text-white")}
            disabled={pending}
            onClick={() => {
              setPreset(p.id);
              if (p.id !== "custom") load(p.id);
            }}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {preset === "custom" ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted" htmlFor="an-from">
              Desde
            </label>
            <Input
              id="an-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-auto"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted" htmlFor="an-to">
              Hasta
            </label>
            <Input
              id="an-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-auto"
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={pending || !from || !to}
            onClick={() => load("custom", from, to)}
          >
            Aplicar
          </Button>
        </div>
      ) : null}

      {data?.meta.instrumentationSparse ? (
        <p className="rounded-xl border border-black/5 bg-surface/80 px-3 py-2 text-xs text-muted">
          Las métricas de horas pico, clics a WhatsApp, toques a platillos y
          atribución de flyers se calculan a partir del despliegue de este
          módulo. El panel se irá enriqueciendo día a día.
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Visitas"
              value={String(data.kpis.views)}
            />
            <Kpi
              label="Clics WhatsApp"
              value={String(data.kpis.waClicks)}
            />
            <Kpi
              label="Pedidos / envíos"
              value={String(data.kpis.orders)}
            />
            <div className="rounded-2xl border border-black/5 bg-surface p-4">
              <p className="text-xs text-muted">Conversión estimada</p>
              <p className="mt-1 text-2xl font-semibold">
                {data.kpis.conversionPct}%
              </p>
              <p className="mt-1 text-[11px] leading-snug text-muted">
                Basada en interacciones de pedido (clic a WhatsApp o envío) ÷
                visitas al menú.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Ventas (rango)" value={formatMxn(data.kpis.salesTotal)} />
            <Kpi label="Ticket promedio" value={formatMxn(data.kpis.avgTicket)} />
            <Kpi label="Top cupón" value={data.kpis.topCoupon ?? "—"} />
            <Kpi label="Top producto" value={data.kpis.topDish ?? "—"} />
          </div>

          <ChartCard title="Tráfico y pedidos">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trafficChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="views" name="Visitas" fill="#2a6f6f" radius={4} />
                  <Bar
                    dataKey="waClicks"
                    name="WA"
                    fill="#c45c26"
                    radius={4}
                  />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    name="Pedidos"
                    stroke="#d4a017"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Top platillos (agregados al carrito)">
              <div className="h-52 w-full">
                {dishesChart.length === 0 ? (
                  <Empty />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dishesChart} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={90}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip />
                      <Bar dataKey="adds" name="Agregados" fill="#c45c26" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </ChartCard>

            <ChartCard title="Canjes por cupón">
              <div className="h-52 w-full">
                {couponsChart.length === 0 ? (
                  <Empty />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={couponsChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                      <XAxis dataKey="code" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar
                        dataKey="redemptions"
                        name="Canjes"
                        fill="#2a6f6f"
                        radius={4}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Canales (landing flyer vs directo)">
              <div className="h-52 w-full">
                {channelChart.length === 0 ? (
                  <Empty />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={channelChart}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                      >
                        {channelChart.map((_, i) => (
                          <Cell
                            key={i}
                            fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              {data.kpis.topChannel ? (
                <p className="mt-1 text-xs text-muted">
                  Canal principal: {data.kpis.topChannel}
                </p>
              ) : null}
            </ChartCard>

            <ChartCard title="Horas pico (visitas)">
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(h) => `${h}h`}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v) => [v as number, "Visitas"]}
                      labelFormatter={(h) => `${h}:00`}
                    />
                    <Bar dataKey="views" fill="#5c6bc0" radius={2} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Exportar CSV</h2>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["traffic", "Tráfico"],
                  ["coupons", "Cupones"],
                  ["catalog", "Catálogo"],
                  ["customers", "Clientes"],
                  ["orders", "Pedidos"],
                ] as const
              ).map(([type, label]) => (
                <Button key={type} type="button" size="sm" variant="outline" asChild>
                  <a
                    href={`/api/admin/export?type=${type}${rangeQs ? `&${rangeQs}` : ""}`}
                  >
                    {label}
                  </a>
                </Button>
              ))}
            </div>
          </div>
        </>
      ) : pending ? (
        <p className="text-sm text-muted">Cargando métricas…</p>
      ) : null}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold">{value}</p>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <p className="flex h-full items-center justify-center text-sm text-muted">
      Sin datos en este rango.
    </p>
  );
}
