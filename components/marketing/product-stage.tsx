"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ExternalLink,
  Play,
  Store,
  UtensilsCrossed,
  Sparkles,
} from "lucide-react";
import {
  CANONICAL_DEMOS,
  getCanonicalDemo,
  salesInterestMessage,
  type CanonicalDemoId,
} from "@/lib/canonical-demos";
import type { LandingDemoPosters } from "@/lib/landing-content";
import { buildWaMeUrl, SALES_WHATSAPP } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ICONS = {
  restaurante: UtensilsCrossed,
  servicios: Sparkles,
  tienda: Store,
} as const;

/** Soft panel theme per vertical — ties tabs + copy into one unit. */
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
  const [modalOpen, setModalOpen] = useState(false);
  const demo = getCanonicalDemo(activeId)!;
  const Icon = ICONS[activeId];
  const theme = PANEL[activeId];
  const posterUrl = demoPosters[activeId]?.trim() || "";
  const salesPhone =
    process.env.NEXT_PUBLIC_SALES_WHATSAPP || SALES_WHATSAPP;
  const salesUrl = buildWaMeUrl(
    salesPhone,
    salesInterestMessage(demo.label),
  );

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
                onClick={() => setActiveId(d.id)}
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

        <div
          className={cn(
            "mt-5 flex flex-col gap-5",
            posterUrl && "sm:flex-row sm:items-start sm:justify-between",
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col items-start text-left">
            <p
              className={cn(
                "flex items-center gap-2 text-xs font-semibold uppercase tracking-wide transition-colors duration-200",
                theme.eyebrow,
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              Prueba el producto
            </p>
            <h3 className="mt-1 font-[family-name:var(--font-display)] text-3xl text-brand-dark sm:text-4xl">
              Menú demo · {demo.label}
            </h3>
            <p className="mt-2 max-w-lg text-sm text-muted">
              Adaptado a {demo.label.toLowerCase()}. Agrega al carrito y pulsa
              Enviar por WhatsApp — así arma el cliente el pedido y así le llega
              al negocio.
            </p>

            <div className="mt-5 flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                type="button"
                className={cn("landing-cta min-h-11", theme.primaryBtn)}
                onClick={() => setModalOpen(true)}
              >
                <Play className="h-4 w-4 fill-current" aria-hidden />
                Cargar demo interactiva
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

          {posterUrl ? (
            <div className="relative mx-auto aspect-[4/3] w-full max-w-[220px] shrink-0 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm sm:mx-0 sm:w-[200px]">
              <Image
                src={posterUrl}
                alt={`Captura demo ${demo.label}`}
                fill
                className="object-cover"
                sizes="220px"
                unoptimized
              />
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="flex max-h-[90dvh] w-[min(100%-1.5rem,42rem)] max-w-3xl flex-col gap-3 overflow-hidden p-4 sm:p-5">
          <DialogHeader className="shrink-0">
            <DialogTitle>Vista previa · {demo.label}</DialogTitle>
            <DialogDescription>
              Prueba el menú sin salir de la landing. Cierra para seguir
              explorando.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-black/10 bg-white">
            {modalOpen ? (
              <iframe
                key={demo.slug}
                title={`Demo ${demo.label}`}
                src={`/${demo.slug}`}
                className="h-[min(70vh,640px)] w-full border-0"
              />
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm" className="min-h-11">
              <a href={`/${demo.slug}`} target="_blank" rel="noreferrer">
                Abrir en pestaña
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => setModalOpen(false)}
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
