"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ImageIcon, Smartphone, MessageCircle } from "lucide-react";
import {
  PLAN_LABELS,
  PLAN_PRICES_MXN,
  annualPrice,
  dailyValue,
  type PlanType,
} from "@/lib/plans";
import { formatMxn } from "@/lib/money";
import { buildWaMeUrl, SALES_WHATSAPP } from "@/lib/whatsapp";
import { BrandLogo } from "@/components/brand/brand-logo";
import { LandingNav } from "@/components/marketing/landing-nav";
import { LandingWhatsAppFab } from "@/components/marketing/landing-whatsapp-fab";
import { Reveal } from "@/components/marketing/reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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

export default function HomePage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [city, setCity] = useState("");
  const [note, setNote] = useState("");

  const salesPhone =
    process.env.NEXT_PUBLIC_SALES_WHATSAPP || SALES_WHATSAPP;

  const plans = useMemo(
    () => (["catalog", "daily", "pro"] as PlanType[]),
    [],
  );

  function contactSales(plan?: PlanType) {
    const lines = [
      "*Prospecto Menú al Día*",
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
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="landing-aurora absolute -inset-[6%]" />
      </div>

      <LandingNav onContactClick={scrollToContact} />

      <section className="mx-auto max-w-3xl px-6 pb-12 pt-10 sm:pt-14">
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
          Hecho para restaurantes y negocios locales que viven de
          listas de difusión — no de apps de delivery.
        </p>
        <div
          className="mt-8 flex flex-wrap gap-3 motion-safe:animate-[rise_0.7s_ease-out]"
          style={{ animationDelay: "240ms", animationFillMode: "both" }}
        >
          <Link
            href="/demo-restaurante"
            className="landing-cta rounded-lg bg-brand px-5 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark hover:shadow-md"
          >
            Ver demo restaurante
          </Link>
          <Link
            href="/demo-estetica"
            className="landing-cta rounded-lg border border-brand/30 bg-surface px-5 py-3.5 text-sm font-semibold text-brand-dark hover:bg-white hover:shadow-sm"
          >
            Ver demo estética
          </Link>
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("precios")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="landing-cta rounded-lg px-5 py-3.5 text-sm font-semibold text-muted underline-offset-4 hover:text-brand hover:underline"
          >
            Ver precios
          </button>
        </div>
      </section>

      <section
        id="beneficios"
        className="mx-auto max-w-3xl scroll-mt-20 px-6 py-10"
      >
        <Reveal>
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-brand-dark">
            Por qué te conviene
          </h2>
          <p className="mt-1 text-sm text-muted">
            Simple, eficiente y pensado para el ritmo de un negocio local.
          </p>
        </Reveal>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} as="li" delayMs={i * 90}>
              <div className="landing-card h-full rounded-2xl bg-surface/80 px-4 py-4 shadow-sm shadow-transparent hover:shadow-md">
                <Icon className="h-6 w-6 text-brand" aria-hidden />
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>

      <section id="demos" className="mx-auto max-w-3xl scroll-mt-20 px-6 py-10">
        <Reveal>
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-brand-dark">
            Pruébalo en vivo
          </h2>
          <p className="mt-1 text-sm text-muted">
            Tres demos: restaurante, servicios y productos. Mismo producto,
            vocabulario distinto según el giro.
          </p>
        </Reveal>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Reveal delayMs={0}>
            <Link
              href="/demo-restaurante"
              className="landing-card group block rounded-2xl border border-brand/20 bg-white p-5 hover:border-brand hover:shadow-md"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand">
                Restaurante
              </p>
              <p className="mt-2 font-[family-name:var(--font-display)] text-3xl text-brand-dark transition-colors group-hover:text-brand">
                Demo restaurante
              </p>
              <p className="mt-1 text-sm text-muted">
                Menú del día, combos y pedidos por WhatsApp.
              </p>
            </Link>
          </Reveal>
          <Reveal delayMs={90}>
            <Link
              href="/demo-estetica"
              className="landing-card group block rounded-2xl border border-black/10 bg-surface/90 p-5 hover:border-brand/40 hover:shadow-md"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Servicios
              </p>
              <p className="mt-2 font-[family-name:var(--font-display)] text-3xl text-brand-dark transition-colors group-hover:text-brand">
                Demo estética
              </p>
              <p className="mt-1 text-sm text-muted">
                Servicios y opciones con menú digital.
              </p>
            </Link>
          </Reveal>
          <Reveal delayMs={180}>
            <Link
              href="/demo-productos"
              className="landing-card group block rounded-2xl border border-black/10 bg-surface/90 p-5 hover:border-brand/40 hover:shadow-md"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Productos
              </p>
              <p className="mt-2 font-[family-name:var(--font-display)] text-3xl text-brand-dark transition-colors group-hover:text-brand">
                Demo abarrotes
              </p>
              <p className="mt-1 text-sm text-muted">
                Catálogo retail y colecciones express.
              </p>
            </Link>
          </Reveal>
        </div>
      </section>

      <section
        id="precios"
        className="mx-auto max-w-3xl scroll-mt-20 px-6 py-10"
      >
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-3xl text-brand-dark">
                Planes claros
              </h2>
              <p className="mt-1 text-sm text-muted">
                Desde {formatMxn(dailyValue(199))} al día.
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

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {plans.map((plan, i) => {
            const monthly = PLAN_PRICES_MXN[plan];
            const price =
              billing === "annual" ? annualPrice(monthly) : monthly;
            const period = billing === "annual" ? "/año" : "/mes";
            const highlight = plan === "daily";
            return (
              <Reveal key={plan} delayMs={i * 90}>
                <div
                  className={`landing-card h-full rounded-2xl border p-4 ${highlight ? "border-brand bg-white shadow-md" : "border-black/10 bg-surface/90 hover:border-brand/30 hover:shadow-md"}`}
                >
                  {highlight ? (
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-brand">
                      Más popular
                    </p>
                  ) : null}
                  <p className="font-semibold">{PLAN_LABELS[plan]}</p>
                  <p className="mt-2 font-[family-name:var(--font-display)] text-4xl text-brand transition-opacity duration-300">
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
      </section>

      <section
        id="contacto"
        className="mx-auto max-w-lg scroll-mt-20 px-6 py-10"
      >
        <Reveal>
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-brand-dark">
            Habla con nosotros
          </h2>
          <p className="mt-1 text-sm text-muted">
            Te respondemos por WhatsApp y te activamos en el mismo día.
          </p>
        </Reveal>
        <Reveal delayMs={100} className="mt-4 space-y-3">
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
      </section>

      <footer className="mx-auto max-w-3xl border-t border-black/5 px-6 py-8 text-xs text-muted">
        <BrandLogo variant="lockup" size="sm" href={null} />
        <p className="mt-2">menualdia.app · SaaS para negocios locales</p>
        <div className="mt-4 flex flex-wrap gap-4">
          <Link href="/admin/login" className="transition-colors hover:text-brand">
            Entrar al admin
          </Link>
          <Link href="/privacidad" className="transition-colors hover:text-brand">
            Privacidad
          </Link>
          <Link href="/terminos" className="transition-colors hover:text-brand">
            Términos
          </Link>
          <Link
            href="/demo-restaurante"
            className="transition-colors hover:text-brand"
          >
            Demo restaurante
          </Link>
          <Link
            href="/demo-estetica"
            className="transition-colors hover:text-brand"
          >
            Demo estética
          </Link>
          <Link
            href="/demo-productos"
            className="transition-colors hover:text-brand"
          >
            Demo productos
          </Link>
        </div>
      </footer>
      <LandingWhatsAppFab />
    </main>
  );
}
