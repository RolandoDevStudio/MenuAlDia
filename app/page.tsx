"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ImageIcon, Smartphone, MessageCircle } from "lucide-react";
import {
  PLAN_LABELS,
  FALLBACK_PLAN_PRICES,
  annualPrice,
  dailyValue,
  type PlanPricesMap,
  type PlanType,
} from "@/lib/plans";
import { formatMxn } from "@/lib/money";
import { buildWaMeUrl, SALES_WHATSAPP } from "@/lib/whatsapp";
import {
  CANONICAL_DEMOS,
  OFFICIAL_DOMAIN,
  type CanonicalDemoId,
} from "@/lib/canonical-demos";
import { BrandLogo } from "@/components/brand/brand-logo";
import { LandingNav } from "@/components/marketing/landing-nav";
import { LandingWhatsAppFab } from "@/components/marketing/landing-whatsapp-fab";
import { ProductStage } from "@/components/marketing/product-stage";
import { ProductShots } from "@/components/marketing/product-shots";
import { TrustStrip } from "@/components/marketing/trust-strip";
import { RoiCalculator } from "@/components/marketing/roi-calculator";
import { Reveal } from "@/components/marketing/reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const FEATURES: Record<PlanType, string[]> = {
  catalog: [
    "Hasta 30 productos con foto",
    "Menú público con tu marca",
    "Pedidos directos a WhatsApp",
    "Personalización de colores",
  ],
  daily: [
    "Todo lo del Catálogo",
    "Menú del día en 1 toque",
    "Combos Express con link viral",
    "Flyer PNG para WhatsApp",
  ],
  pro: [
    "Todo lo de Menú al Día",
    "Historial de clientes y pedidos",
    "Métricas básicas de venta",
    "Exportar CSV",
  ],
};

const BENEFITS = [
  {
    icon: Smartphone,
    title: "Actualiza desde el celular",
    body: "Cambia el menú del día en segundos, sin diseñador ni Excel.",
  },
  {
    icon: ImageIcon,
    title: "Flyer listo para WhatsApp",
    body: "Genera un PNG para Status y listas de difusión en un toque.",
  },
  {
    icon: MessageCircle,
    title: "Pedidos sin comisiones",
    body: "El cliente pide y el mensaje llega a tu WhatsApp. Tú cobras.",
  },
] as const;

const GIRO_ACCENT: Record<CanonicalDemoId, string> = {
  restaurante: "border-t-brand",
  servicios: "border-t-accent",
  tienda: "border-t-amber-600",
};

function SectionShell({
  children,
  className,
  id,
  tone = "plain",
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  tone?: "plain" | "surface" | "brand" | "white";
}) {
  const toneClass =
    tone === "surface"
      ? "bg-white/75"
      : tone === "brand"
        ? "bg-brand/[0.06]"
        : tone === "white"
          ? "bg-white/90"
          : "";

  return (
    <section
      id={id}
      className={cn("scroll-mt-20", toneClass, className)}
    >
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-14">{children}</div>
    </section>
  );
}

