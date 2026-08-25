"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, ImageIcon, Smartphone, MessageCircle, Shield, Zap } from "lucide-react";
import {
  PLAN_LABELS,
  FALLBACK_PLAN_PRICES,
  dailyValue,
  type PlanPricesMap,
  type PlanType,
} from "@/lib/plans";
import { formatMxn } from "@/lib/money";
import {
  buildWaMeUrl,
  formatSalesWhatsAppDisplay,
  SALES_WHATSAPP,
} from "@/lib/whatsapp";
import {
  CANONICAL_DEMOS,
  OFFICIAL_DOMAIN,
  getCanonicalDemo,
  type CanonicalDemoId,
} from "@/lib/canonical-demos";
import {
  DEFAULT_LANDING_CONTENT,
  DEFAULT_LANDING_FAQ,
  type LandingContent,
} from "@/lib/landing-content";
import { BrandLogo } from "@/components/brand/brand-logo";
import { LandingNav } from "@/components/marketing/landing-nav";
import { LandingWhatsAppFab } from "@/components/marketing/landing-whatsapp-fab";
import { ProductStage } from "@/components/marketing/product-stage";
import { ProductShots } from "@/components/marketing/product-shots";
import { ComparisonCards } from "@/components/marketing/comparison-cards";
import { ValueMatrix } from "@/components/marketing/value-matrix";
import { LandingStickyCta } from "@/components/marketing/landing-sticky-cta";
import { LandingBreathStrip } from "@/components/marketing/landing-breath-strip";
import { TrustStrip } from "@/components/marketing/trust-strip";
import { FaqSection } from "@/components/marketing/faq-section";
import { RoiCalculator } from "@/components/marketing/roi-calculator";
import { PlanPricing } from "@/components/marketing/plan-pricing";
import { Reveal } from "@/components/marketing/reveal";
import { MxLocationFields } from "@/components/location/mx-location-fields";
import { stateLabel } from "@/lib/mx-locations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
  const [stateCode, setStateCode] = useState("");
  const [note, setNote] = useState("");
  const [giro, setGiro] = useState<CanonicalDemoId | "">("restaurante");
  const [giroError, setGiroError] = useState(false);
  const [planPrices, setPlanPrices] =
    useState<PlanPricesMap>(FALLBACK_PLAN_PRICES);
  const [landing, setLanding] = useState<LandingContent>({
    ...DEFAULT_LANDING_CONTENT,
    faq: [...DEFAULT_LANDING_FAQ],
  });

  const salesPhone =
    process.env.NEXT_PUBLIC_SALES_WHATSAPP || SALES_WHATSAPP;
  const salesPhoneDisplay = formatSalesWhatsAppDisplay(salesPhone);

  const fromDaily =
    planPrices.daily?.monthly ?? FALLBACK_PLAN_PRICES.daily.monthly;

  useEffect(() => {
    void (async () => {
      const [pricesRes, landingRes] = await Promise.all([
        fetch("/api/plan-prices"),
        fetch("/api/landing-content"),
      ]);
      if (pricesRes.ok) {
        const data = (await pricesRes.json()) as PlanPricesMap;
        setPlanPrices({
          catalog: data.catalog ?? FALLBACK_PLAN_PRICES.catalog,
          daily: data.daily ?? FALLBACK_PLAN_PRICES.daily,
          pro: data.pro ?? FALLBACK_PLAN_PRICES.pro,
        });
      }
      if (landingRes.ok) {
        const data = (await landingRes.json()) as LandingContent;
        setLanding({
          ...DEFAULT_LANDING_CONTENT,
          ...data,
          faq:
            Array.isArray(data.faq) && data.faq.length > 0
              ? data.faq
              : [...DEFAULT_LANDING_FAQ],
          testimonials: Array.isArray(data.testimonials)
            ? data.testimonials
            : [],
          demoPosters: data.demoPosters ?? {},
          comparisonImages: data.comparisonImages ?? {},
        });
      }
    })();
  }, []);

  function openSalesWhatsApp(prefill: string) {
    window.location.href = buildWaMeUrl(salesPhone, prefill);
  }

  function contactSales(plan?: PlanType) {
    if (!giro) {
      setGiroError(true);
      document
        .getElementById("contacto")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setGiroError(false);
    const giroLabel = getCanonicalDemo(giro)?.label ?? giro;
    const lines = [
      `*Prospecto ${OFFICIAL_DOMAIN}*`,
      `Nombre: ${name || "—"}`,
      `Negocio: ${business || "—"}`,
      `Giro: ${giroLabel}`,
      `Ciudad: ${city || "—"}`,
      `Estado: ${stateLabel(stateCode) || "—"}`,
      plan
        ? `Interés: ${PLAN_LABELS[plan]} (${billing === "annual" ? "anual" : "mensual"})`
        : null,
      note ? `Nota: ${note}` : null,
      "Quiero digitalizar mi menú.",
    ].filter(Boolean);
    openSalesWhatsApp(lines.join("\n"));
  }

  function contactSalesQuick(kind: "nav" | "breath" | "form") {
    const giroLabel = giro
      ? (getCanonicalDemo(giro)?.label ?? giro)
      : null;
    if (kind === "form" && !giro) {
      setGiroError(true);
      return;
    }
    if (kind === "form") setGiroError(false);

    if (kind === "nav") {
      openSalesWhatsApp(
        giroLabel
          ? `Hola, quiero info de Menú al Día para mi negocio (${giroLabel}).`
          : "Hola, quiero información de Menú al Día para mi negocio.",
      );
      return;
    }
    if (kind === "breath") {
      openSalesWhatsApp(
        giroLabel
          ? `Hola, quiero activarme hoy con Menú al Día (${giroLabel}).`
          : "Hola, quiero activarme hoy con Menú al Día.",
      );
      return;
    }
    contactSales();
  }

  function scrollToContact() {
    document
      .getElementById("contacto")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="relative min-h-full overflow-x-clip bg-background pb-24 md:pb-0">
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        <div className="landing-aurora absolute -inset-[6%]" />
      </div>

      <LandingNav
        onContactClick={scrollToContact}
        onWhatsAppClick={() => contactSalesQuick("nav")}
        whatsAppLabel={`WhatsApp ${salesPhoneDisplay}`}
      />

      <section
        id="demos"
        className="mx-auto max-w-5xl scroll-mt-20 px-6 pb-12 pt-10 sm:pt-14"
      >
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
          <div className="min-w-0 flex-1 lg:max-w-xl lg:pt-2">
            <div
              className="motion-safe:animate-[rise_0.7s_ease-out]"
              style={{ animationFillMode: "both" }}
            >
              <BrandLogo variant="lockup" size="xl" href={null} />
            </div>
            <h1
              className="mt-5 text-2xl font-semibold leading-snug text-foreground sm:text-3xl motion-safe:animate-[rise_0.7s_ease-out]"
              style={{ animationDelay: "80ms", animationFillMode: "both" }}
            >
              {landing.heroTitle}
            </h1>
            <p
              className="mt-3 max-w-xl text-muted motion-safe:animate-[rise_0.7s_ease-out]"
              style={{ animationDelay: "160ms", animationFillMode: "both" }}
            >
              {landing.heroSubtitle}
            </p>
            <div
              className="mt-4 flex flex-wrap gap-2 motion-safe:animate-[rise_0.7s_ease-out]"
              style={{ animationDelay: "200ms", animationFillMode: "both" }}
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-muted">
                <Zap className="h-3.5 w-3.5 text-brand" aria-hidden />
                Carga rápida
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-muted">
                <Shield className="h-3.5 w-3.5 text-brand" aria-hidden />
                0% comisiones
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-muted">
                <Bell className="h-3.5 w-3.5 text-brand" aria-hidden />
                Notificaciones de pedidos
              </span>
            </div>
            <div
              className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap motion-safe:animate-[rise_0.7s_ease-out]"
              style={{ animationDelay: "240ms", animationFillMode: "both" }}
            >
              <Button
                type="button"
                className="landing-cta min-h-11"
                onClick={scrollToContact}
              >
                Probar 30 días gratis
              </Button>
              <Button
                type="button"
                variant="outline"
                className="landing-cta min-h-11"
                onClick={() =>
                  document
                    .getElementById("precios")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                Ver precios
              </Button>
            </div>
            <p
              className="mt-3 text-sm font-semibold text-brand motion-safe:animate-[rise_0.7s_ease-out]"
              style={{ animationDelay: "280ms", animationFillMode: "both" }}
            >
              Desde {formatMxn(dailyValue(fromDaily))} al día
            </p>
            <p
              className="mt-2 text-xs text-muted motion-safe:animate-[rise_0.7s_ease-out]"
              style={{ animationDelay: "300ms", animationFillMode: "both" }}
            >
              {landing.socialProofLine}
            </p>
          </div>

          <div
            className="mx-auto w-full max-w-[375px] shrink-0 motion-safe:animate-[rise_0.7s_ease-out] lg:mx-0"
            style={{ animationDelay: "200ms", animationFillMode: "both" }}
          >
            <ProductStage
              demoPosters={landing.demoPosters}
              onActiveDemoChange={(id) => {
                setGiro(id);
                setGiroError(false);
              }}
            />
          </div>
        </div>
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
        <div className="mt-8">
          <ProductShots />
        </div>
      </SectionShell>

      <SectionShell id="comparar" tone="plain">
        <Reveal>
          <h2 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-brand-dark sm:text-5xl">
            ¿Por qué elegir Menú al Día frente a un menú común?
          </h2>
          <p className="mt-2 max-w-lg text-sm text-muted">
            Compara un catálogo de pago único con una plataforma pensada para
            que tus clientes vuelvan.
          </p>
        </Reveal>
        <Reveal delayMs={80}>
          <ComparisonCards images={landing.comparisonImages} />
        </Reveal>
        <Reveal delayMs={120}>
          <div className="mt-10">
            <h3 className="text-lg font-semibold text-brand-dark">
              De un vistazo
            </h3>
            <p className="mt-1 text-sm text-muted">
              PDF, apps de delivery y Menú al Día.
            </p>
            <div className="mt-4">
              <ValueMatrix />
            </div>
          </div>
        </Reveal>
      </SectionShell>

      <SectionShell tone="brand">
        <TrustStrip testimonials={landing.testimonials} />
      </SectionShell>

      <SectionShell id="precios" tone="white">
        <PlanPricing
          billing={billing}
          onBillingChange={setBilling}
          planPrices={planPrices}
          fromDaily={fromDaily}
          onSelectPlan={contactSales}
          selectPlanLabel={`Quiero este plan · ${salesPhoneDisplay}`}
        />

        <Reveal className="mt-10" delayMs={80}>
          <div className="rounded-2xl border border-brand/15 bg-brand/[0.05] p-1 sm:p-2">
            <RoiCalculator />
          </div>
        </Reveal>
      </SectionShell>

      <SectionShell tone="brand">
        <LandingBreathStrip
          onCtaClick={() => contactSalesQuick("breath")}
          ctaLabel={`WhatsApp ${salesPhoneDisplay}`}
        />
      </SectionShell>

      <SectionShell id="faq" tone="surface">
        <FaqSection items={landing.faq} />
      </SectionShell>

      <SectionShell id="contacto" tone="plain" className="!py-0">
        <div className="mx-auto max-w-lg py-12 sm:py-14">
          <Reveal>
            <h2 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-brand-dark sm:text-5xl">
              Habla con nosotros
            </h2>
            <p className="mt-2 text-sm text-muted">
              {landing.contactBlurb}
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
              <Label id="giro-label">Giro del negocio</Label>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-labelledby="giro-label"
              >
                {CANONICAL_DEMOS.map((d) => {
                  const active = giro === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setGiro(d.id);
                        setGiroError(false);
                      }}
                      className={cn(
                        "min-h-10 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                        active
                          ? "border-brand bg-brand text-white"
                          : "border-black/10 bg-white text-foreground hover:bg-black/5",
                      )}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              {giroError ? (
                <p className="text-xs font-medium text-red-600" role="alert">
                  Elige un giro para continuar.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <MxLocationFields
                state={stateCode}
                city={city}
                onStateChange={setStateCode}
                onCityChange={setCity}
                idPrefix="landing-"
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
              onClick={() => contactSalesQuick("form")}
            >
              Escribir al {salesPhoneDisplay}
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
      <LandingStickyCta onPrimaryClick={scrollToContact} />
      <LandingWhatsAppFab
        phone={salesPhone}
        giroLabel={giro ? getCanonicalDemo(giro)?.label : undefined}
      />
    </main>
  );
}
