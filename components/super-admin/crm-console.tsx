"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatMxn } from "@/lib/money";
import { PLAN_LABELS, type PlanType } from "@/lib/plans";
import { buildWaMeUrl } from "@/lib/whatsapp";
import {
  ACQUISITION_LABELS,
  type CrmPayload,
  type CrmTenantRow,
} from "@/lib/super-admin-crm";
import {
  actionFilterLabel,
  buildCrmInsights,
  type ActionFilterKey,
} from "@/lib/crm-insights";
import { Button } from "@/components/ui/button";
import { CrmHelpDialog } from "@/components/super-admin/crm-help-dialog";
import { cn } from "@/lib/utils";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";

type ChartView = "mix" | "retention" | "funnel";

function pct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function ctrText(row: CrmTenantRow): string {
  if (row.ctrLabel === "sin_visitas") return "Sin visitas";
  if (row.ctrLabel === "visitas_sin_clic") return "Visitas sin clic";
  return row.ctr != null ? `${Math.round(row.ctr * 100)}% CTR` : "Convierte";
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

function idsOf(rows: CrmTenantRow[]): Set<string> {
  return new Set(rows.map((r) => r.id));
}

function byActionFilter(
  data: CrmPayload,
  key: ActionFilterKey | null,
): CrmTenantRow[] {
  const all = data.tenants ?? [];
  if (key === "founders_onboarding") {
    const ids = idsOf(data.foundersQueue);
    return all.filter((t) => ids.has(t.id));
  }
  if (key === "guided_onboarding") {
    const ids = idsOf(data.guidedQueue);
    return all.filter((t) => ids.has(t.id));
  }
  if (key === "sin_visitas") return all.filter((t) => t.ctrLabel === "sin_visitas");
  if (key === "visitas_sin_clic")
    return all.filter((t) => t.ctrLabel === "visitas_sin_clic");
  if (key === "inactive_5d") return all.filter((t) => t.inactive5d);
  if (key === "expires_7d") return all.filter((t) => t.expiresIn7d);
  const attention = new Set([
    ...data.foundersQueue.map((r) => r.id),
    ...data.guidedQueue.map((r) => r.id),
    ...data.risk.map((r) => r.id),
  ]);
  return all.filter((t) => attention.has(t.id));
}

export function CrmConsole() {
  const searchParams = useSearchParams();
  const supportQ = searchParams.get("support");
  const [data, setData] = useState<CrmPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [planFilter, setPlanFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [founderFilter, setFounderFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState<ActionFilterKey | null>(null);
  const [chartView, setChartView] = useState<ChartView>("mix");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/super-admin/crm");
    const json = (await res.json()) as CrmPayload & { error?: string };
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "No se pudo cargar el CRM");
      return;
    }
    setData(json);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const insights = useMemo(() => (data ? buildCrmInsights(data) : []), [data]);

  const filteredTenants = useMemo(() => {
    if (!data) return [];
    return byActionFilter(data, actionFilter).filter((r) => {
      if (planFilter !== "all" && r.plan_type !== planFilter) return false;
      if (originFilter !== "all" && (r.acquisition_source || "") !== originFilter)
        return false;
      if (founderFilter === "yes" && !r.is_founding_partner) return false;
      if (founderFilter === "no" && r.is_founding_partner) return false;
      return true;
    });
  }, [data, actionFilter, planFilter, originFilter, founderFilter]);

  const mixChart = useMemo(() => {
    const counts: Record<PlanType, number> = { catalog: 0, daily: 0, pro: 0 };
    for (const t of filteredTenants) {
      const p = (t.plan_type || "catalog") as PlanType;
      counts[p] += 1;
    }
    return (Object.keys(counts) as PlanType[]).map((plan) => ({
      name: PLAN_LABELS[plan],
      n: counts[plan],
    }));
  }, [filteredTenants]);

  const funnelChart = useMemo(() => {
    const views = filteredTenants.reduce((s, t) => s + t.views30, 0);
    const clicks = filteredTenants.reduce((s, t) => s + t.clicks30, 0);
    return [
      { name: "Visitas", n: views },
      { name: "Clics WA", n: clicks },
    ];
  }, [filteredTenants]);

  async function patchTenant(
    id: string,
    body: Record<string, unknown>,
    okMsg: string,
  ) {
    setBusyId(id);
    setMessage(null);
    const res = await fetch("/api/super-admin/tenants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    const json = (await res.json()) as { error?: string };
    setBusyId(null);
    if (!res.ok) {
      setError(json.error ?? "No se pudo actualizar");
      return;
    }
    setMessage(okMsg);
    await load();
  }

  async function openSupport(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch("/api/super-admin/support-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurant_id: id }),
    });
    const json = (await res.json()) as { url?: string; error?: string };
    setBusyId(null);
    if (!res.ok || !json.url) {
      setError(json.error ?? "No se pudo crear el link de soporte");
      return;
    }
    window.location.href = json.url;
  }

  function applyInsight(key: ActionFilterKey) {
    setActionFilter(key);
    setPlanFilter("all");
    setOriginFilter("all");
    setFounderFilter("all");
    requestAnimationFrame(() => {
      document.getElementById("crm-action-list")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  if (loading && !data) {
    return <p className="text-sm text-muted">Cargando CRM…</p>;
  }
  if (error && !data) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!data) return null;

  const k = data.kpis;
  const retentionChart = data.cohorts.map((c) => ({
    name: c.month.slice(5),
    pct: c.rate != null ? Math.round(c.rate * 100) : 0,
  }));

  return (
    <div className="min-w-0 space-y-8 overflow-x-hidden">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {supportQ === "expired" || supportQ === "invalid" ? (
        <p className="text-sm text-amber-800">
          El link de soporte ya no es válido. Genera uno nuevo desde esta página.
        </p>
      ) : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Cifras globales de la plataforma
        </p>
        <CrmHelpDialog helpId="overview" variant="text" />
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Activos" value={String(k.active)} helpId="active" />
        <Kpi
          label="Fundadores activos"
          value={String(k.foundersActive)}
          helpId="foundersActive"
        />
        <Kpi label="MRR lista" value={formatMxn(k.mrr)} helpId="mrr" />
        <Kpi label="ARR" value={formatMxn(k.arr)} helpId="arr" />
        <Kpi label="Caja del mes" value={formatMxn(k.cashMonth)} helpId="cashMonth" />
        <Kpi label="Churn 30d" value={pct(k.churn30)} helpId="churn30" />
        <Kpi label="Retención M1" value={pct(k.retentionM1)} helpId="retentionM1" />
        <Kpi label="CTR WA 30d" value={pct(k.ctr30)} helpId="ctr30" />
        <Kpi
          label="Conversión pago"
          value={pct(k.paidConversion)}
          helpId="paidConversion"
        />
        <Kpi
          label="LTV medio"
          value={k.ltvAvg != null ? formatMxn(k.ltvAvg) : "—"}
          helpId="ltv"
        />
        <Kpi
          label="Pedidos mes"
          value={`${k.ordersMonth} · ${k.ordersPickup} rec / ${k.ordersDelivery} env`}
          helpId="ordersMonth"
        />
        <Kpi
          label="Fundadores con pago"
          value={pct(k.foundersPaidPct)}
          helpId="foundersPaid"
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Hoy conviene</h2>
        {insights.length === 0 ? (
          <p className="text-sm text-muted">
            Sin alertas fuertes; sigue las colas de onboarding.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {insights.map((ins) => (
              <li key={ins.id}>
                <button
                  type="button"
                  onClick={() => applyInsight(ins.filterKey)}
                  className={cn(
                    "h-full w-full rounded-2xl border bg-surface px-3 py-3 text-left hover:border-brand/30",
                    actionFilter === ins.filterKey
                      ? "border-brand/40 bg-brand/5"
                      : "border-black/5",
                  )}
                >
                  <p className="text-sm font-semibold">{ins.title}</p>
                  <p className="mt-1 text-xs text-muted">{ins.body}</p>
                  {ins.extraHref ? (
                    <Link
                      href={ins.extraHref.href}
                      className="mt-2 inline-block text-xs font-medium text-brand underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {ins.extraHref.label}
                    </Link>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-black/5 bg-surface p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Mix global</h2>
            <CrmHelpDialog helpId="mix" />
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {data.mix.byPlan.map((p) => (
              <li key={p.plan} className="flex justify-between">
                <span>{PLAN_LABELS[p.plan]}</span>
                <span className="font-medium">{p.count}</span>
              </li>
            ))}
            <li className="flex justify-between border-t border-black/5 pt-1">
              <span>Socios fundadores</span>
              <span className="font-medium">{data.mix.founders}</span>
            </li>
          </ul>
          <p className="mt-3 text-xs font-semibold text-muted">Origen</p>
          <ul className="mt-1 space-y-1 text-sm">
            {data.mix.byOrigin
              .filter((o) => o.count > 0)
              .map((o) => (
                <li key={o.source || "none"} className="flex justify-between">
                  <span>
                    {ACQUISITION_LABELS[
                      (o.source || "") as keyof typeof ACQUISITION_LABELS
                    ] ?? o.source}
                  </span>
                  <span className="font-medium">{o.count}</span>
                </li>
              ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-black/5 bg-surface p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Retención M0 → M1</h2>
            <CrmHelpDialog helpId="cohorts" />
          </div>
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 font-semibold">Alta</th>
                <th className="py-1 font-semibold">N</th>
                <th className="py-1 font-semibold">Activos M1</th>
                <th className="py-1 font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {data.cohorts.map((c) => (
                <tr key={c.month} className="border-t border-black/5">
                  <td className="py-1.5">
                    {c.month}
                    {c.inProgress ? (
                      <span className="ml-1 text-[10px] text-muted">en curso</span>
                    ) : null}
                  </td>
                  <td className="py-1.5">{c.signedUp}</td>
                  <td className="py-1.5">{c.retained}</td>
                  <td className="py-1.5">{pct(c.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Vista filtrada
          </p>
          <CrmHelpDialog helpId="charts" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter
            value={planFilter}
            onChange={setPlanFilter}
            options={[
              ["all", "Plan"],
              ["catalog", "Catálogo"],
              ["daily", "Menú al Día"],
              ["pro", "Pro"],
            ]}
          />
          <Filter
            value={originFilter}
            onChange={setOriginFilter}
            options={[
              ["all", "Origen"],
              ["", "Sin origen"],
              ["landing", "Landing"],
              ["dur_local", "Durango"],
              ["redes", "Redes"],
              ["boca_a_boca", "Boca a boca"],
              ["otro", "Otro"],
            ]}
          />
          <Filter
            value={founderFilter}
            onChange={setFounderFilter}
            options={[
              ["all", "Fundador"],
              ["yes", "Sí"],
              ["no", "No"],
            ]}
          />
          <Filter
            value={chartView}
            onChange={(v) => setChartView(v as ChartView)}
            options={[
              ["mix", "Gráfico: mix"],
              ["retention", "Gráfico: retención"],
              ["funnel", "Gráfico: embudo WA"],
            ]}
          />
        </div>

        {actionFilter ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand/20 bg-brand/5 px-3 py-2 text-sm">
            <span>
              Viendo: <span className="font-semibold">{actionFilterLabel(actionFilter)}</span>
              {" · "}
              {filteredTenants.length}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-9"
              onClick={() => setActionFilter(null)}
            >
              Quitar filtro
            </Button>
          </div>
        ) : null}

        <div className="rounded-2xl border border-black/5 bg-surface p-4">
          <div className="h-[220px] w-full min-w-0 overflow-hidden">
            {chartView === "mix" ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={mixChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                  <Tooltip />
                  <Bar dataKey="n" name="Negocios" fill="#2a6f6f" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
            {chartView === "retention" ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={retentionChart}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    width={32}
                    domain={[0, 100]}
                  />
                  <Tooltip formatter={(v) => [`${String(v)}%`, "% M1"]} />
                  <Bar dataKey="pct" name="% M1" fill="#c45c26" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
            {chartView === "funnel" ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={funnelChart}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#00000010" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                  <Tooltip />
                  <Bar dataKey="n" name="Eventos 30d" fill="#c45c26" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
          {chartView === "retention" ? (
            <p className="mt-2 text-[11px] text-muted">
              Este gráfico es global (no usa plan/origen). La lista de abajo sí se filtra.
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-muted">
              Mix y embudo usan el mismo subset que la lista ({filteredTenants.length}).
            </p>
          )}
        </div>
      </section>

      <section id="crm-action-list" className="scroll-mt-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Lista de acción</h2>
            <p className="text-xs text-muted">
              {actionFilter
                ? actionFilterLabel(actionFilter)
                : "Onboarding incompleto y riesgo. Elige una tarjeta de Hoy conviene para acotar."}
            </p>
          </div>
          <CrmHelpDialog helpId="actionList" />
        </div>
        {filteredTenants.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/10 px-4 py-6 text-center text-sm text-muted">
            Nadie con este filtro.
          </p>
        ) : (
          <TenantTable
            rows={filteredTenants}
            busyId={busyId}
            showNotes
            onSupport={openSupport}
            onExtend={(id, days) =>
              patchTenant(id, { extend_days: days }, `+${days} días`)
            }
            onPause={(id, active) =>
              patchTenant(
                id,
                { is_active: active },
                active ? "Reactivado" : "Pausado",
              )
            }
          />
        )}
      </section>

      <section className="rounded-2xl border border-black/5 bg-surface p-4">
        <h2 className="text-sm font-semibold">Uso</h2>
        <p className="mt-1 text-sm text-muted">
          Fotos vs límite (promedio) {pct(data.usage.photoFillAvg)} · Pro{" "}
          {pct(data.usage.proPct)}
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {data.usage.topOrders.map((r) => (
            <li key={r.id} className="flex justify-between gap-2">
              <Link
                className="font-medium hover:underline"
                href={`/${r.slug}`}
                target="_blank"
              >
                {r.name}
              </Link>
              <span className="text-muted">{r.orders} pedidos mes</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  helpId,
}: {
  label: string;
  value: string;
  helpId: string;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-surface p-3">
      <div className="flex items-start justify-between gap-1">
        <p className="text-[11px] text-muted">{label}</p>
        <CrmHelpDialog helpId={helpId} />
      </div>
      <p className="mt-1 text-lg font-semibold leading-tight">{value}</p>
    </div>
  );
}

function Filter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      className="h-10 min-w-0 rounded-lg border border-black/10 bg-surface px-2 text-xs"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map(([v, l]) => (
        <option key={`${v}-${l}`} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

function TenantTable({
  rows,
  busyId,
  showNotes,
  onSupport,
  onExtend,
  onPause,
}: {
  rows: CrmTenantRow[];
  busyId: string | null;
  showNotes?: boolean;
  onSupport: (id: string) => void;
  onExtend: (id: string, days: number) => void;
  onPause: (id: string, active: boolean) => void;
}) {
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const showWa = !r.is_founding_partner;
        const digits = r.phone_whatsapp.replace(/\D/g, "");
        const waHref =
          showWa && digits.length >= 10 && r.waMessage
            ? buildWaMeUrl(r.phone_whatsapp, r.waMessage)
            : null;
        const showCopy = showWa && !waHref && Boolean(r.waMessage);
        const busy = busyId === r.id;
        return (
          <li
            key={r.id}
            className="rounded-2xl border border-black/5 bg-surface px-3 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">
                  {r.name}{" "}
                  <span className="text-xs font-normal text-muted">
                    /{r.slug} · {PLAN_LABELS[r.plan_type as PlanType]} · onboarding{" "}
                    {r.onboardingScore}% · health {r.healthScore}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {ctrText(r)} · {r.views30} visitas / {r.clicks30} clics ·{" "}
                  {r.photoCount}/{r.photoLimit} fotos
                  {r.inactive5d ? " · inactivo 5d" : ""}
                  {r.expiresIn7d ? " · vence 7d" : ""}
                  {r.is_founding_partner ? " · fundador" : ""}
                </p>
                {showNotes && r.internal_notes ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted">
                    {r.internal_notes}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {waHref ? (
                  <Button asChild size="sm" className="min-h-10">
                    <a href={waHref} target="_blank" rel="noreferrer">
                      <Emoji char={UI_EMOJI.whatsapp} />
                      WhatsApp
                    </a>
                  </Button>
                ) : null}
                {showCopy ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="min-h-10"
                    onClick={() => void copyText(r.waMessage)}
                  >
                    <Emoji char={UI_EMOJI.copy} />
                    Copiar mensaje
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10"
                  disabled={busy}
                  onClick={() => onSupport(r.id)}
                >
                  <Emoji char={UI_EMOJI.support} />
                  Soporte
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-10"
                  disabled={busy}
                  onClick={() => onExtend(r.id, 7)}
                >
                  <Emoji char={UI_EMOJI.extend} />
                  +7d
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-10"
                  disabled={busy}
                  onClick={() => onExtend(r.id, 30)}
                >
                  <Emoji char={UI_EMOJI.extend} />
                  +30d
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-10"
                  disabled={busy}
                  onClick={() => onPause(r.id, !r.is_active)}
                >
                  {r.is_active ? (
                    <>
                      <Emoji char={UI_EMOJI.pause} />
                      Pausar
                    </>
                  ) : (
                    <>
                      <Emoji char={UI_EMOJI.resume} />
                      Reactivar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
