"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatMxn } from "@/lib/money";
import { PLAN_LABELS, type PlanType } from "@/lib/plans";
import { buildWaMeUrl } from "@/lib/whatsapp";
import {
  ACQUISITION_LABELS,
  type CrmPayload,
  type CrmTenantRow,
} from "@/lib/super-admin-crm";
import { Button } from "@/components/ui/button";

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
  const [onboardingFilter, setOnboardingFilter] = useState("all");
  const [founderFilter, setFounderFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");

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

  const filteredRisk = useMemo(() => {
    if (!data) return [];
    return data.risk.filter((r) => {
      if (planFilter !== "all" && r.plan_type !== planFilter) return false;
      if (originFilter !== "all" && (r.acquisition_source || "") !== originFilter)
        return false;
      if (founderFilter === "yes" && !r.is_founding_partner) return false;
      if (founderFilter === "no" && r.is_founding_partner) return false;
      if (onboardingFilter === "incomplete" && r.onboardingScore >= 100)
        return false;
      if (onboardingFilter === "complete" && r.onboardingScore < 100)
        return false;
      if (healthFilter === "low" && r.healthScore >= 50) return false;
      if (healthFilter === "ok" && r.healthScore < 50) return false;
      return true;
    });
  }, [data, planFilter, originFilter, founderFilter, onboardingFilter, healthFilter]);

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

  if (loading && !data) {
    return <p className="text-sm text-muted">Cargando CRM…</p>;
  }
  if (error && !data) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!data) return null;

  const k = data.kpis;

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {supportQ === "expired" || supportQ === "invalid" ? (
        <p className="text-sm text-amber-800">
          El link de soporte ya no es válido. Genera uno nuevo desde esta página.
        </p>
      ) : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Activos" value={String(k.active)} />
        <Kpi label="Fundadores activos" value={String(k.foundersActive)} />
        <Kpi label="MRR lista" value={formatMxn(k.mrr)} />
        <Kpi label="ARR" value={formatMxn(k.arr)} />
        <Kpi label="Caja del mes" value={formatMxn(k.cashMonth)} />
        <Kpi label="Churn 30d" value={pct(k.churn30)} />
        <Kpi label="Retención M1" value={pct(k.retentionM1)} />
        <Kpi label="CTR WA 30d" value={pct(k.ctr30)} />
        <Kpi label="Conversión pago" value={pct(k.paidConversion)} />
        <Kpi label="LTV medio" value={k.ltvAvg != null ? formatMxn(k.ltvAvg) : "—"} />
        <Kpi
          label="Pedidos mes"
          value={`${k.ordersMonth} · ${k.ordersPickup} rec / ${k.ordersDelivery} env`}
        />
        <Kpi label="Fundadores con pago" value={pct(k.foundersPaidPct)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-black/5 bg-surface p-4">
          <h2 className="text-sm font-semibold">Mix</h2>
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
          <h2 className="text-sm font-semibold">Retención M0 → M1</h2>
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

      <Queue
        title="Fundadores — onboarding incompleto"
        hint="Hazlo tú: entra al panel o anota. Sin plantilla de video."
        rows={data.foundersQueue}
        busyId={busyId}
        founder
        onSupport={openSupport}
        onExtend={(id, days) =>
          patchTenant(id, { extend_days: days }, `+${days} días`)
        }
        onPause={(id, active) =>
          patchTenant(id, { is_active: active }, active ? "Reactivado" : "Pausado")
        }
      />

      <Queue
        title="Onboarding guiado"
        hint="Mándales el WhatsApp corto. Si no hay número, copia el mensaje."
        rows={data.guidedQueue}
        busyId={busyId}
        founder={false}
        onSupport={openSupport}
        onExtend={(id, days) =>
          patchTenant(id, { extend_days: days }, `+${days} días`)
        }
        onPause={(id, active) =>
          patchTenant(id, { is_active: active }, active ? "Reactivado" : "Pausado")
        }
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Riesgo</h2>
            <p className="text-xs text-muted">
              Health bajo, CTR roto, inactivos 5d o vencen en 7 días
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
              value={onboardingFilter}
              onChange={setOnboardingFilter}
              options={[
                ["all", "Onboarding"],
                ["incomplete", "Incompleto"],
                ["complete", "Completo"],
              ]}
            />
            <Filter
              value={healthFilter}
              onChange={setHealthFilter}
              options={[
                ["all", "Health"],
                ["low", "Bajo"],
                ["ok", "OK"],
              ]}
            />
          </div>
        </div>
        <TenantTable
          rows={filteredRisk}
          busyId={busyId}
          showWa
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
              <Link className="font-medium hover:underline" href={`/${r.slug}`} target="_blank">
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

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-surface p-3">
      <p className="text-[11px] text-muted">{label}</p>
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
      className="h-10 rounded-lg border border-black/10 bg-surface px-2 text-xs"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map(([v, l]) => (
        <option key={v || "empty"} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

function Queue({
  title,
  hint,
  rows,
  busyId,
  founder,
  onSupport,
  onExtend,
  onPause,
}: {
  title: string;
  hint: string;
  rows: CrmTenantRow[];
  busyId: string | null;
  founder: boolean;
  onSupport: (id: string) => void;
  onExtend: (id: string, days: number) => void;
  onPause: (id: string, active: boolean) => void;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/10 px-4 py-6 text-center text-sm text-muted">
          Nadie en esta cola.
        </p>
      ) : (
        <TenantTable
          rows={rows}
          busyId={busyId}
          showWa={!founder}
          showNotes={founder}
          onSupport={onSupport}
          onExtend={onExtend}
          onPause={onPause}
        />
      )}
    </section>
  );
}

function TenantTable({
  rows,
  busyId,
  showWa,
  showNotes,
  onSupport,
  onExtend,
  onPause,
}: {
  rows: CrmTenantRow[];
  busyId: string | null;
  showWa?: boolean;
  showNotes?: boolean;
  onSupport: (id: string) => void;
  onExtend: (id: string, days: number) => void;
  onPause: (id: string, active: boolean) => void;
}) {
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const waHref =
          showWa && r.phone_whatsapp.replace(/\D/g, "").length >= 10 && r.waMessage
            ? buildWaMeUrl(r.phone_whatsapp, r.waMessage)
            : null;
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
                {showWa && waHref ? (
                  <Button asChild size="sm" className="min-h-10">
                    <a href={waHref} target="_blank" rel="noreferrer">
                      WhatsApp
                    </a>
                  </Button>
                ) : null}
                {showWa && !waHref && r.waMessage ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="min-h-10"
                    onClick={() => void copyText(r.waMessage)}
                  >
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
                  {r.is_active ? "Pausar" : "Reactivar"}
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
