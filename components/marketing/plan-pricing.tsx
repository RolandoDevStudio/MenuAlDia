"use client";

import { useState } from "react";
import { ArrowLeft, Check, Minus } from "lucide-react";
import {
  PLAN_LABELS,
  FALLBACK_PLAN_PRICES,
  annualPrice,
  dailyValue,
  photoLimitLabel,
  type PlanPricesMap,
  type PlanType,
} from "@/lib/plans";
import { formatMxn } from "@/lib/money";
import { Reveal } from "@/components/marketing/reveal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const PLANS: PlanType[] = ["catalog", "daily", "pro"];

/** Short bullets on each pricing card */
export const PLAN_CARD_FEATURES: Record<PlanType, string[]> = {
  catalog: [
    photoLimitLabel("catalog"),
    "Menú público con tu marca",
    "Pedidos directos a WhatsApp",
    "Personalización de colores",
  ],
  daily: [
    photoLimitLabel("daily"),
    "Todo lo del Catálogo",
    "Menú del día en 1 toque",
    "Combos Express con link viral",
    "Flyer PNG para WhatsApp",
  ],
  pro: [
    photoLimitLabel("pro"),
    "Todo lo de Menú al Día",
    "Historial de clientes y pedidos",
    "Métricas básicas de venta",
    "Exportar CSV",
  ],
};

type PlanDetail = {
  forWho: string;
  benefit: string;
  includes: string[];
};

const PLAN_DETAILS: Record<PlanType, PlanDetail> = {
  catalog: {
    forWho:
      "Ideal si quieres un menú o catálogo online profesional y recibir pedidos por WhatsApp, sin complicaciones.",
    benefit:
      "Tus clientes ven qué vendes y te escriben el pedido ordenado a WhatsApp — sin app nueva ni intermediarios.",
    includes: [
      photoLimitLabel("catalog"),
      "Menú / catálogo público con tu marca (logo y colores)",
      "Pedidos directos a tu WhatsApp (tú cobras, 0% comisión)",
      "Personalización visual del menú",
      "Link listo para compartir (QR, redes, Status, Google)",
      "Panel admin desde el celular (PWA)",
    ],
  },
  daily: {
    forWho:
      "Para fondas, comida del día, locales y tiendas que cambian la oferta seguido y viven de WhatsApp o Status.",
    benefit:
      "Cada mañana (o turno) actualizas lo de hoy, generas flyer y lo mandas: más pedidos, menos mensajes sueltos.",
    includes: [
      photoLimitLabel("daily"),
      "Todo lo incluido en Catálogo Digital",
      "Menú / oferta del día en 1 toque",
      "Combos Express con link para compartir",
      "Flyer PNG para WhatsApp, Status y listas de difusión",
      "Actualización rápida de precios y platillos sin diseñador",
    ],
  },
  pro: {
    forWho:
      "Para negocios que ya venden por WhatsApp y quieren conocer, recuperar y fidelizar clientes.",
    benefit:
      "No solo recibes pedidos: sabes quién te compra y puedes volver a contactarlos para que regresen.",
    includes: [
      photoLimitLabel("pro"),
      "Todo lo incluido en Menú al Día",
      "Historial de clientes y pedidos",
      "Métricas básicas de venta / actividad",
      "Exportar CSV de tu información",
      "Base para seguimiento, recurrencia y campañas",
    ],
  },
};

const COMPARE_ROWS: {
  feature: string;
  catalog: string | boolean;
  daily: string | boolean;
  pro: string | boolean;
}[] = [
  {
    feature: "Productos con foto",
    catalog: "Hasta 30",
    daily: "Hasta 60",
    pro: "Hasta 150",
  },
  {
    feature: "Catálogo + marca",
    catalog: true,
    daily: true,
    pro: true,
  },
  {
    feature: "Pedidos a WhatsApp (0% comisión)",
    catalog: true,
    daily: true,
    pro: true,
  },
  {
    feature: "Menú / oferta del día",
    catalog: false,
    daily: true,
    pro: true,
  },
  {
    feature: "Combos + flyer PNG",
    catalog: false,
    daily: true,
    pro: true,
  },
  {
    feature: "Clientes, métricas y CSV",
    catalog: false,
    daily: false,
    pro: true,
  },
];

