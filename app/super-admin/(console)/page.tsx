import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/super-admin";
import { getPlanPrices, PLAN_LABELS, type PlanType } from "@/lib/plans";
import { formatMxn } from "@/lib/money";
import { stateLabel } from "@/lib/mx-locations";
import { buildWaMeUrl, resolveSalesWhatsApp } from "@/lib/whatsapp";
import { getLandingContent } from "@/lib/landing-content";
import { CANONICAL_DEMOS } from "@/lib/canonical-demos";
import type { Restaurant } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { AlertsFeed } from "@/components/super-admin/alerts-feed";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";
import { getLandingAnalyticsBundle } from "@/lib/landing-analytics";
import { formatMexicoCityDate } from "@/lib/dates";

export default async function SuperAdminHomePage() {
  await requireSuperAdmin();
  const supabase = await createClient();
  const [{ data }, planPrices, landing, landing7, landing30] = await Promise.all([
    supabase
      .from("restaurants")
      .select(
        "id, slug, name, phone_whatsapp, plan_type, is_active, subscription_end_date, state, city",
      ),
    getPlanPrices(),
    getLandingContent(),
    getLandingAnalyticsBundle("7d"),
    getLandingAnalyticsBundle("30d"),
  ]);
  const restaurants = (data ?? []) as Restaurant[];

  const now = Date.now();
  const in7 = now + 7 * 24 * 60 * 60 * 1000;
  const active = restaurants.filter(
    (r) =>
      r.is_active !== false &&
      new Date(r.subscription_end_date).getTime() > now,
  );
  const mrr = active.reduce((sum, r) => {
    const plan = (r.plan_type as PlanType) || "catalog";
    return sum + (planPrices[plan]?.monthly ?? 0);
  }, 0);
  const mrrByPlan = (["catalog", "daily", "pro"] as PlanType[]).map((p) => {
    const count = active.filter((r) => (r.plan_type || "catalog") === p).length;
    const amount = count * (planPrices[p]?.monthly ?? 0);
    return { plan: p, count, amount };
  });
  const expiring = restaurants.filter((r) => {
    const t = new Date(r.subscription_end_date).getTime();
    return t > now && t <= in7;
  });
  const expired = restaurants
    .filter((r) => new Date(r.subscription_end_date).getTime() <= now)
    .slice(0, 5);

  const byState = new Map<string, number>();
  for (const r of active) {
    const code = (r.state || "").trim();
    if (!code) continue;
    byState.set(code, (byState.get(code) ?? 0) + 1);
  }
  const topStates = [...byState.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const salesPhone = resolveSalesWhatsApp(landing.salesWhatsApp);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" className="min-h-11">
          <Link href="/super-admin/tenants">
            <Emoji char={UI_EMOJI.create} />
            Crear / ver tenants
          </Link>
        </Button>
        <details className="relative">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-black/10 bg-surface px-3 text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
            Demos
          </summary>
          <div className="absolute left-0 z-20 mt-1 flex min-w-[12rem] flex-col gap-1 rounded-xl border border-black/10 bg-surface p-1.5 shadow-lg">
            {CANONICAL_DEMOS.map((d) => (
              <a
                key={d.slug}
                href={`/${d.slug}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-black/5"
              >
                Demo {d.label}
              </a>
            ))}
          </div>
        </details>
      </div>

      <AlertsFeed />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-black/5 bg-surface p-4">
          <p className="text-xs text-muted">Suscriptores activos</p>
          <p className="mt-1 text-3xl font-semibold">{active.length}</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-surface p-4">
          <p className="text-xs text-muted">MRR estimado</p>
          <p className="mt-1 text-2xl font-semibold">{formatMxn(mrr)}</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-surface p-4">
          <p className="text-xs text-muted">Total tenants</p>
          <p className="mt-1 text-3xl font-semibold">{restaurants.length}</p>
        </div>
      </div>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Landing (7 días)</h2>
          <Link
            href="/super-admin/settings"
            className="text-xs font-medium text-brand underline-offset-2 hover:underline"
          >
            Ver detalle en CMS
          </Link>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-black/5 bg-surface p-4">
            <p className="text-xs text-muted">Visitas</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {landing7.kpis.views}
            </p>
          </div>
          <div className="rounded-2xl border border-black/5 bg-surface p-4">
            <p className="text-xs text-muted">Clics WhatsApp</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {landing7.kpis.waClicks}
            </p>
          </div>
          <div className="rounded-2xl border border-black/5 bg-surface p-4">
            <p className="text-xs text-muted">Tenants origen landing (30d)</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {landing30.kpis.tenantsLanding}
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">MRR por plan</h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-3">
          {mrrByPlan.map(({ plan, count, amount }) => (
            <li
              key={plan}
              className="rounded-xl border border-black/5 bg-surface px-3 py-2 text-sm"
            >
              <p className="font-semibold">{PLAN_LABELS[plan]}</p>
              <p className="text-muted">
                {count} activos · {formatMxn(amount)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <details className="rounded-2xl border border-black/5 bg-surface">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
          Activos por estado
        </summary>
        <div className="border-t border-black/5 px-4 pb-4 pt-2">
        {topStates.length === 0 ? (
          <p className="text-sm text-muted">
            Sin estados canónicos aún. Edita tenants o ajustes del negocio.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {topStates.map(([code, n]) => (
              <li
                key={code}
                className="flex justify-between rounded-lg border border-black/5 bg-background px-3 py-2"
              >
                <span>{stateLabel(code)}</span>
                <span className="font-semibold">{n}</span>
              </li>
            ))}
          </ul>
        )}
        </div>
      </details>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Vencen en 7 días</h2>
          <Link
            href="/super-admin/finanzas"
            className="text-xs font-semibold text-brand hover:underline"
          >
            Ver pagos SPEI →
          </Link>
        </div>
        {expiring.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nadie por vencer.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {expiring.map((r) => {
              const remindUrl = buildWaMeUrl(
                r.phone_whatsapp || salesPhone,
                [
                  `Hola${r.name ? ` — ${r.name}` : ""}`,
                  `Te contacto por MenuAlDía (/${r.slug}).`,
                  `Tu suscripción vence el ${formatMexicoCityDate(r.subscription_end_date)}.`,
                  "¿Confirmamos la renovación?",
                ].join("\n"),
              );
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
                >
                  <span>
                    {r.name}{" "}
                    <span className="text-muted">/{r.slug}</span>
                    <span className="ml-2 text-xs text-muted">
                      {formatMexicoCityDate(r.subscription_end_date)}
                    </span>
                  </span>
                  <a
                    href={remindUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-11 inline-flex items-center rounded-lg bg-brand px-3 text-xs font-semibold text-white"
                  >
                    Recordar por WA
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <details className="rounded-2xl border border-black/5 bg-surface">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
          Vencidos (muestra)
        </summary>
        <div className="border-t border-black/5 px-4 pb-4 pt-2">
        {expired.length === 0 ? (
          <p className="text-sm text-muted">Ninguno vencido.</p>
        ) : (
          <ul className="space-y-2">
            {expired.map((r) => (
              <li
                key={r.id}
                className="flex justify-between rounded-xl border border-black/5 bg-background px-3 py-2 text-sm"
              >
                <span>
                  {r.name} <span className="text-muted">/{r.slug}</span>
                </span>
                <Link
                  href="/super-admin/tenants"
                  className="font-semibold text-brand"
                >
                  Ver en Tenants
                </Link>
              </li>
            ))}
          </ul>
        )}
        </div>
      </details>
    </div>
  );
}
