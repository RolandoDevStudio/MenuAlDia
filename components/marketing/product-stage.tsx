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

const POSTERS: Record<CanonicalDemoId, string> = {
  restaurante: "/marketing/demo-restaurante.svg",
  servicios: "/marketing/demo-servicios.svg",
  tienda: "/marketing/demo-tienda.svg",
};

type Props = {
  className?: string;
};

export function ProductStage({ className }: Props) {
  const [activeId, setActiveId] =
    useState<CanonicalDemoId>("restaurante");
  const [modalOpen, setModalOpen] = useState(false);
  const demo = getCanonicalDemo(activeId)!;
  const Icon = ICONS[activeId];
  const salesPhone =
    process.env.NEXT_PUBLIC_SALES_WHATSAPP || SALES_WHATSAPP;
  const salesUrl = buildWaMeUrl(
    salesPhone,
    salesInterestMessage(demo.label),
  );

  function openModal() {
    setModalOpen(true);
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className="flex flex-wrap gap-2 rounded-xl border border-black/10 bg-surface/90 p-1.5"
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
                "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:text-sm",
                active
                  ? "bg-brand text-white shadow-sm"
                  : "text-muted hover:bg-black/5 hover:text-foreground",
              )}
            >
              <TabIcon className="h-4 w-4 shrink-0" aria-hidden />
              {d.tabLabel}
            </button>
          );
        })}
      </div>

      <div className="grid items-center gap-5 md:grid-cols-[1fr_minmax(180px,240px)] md:gap-8">
        {/* Copy + CTAs (left on desktop) */}
        <div className="order-2 flex flex-col items-start text-left md:order-1">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand">
            <Icon className="h-3.5 w-3.5" aria-hidden />
            Vista previa
          </p>
          <h3 className="mt-1 font-[family-name:var(--font-display)] text-2xl text-brand-dark sm:text-3xl">
            Prueba el menú de {demo.label}
          </h3>
          <p className="mt-2 max-w-md text-sm text-muted">
            Agrega al carrito y pulsa Enviar por WhatsApp — así arma el cliente
            el pedido y así le llega al negocio.
          </p>

          <div className="mt-4 flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              type="button"
              className="landing-cta min-h-11"
              onClick={openModal}
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
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
          >
            Abrir demo en pestaña
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        {/* Compact phone / wide poster */}
        <div className="order-1 md:order-2 md:justify-self-end">
          {/* Mobile: short landscape strip */}
          <button
            type="button"
            onClick={openModal}
            className="group relative block w-full overflow-hidden rounded-2xl border border-black/10 bg-[#f3e8dc] shadow-md md:hidden"
          >
            <div className="relative h-40 w-full">
              <Image
                src={POSTERS[activeId]}
                alt={`Vista previa del menú demo ${demo.label}`}
                fill
                className="object-cover object-top opacity-95 transition group-hover:opacity-100"
                sizes="100vw"
                priority={activeId === "restaurante"}
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/15">
                <span className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
                  <Play className="h-4 w-4 fill-current" aria-hidden />
                  Ver demo
                </span>
              </span>
            </div>
          </button>

          {/* Desktop: phone frame */}
          <button
            type="button"
            onClick={openModal}
            aria-label={`Cargar demo interactiva de ${demo.label}`}
            className="group relative hidden w-full max-w-[220px] overflow-hidden rounded-[1.75rem] border-2 border-black/10 bg-[#f3e8dc] shadow-lg ring-4 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl md:block"
          >
            <div className="relative aspect-[9/16] max-h-72 w-full">
              <Image
                src={POSTERS[activeId]}
                alt=""
                fill
                className="object-cover object-top opacity-95 transition group-hover:opacity-100"
                sizes="220px"
              />
              <span className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/50 to-transparent px-3 pb-4 pt-10">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-2 text-xs font-semibold text-white shadow-md">
                  <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                  Cargar demo
                </span>
              </span>
            </div>
          </button>
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