function CompareCell({ value }: { value: string | boolean }) {
  if (typeof value === "string") {
    return (
      <span className="font-semibold text-brand-dark">{value}</span>
    );
  }
  if (value) {
    return <Check className="h-4 w-4 text-brand" aria-label="Incluido" />;
  }
  return <Minus className="h-4 w-4 text-muted" aria-label="No incluido" />;
}

type Props = {
  billing: "monthly" | "annual";
  onBillingChange: (v: "monthly" | "annual") => void;
  planPrices: PlanPricesMap;
  fromDaily: number;
  onSelectPlan: (plan: PlanType) => void;
  selectPlanLabel?: string;
};

export function PlanPricing({
  billing,
  onBillingChange,
  planPrices,
  fromDaily,
  onSelectPlan,
  selectPlanLabel = "Quiero este plan",
}: Props) {
  const [detailPlan, setDetailPlan] = useState<PlanType | null>(null);
  const detail = detailPlan ? PLAN_DETAILS[detailPlan] : null;

  function priceFor(plan: PlanType) {
    const monthly =
      planPrices[plan]?.monthly ?? FALLBACK_PLAN_PRICES[plan].monthly;
    const price = billing === "annual" ? annualPrice(monthly) : monthly;
    const period = billing === "annual" ? "/año" : "/mes";
    return { monthly, price, period };
  }

  return (
    <>
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-brand-dark sm:text-5xl">
              Planes claros
            </h2>
            <p className="mt-2 text-sm text-muted">
              Desde {formatMxn(dailyValue(fromDaily))} al día.
            </p>
          </div>
          <div className="flex rounded-lg border border-black/10 bg-surface p-1">
            <button
              type="button"
              className={cn(
                "rounded-md px-3 py-2 text-xs font-semibold transition-colors duration-200",
                billing === "monthly"
                  ? "bg-brand text-white"
                  : "text-muted hover:text-foreground",
              )}
              onClick={() => onBillingChange("monthly")}
            >
              Mensual
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md px-3 py-2 text-xs font-semibold transition-colors duration-200",
                billing === "annual"
                  ? "bg-brand text-white"
                  : "text-muted hover:text-foreground",
              )}
              onClick={() => onBillingChange("annual")}
            >
              Anual (−2 meses)
            </button>
          </div>
        </div>
      </Reveal>

      <div className="mt-8 grid items-stretch gap-4 sm:grid-cols-3">
        {PLANS.map((plan, i) => {
          const { monthly, price, period } = priceFor(plan);
          const highlight = plan === "daily";
          return (
            <Reveal key={plan} delayMs={i * 90}>
              <div
                className={cn(
                  "landing-card flex h-full flex-col rounded-2xl border p-4",
                  highlight
                    ? "z-10 border-brand bg-white shadow-lg sm:scale-[1.03]"
                    : "border-black/10 bg-surface/90 hover:border-brand/30 hover:shadow-md",
                )}
              >
                {highlight ? (
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-brand">
                    Más popular
                  </p>
                ) : null}
                <p className="font-semibold">{PLAN_LABELS[plan]}</p>
                <p className="mt-2 font-[family-name:var(--font-display)] text-4xl text-brand">
                  {formatMxn(price)}
                  <span className="text-sm font-sans font-medium text-muted">
                    {period}
                  </span>
                </p>
                <p className="text-xs text-muted">
                  ≈ {formatMxn(dailyValue(monthly))} / día
                </p>
                <ul className="mt-4 flex-1 space-y-1.5 text-xs text-foreground">
                  {PLAN_CARD_FEATURES[plan].map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-3 min-h-10 w-full text-sm font-semibold text-brand hover:bg-brand/10 hover:text-brand-dark"
                  onClick={() => setDetailPlan(plan)}
                >
                  Ver qué incluye
                </Button>
                <Button
                  className="landing-cta mt-1 w-full"
                  variant={highlight ? "default" : "secondary"}
                  onClick={() => onSelectPlan(plan)}
                >
                  {selectPlanLabel}
                </Button>
              </div>
            </Reveal>
          );
        })}
      </div>

      <Reveal className="mt-10" delayMs={60}>
        <h3 className="text-lg font-semibold text-brand-dark">
          Comparación rápida
        </h3>
        <p className="mt-1 text-sm text-muted">
          Elige según lo que necesitas hoy; puedes cambiar de plan después.
        </p>

        {/* Mobile: stacked feature cards */}
        <ul className="mt-4 space-y-3 sm:hidden">
          {COMPARE_ROWS.map((row) => (
            <li
              key={row.feature}
              className="rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-sm"
            >
              <p className="text-sm font-semibold text-foreground">
                {row.feature}
              </p>
              <dl className="mt-2 space-y-1.5 text-xs">
                {PLANS.map((plan) => (
                  <div
                    key={plan}
                    className="flex items-center justify-between gap-2"
                  >
                    <dt
                      className={cn(
                        plan === "daily"
                          ? "font-semibold text-brand"
                          : "text-muted",
                      )}
                    >
                      {PLAN_LABELS[plan]}
                    </dt>
                    <dd className="flex justify-end">
                      <CompareCell value={row[plan]} />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>

        {/* Desktop table */}
        <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-black/10 bg-white sm:block">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-surface/80">
                <th className="px-4 py-3 font-semibold text-muted">
                  Característica
                </th>
                {PLANS.map((plan) => (
                  <th
                    key={plan}
                    className={cn(
                      "px-3 py-3 text-center font-semibold",
                      plan === "daily" ? "text-brand" : "text-foreground",
                    )}
                  >
                    {PLAN_LABELS[plan]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr
                  key={row.feature}
                  className="border-b border-black/5 last:border-0"
                >
                  <td className="px-4 py-3 text-foreground">{row.feature}</td>
                  {PLANS.map((plan) => (
                    <td key={plan} className="px-3 py-3 text-center">
                      <span className="inline-flex justify-center">
                        <CompareCell value={row[plan]} />
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      <Dialog
        open={detailPlan !== null}
        onOpenChange={(open) => {
          if (!open) setDetailPlan(null);
        }}
      >
        <DialogContent className="max-w-lg gap-3">
          {detailPlan && detail ? (
            <>
              <DialogHeader className="pr-8">
                <DialogTitle>{PLAN_LABELS[detailPlan]}</DialogTitle>
                <DialogDescription>{detail.forWho}</DialogDescription>
              </DialogHeader>

              {(() => {
                const { monthly, price, period } = priceFor(detailPlan);
                return (
                  <p className="font-[family-name:var(--font-display)] text-3xl text-brand">
                    {formatMxn(price)}
                    <span className="text-sm font-sans font-medium text-muted">
                      {period}
                    </span>
                    <span className="mt-0.5 block text-xs font-sans font-medium text-muted">
                      ≈ {formatMxn(dailyValue(monthly))} / día
                    </span>
                  </p>
                );
              })()}

              <p className="text-sm font-medium text-foreground">
                {detail.benefit}
              </p>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Qué incluye
                </p>
                <ul className="mt-2 space-y-2 text-sm text-foreground">
                  {detail.includes.map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                        aria-hidden
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-2 pt-1 sm:flex-row-reverse">
                <Button
                  className="landing-cta min-h-11 flex-1"
                  onClick={() => {
                    const plan = detailPlan;
                    setDetailPlan(null);
                    onSelectPlan(plan);
                  }}
                >
                  {selectPlanLabel}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 flex-1 gap-2"
                  onClick={() => setDetailPlan(null)}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Volver atrás
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