export default function HomePage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [city, setCity] = useState("");
  const [note, setNote] = useState("");
  const [planPrices, setPlanPrices] =
    useState<PlanPricesMap>(FALLBACK_PLAN_PRICES);

  const salesPhone =
    process.env.NEXT_PUBLIC_SALES_WHATSAPP || SALES_WHATSAPP;

  const plans = useMemo(
    () => (["catalog", "daily", "pro"] as PlanType[]),
    [],
  );

  const fromDaily =
    planPrices.daily?.monthly ?? FALLBACK_PLAN_PRICES.daily.monthly;

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

  function contactSales(plan?: PlanType) {
    const lines = [
      `*Prospecto ${OFFICIAL_DOMAIN}*`,
      `Nombre: ${name || "—"}`,
      `Negocio: ${business || "—"}`,
      `Ciudad: ${city || "—"}`,
      plan
        ? `Interés: ${PLAN_LABELS[plan]} (${billing === "annual" ? "anual" : "mensual"})`
        : null,
      note ? `Nota: ${note}` : null,
      "Quiero digitalizar mi menú.",
    ].filter(Boolean);
    const url = buildWaMeUrl(salesPhone, lines.join("\n"));
    window.location.href = url;
  }

  function scrollToContact() {
    document
      .getElementById("contacto")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="relative min-h-full overflow-x-clip bg-background">
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        <div className="landing-aurora absolute -inset-[6%]" />
      </div>

      <LandingNav onContactClick={scrollToContact} />

      <section className="mx-auto max-w-3xl px-6 pb-6 pt-10 sm:pt-14">
        <div
          className="motion-safe:animate-[rise_0.7s_ease-out]"
          style={{ animationFillMode: "both" }}
        >
          <BrandLogo variant="lockup" size="xl" href={null} />
        </div>
        <h1
          className="mt-5 max-w-xl text-2xl font-semibold leading-snug text-foreground sm:text-3xl motion-safe:animate-[rise_0.7s_ease-out]"
          style={{ animationDelay: "80ms", animationFillMode: "both" }}
        >
          Digitaliza tu menú en 2 minutos. Recibe pedidos por WhatsApp sin
          comisiones.
        </h1>
        <p
          className="mt-3 max-w-lg text-muted motion-safe:animate-[rise_0.7s_ease-out]"
          style={{ animationDelay: "160ms", animationFillMode: "both" }}
        >
          Hecho para restaurantes, servicios y tiendas locales que viven de
          listas de difusión — no de intermediarios.
        </p>
        <p
          className="mt-2 text-sm font-semibold text-brand motion-safe:animate-[rise_0.7s_ease-out]"
          style={{ animationDelay: "200ms", animationFillMode: "both" }}
        >
          Desde {formatMxn(dailyValue(fromDaily))} al día ·{" "}
          <button
            type="button"
            className="underline-offset-2 hover:underline"
            onClick={() =>
              document
                .getElementById("precios")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Ver precios
          </button>
        </p>
        <p
          className="mt-2 text-xs text-muted motion-safe:animate-[rise_0.7s_ease-out]"
          style={{ animationDelay: "240ms", animationFillMode: "both" }}
        >
          Hecho para locales en México · activación el mismo día
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-12 pt-2">
        <Reveal>
          <ProductStage />
        </Reveal>
      </section>

      <SectionShell id="beneficios" tone="surface">
        <Reveal>
          <h2 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-brand-dark sm:text-5xl">
            Por qué te conviene
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted">
            Simple y pensado para el ritmo de un negocio local.
          </p>
        </Reveal>
        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} as="li" delayMs={i * 90}>
              <div className="landing-card h-full rounded-2xl bg-white px-4 py-4 shadow-sm">
                <Icon className="h-6 w-6 text-brand" aria-hidden />
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
        <div className="mt-10">
          <ProductShots />
        </div>
      </SectionShell>

      <SectionShell id="demos" tone="plain">
        <Reveal>
          <h2 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-brand-dark sm:text-5xl">
            Tres giros, un producto
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted">
            Elige el que se parece a tu negocio.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {CANONICAL_DEMOS.map((d, i) => (
            <Reveal key={d.slug} delayMs={i * 90}>
              <Link
                href={`/${d.slug}`}
                className={cn(
                  "landing-card group block rounded-2xl border border-black/10 border-t-4 bg-white p-5 hover:shadow-md",
                  GIRO_ACCENT[d.id],
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  {d.label}
                </p>
                <p className="mt-2 font-[family-name:var(--font-display)] text-3xl text-brand-dark transition-colors group-hover:text-brand">
                  Demo {d.label.toLowerCase()}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Abre la demo y prueba un pedido por WhatsApp.
                </p>
              </Link>
            </Reveal>
          ))}
        </div>
      </SectionShell>

      <SectionShell tone="brand">
        <TrustStrip />
      </SectionShell>

      <SectionShell id="precios" tone="white">
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
                className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors duration-200 ${billing === "monthly" ? "bg-brand text-white" : "text-muted hover:text-foreground"}`}
                onClick={() => setBilling("monthly")}
              >
                Mensual
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors duration-200 ${billing === "annual" ? "bg-brand text-white" : "text-muted hover:text-foreground"}`}
                onClick={() => setBilling("annual")}
              >
                Anual (−2 meses)
              </button>
            </div>
          </div>
        </Reveal>

        <div className="mt-8 grid items-stretch gap-4 sm:grid-cols-3">
          {plans.map((plan, i) => {
            const monthly =
              planPrices[plan]?.monthly ?? FALLBACK_PLAN_PRICES[plan].monthly;
            const price =
              billing === "annual" ? annualPrice(monthly) : monthly;
            const period = billing === "annual" ? "/año" : "/mes";
            const highlight = plan === "daily";
            return (
              <Reveal key={plan} delayMs={i * 90}>
                <div
                  className={cn(
                    "landing-card h-full rounded-2xl border p-4",
                    highlight
                      ? "border-brand bg-white shadow-lg sm:scale-[1.03] sm:z-10"
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
                  <ul className="mt-4 space-y-1.5 text-xs text-foreground">
                    {FEATURES[plan].map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                  </ul>
                  <Button
                    className="landing-cta mt-4 w-full"
                    variant={highlight ? "default" : "secondary"}
                    onClick={() => contactSales(plan)}
                  >
                    Quiero este plan
                  </Button>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="mt-10" delayMs={80}>
          <div className="rounded-2xl border border-brand/15 bg-brand/[0.05] p-1 sm:p-2">
            <RoiCalculator />
          </div>
        </Reveal>
      </SectionShell>

      <SectionShell id="contacto" tone="plain" className="!py-0">
        <div className="mx-auto max-w-lg py-12 sm:py-14">
          <Reveal>
            <h2 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-brand-dark sm:text-5xl">
              Habla con nosotros
            </h2>
            <p className="mt-2 text-sm text-muted">
              Te respondemos por WhatsApp y te activamos en el mismo día.
            </p>
          </Reveal>
          <Reveal delayMs={100} className="mt-5 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Tu nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="business">Nombre del negocio</Label>
              <Input
                id="business"
                value={business}
                onChange={(e) => setBusiness(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">Ciudad</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note">¿Qué necesitas?</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <Button
              className="landing-cta w-full"
              size="lg"
              onClick={() => contactSales()}
            >
              Escribir por WhatsApp
            </Button>
          </Reveal>
        </div>
      </SectionShell>

      <footer className="border-t border-black/5 bg-surface/95">
        <div className="mx-auto max-w-3xl px-6 py-12 text-xs text-muted">
          <BrandLogo variant="lockup" size="sm" href={null} />
          <p className="mt-3">
            {OFFICIAL_DOMAIN} · SaaS para negocios locales
          </p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            <Link
              href="/admin/login"
              className="transition-colors hover:text-brand"
            >
              Entrar al admin
            </Link>
            <Link
              href="/privacidad"
              className="transition-colors hover:text-brand"
            >
              Privacidad
            </Link>
            <Link
              href="/terminos"
              className="transition-colors hover:text-brand"
            >
              Términos
            </Link>
            {CANONICAL_DEMOS.map((d) => (
              <Link
                key={d.slug}
                href={`/${d.slug}`}
                className="transition-colors hover:text-brand"
              >
                Demo {d.label.toLowerCase()}
              </Link>
            ))}
          </div>
        </div>
      </footer>
      <LandingWhatsAppFab />
    </main>
  );
}
