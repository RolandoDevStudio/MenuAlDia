"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Hand,
  Play,
  Store,
  UtensilsCrossed,
  Sparkles,
} from "lucide-react";
import {
  CANONICAL_DEMOS,
  OFFICIAL_DOMAIN,
  getCanonicalDemo,
  salesInterestMessage,
  type CanonicalDemoId,
} from "@/lib/canonical-demos";
import type { LandingDemoPosters } from "@/lib/landing-content";
import { buildWaMeUrl, SALES_WHATSAPP } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { StorageImage } from "@/components/ui/storage-image";
import { PhoneFrame } from "@/components/marketing/phone-frame";
import { cn } from "@/lib/utils";

const ICONS = {
  restaurante: UtensilsCrossed,
  servicios: Sparkles,
  tienda: Store,
} as const;

const FALLBACK_POSTERS: Record<CanonicalDemoId, string> = {
  restaurante: "/marketing/demo-restaurante.svg",
  servicios: "/marketing/demo-servicios.svg",
  tienda: "/marketing/demo-tienda.svg",
};

const PANEL: Record<
  CanonicalDemoId,
  {
    shell: string;
    tabActive: string;
    eyebrow: string;
    primaryBtn: string;
    link: string;
  }
> = {
  restaurante: {
    shell:
      "border-brand/25 bg-gradient-to-br from-brand/[0.09] via-white/90 to-white border-t-brand",
    tabActive: "bg-brand text-white shadow-sm",
    eyebrow: "text-brand",
    primaryBtn: "bg-brand text-white hover:bg-brand-dark",
    link: "text-brand",
  },
  servicios: {
    shell:
      "border-accent/30 bg-gradient-to-br from-accent/[0.10] via-white/90 to-white border-t-accent",
    tabActive: "bg-accent text-white shadow-sm",
    eyebrow: "text-accent",
    primaryBtn: "bg-accent text-white hover:bg-accent/90",
    link: "text-accent",
  },
  tienda: {
    shell:
      "border-amber-600/30 bg-gradient-to-br from-amber-500/[0.10] via-white/90 to-white border-t-amber-600",
    tabActive: "bg-amber-700 text-white shadow-sm",
    eyebrow: "text-amber-800",
    primaryBtn: "bg-amber-700 text-white hover:bg-amber-800",
    link: "text-amber-800",
  },
};

type Props = {
  className?: string;
  demoPosters?: LandingDemoPosters;
};

export function ProductStage({ className, demoPosters = {} }: Props) {
  const [activeId, setActiveId] =
    useState<CanonicalDemoId>("restaurante");
  const [isInteractive, setIsInteractive] = useState(false);
  const demo = getCanonicalDemo(activeId)!;
  const Icon = ICONS[activeId];
  const theme = PANEL[activeId];
  const posterUrl =
    demoPosters[activeId]?.trim() || FALLBACK_POSTERS[activeId];
  const urlLabel = `${OFFICIAL_DOMAIN}/${demo.slug}`;
  const salesPhone =
    process.env.NEXT_PUBLIC_SALES_WHATSAPP || SALES_WHATSAPP;
  const salesUrl = buildWaMeUrl(
    salesPhone,
    salesInterestMessage(demo.label),
  );

  useEffect(() => {
    setIsInteractive(false);
  }, [activeId]);

  function activateDemo() {
    setIsInteractive(true);
  }

  function selectTab(id: CanonicalDemoId) {
    setActiveId(id);
    setIsInteractive(false);
  }

  return (
    <div className={cn(className)}>
      <div
        className={cn(
          "rounded-2xl border border-t-4 p-4 shadow-sm transition-[background,border-color] duration-200 motion-reduce:transition-none sm:p-5",
          theme.shell,
        )}
      >
        <div
          className="flex flex-wrap gap-2 rounded-xl border border-black/10 bg-white/85 p-1.5"
          role="tablist"
          aria-label="Giro del negocio"
        >
          {CANONICAL_DEMOS.map((d) => {
            const TabIcon = ICONS[d.id];
            const active = d.id === activeId;
            return (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(d.id)}
                className={cn(
                  "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors duration-200 sm:text-sm",
                  active
                    ? theme.tabActive
                    : "text-muted hover:bg-black/5 hover:text-foreground",
                )}
              >
                <TabIcon className="h-4 w-4 shrink-0" aria-hidden />
                {d.tabLabel}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          <div className="flex min-w-0 flex-1 flex-col items-start text-left lg:max-w-md lg:pt-2">
            <p
              className={cn(
                "flex items-center gap-2 text-xs font-semibold uppercase tracking-wide transition-colors duration-200",
                theme.eyebrow,
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              Prueba el producto
            </p>
            <p className="mt-1 text-lg font-semibold text-brand-dark sm:text-xl">
              Demo · {demo.label}
            </p>
            <p className="mt-2 max-w-lg text-sm text-muted">
              Adaptado a {demo.label.toLowerCase()}. Explora el menú en el
              teléfono; en la demo los envíos por WhatsApp están simulados.
            </p>

            <div className="mt-5 flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                type="button"
                className={cn("landing-cta min-h-11", theme.primaryBtn)}
                onClick={activateDemo}
              >
                <Play className="h-4 w-4 fill-current" aria-hidden />
                {isInteractive
                  ? "Demo interactiva activa"
                  : "Cargar demo interactiva"}
              </Button>
              <Button
                asChild
                variant="secondary"
                className="landing-cta min-h-11"
              >
                <a href={salesUrl} target="_blank" rel="noreferrer">
                  {demo.ctaLabel}
                </a>
              </Button>
            </div>

            <Link
              href={`/${demo.slug}`}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "mt-3 inline-flex items-center gap-1 text-sm font-semibold transition-colors hover:underline",
                theme.link,
              )}
            >
              Abrir demo en pestaña
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>

          <div className="flex w-full justify-center py-6 md:min-h-[700px] md:py-8 lg:w-auto lg:shrink-0">
            <PhoneFrame urlLabel={urlLabel}>
              <div className="absolute inset-0">
                <div
                  className={cn(
                    "absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none",
                    isInteractive
                      ? "pointer-events-none opacity-0"
                      : "opacity-100",
                  )}
                  aria-hidden={isInteractive}
                >
                  <StorageImage
                    src={posterUrl}
                    alt={`Captura demo ${demo.label}`}
                    fill
                    sizes="375px"
                    className="object-cover object-top"
                  />
                </div>

                {isInteractive ? (
                  <iframe
                    key={demo.slug}
                    title={`Demo ${demo.label}`}
                    src={`/${demo.slug}`}
                    className="absolute inset-0 h-full w-full border-0 bg-white"
                  />
                ) : null}

                {!isInteractive ? (
                  <button
                    type="button"
                    onClick={activateDemo}
                    className="absolute inset-0 z-10 flex cursor-pointer items-end justify-center bg-transparent p-3 pb-5"
                    aria-label="Toca para probar la demo interactiva"
                  >
                    <span className="pointer-events-auto inline-flex max-w-[95%] items-center gap-2 rounded-full border border-white/40 bg-slate-900/70 px-3 py-2 text-left text-[11px] font-semibold leading-snug text-white shadow-lg backdrop-blur-md">
                      <Hand className="h-4 w-4 shrink-0" aria-hidden />
                      Toca para probar la demo interactiva
                    </span>
                  </button>
                ) : null}
              </div>
            </PhoneFrame>
          </div>
        </div>
      </div>
    </div>
  );
}
