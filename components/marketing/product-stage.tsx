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

  function selectTab(id: CanonicalDemoId) {
    setActiveId(id);
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
              onClick={() => selectTab(d.id)}
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

      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-md">
        <div className="flex items-center justify-between gap-2 border-b border-black/5 bg-surface px-3 py-2">
          <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Icon className="h-4 w-4 text-brand" aria-hidden />
            Vista previa · {demo.label}
          </p>
          <Link
            href={`/${demo.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
          >
            Pantalla completa
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="group relative block w-full max-h-72 overflow-hidden bg-[#f3e8dc] sm:max-h-80"
        >
          <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
            <Image
              src={POSTERS[activeId]}
              alt={`Vista previa del menú demo ${demo.label}`}
              fill
              className="object-cover object-top opacity-95 transition group-hover:opacity-100"
              sizes="(max-width: 768px) 100vw, 720px"
              priority={activeId === "restaurante"}
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition group-hover:bg-black/15">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white shadow-lg">
                <Play className="h-4 w-4 fill-current" aria-hidden />
                Cargar demo interactiva
              </span>
            </span>
          </div>
        </button>
      </div>

      <p className="text-center text-xs text-muted md:text-left">
        En la demo: agrega al carrito y pulsa Enviar por WhatsApp — así arma el
        cliente el pedido y así le llega al negocio.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button asChild className="landing-cta min-h-11 flex-1 sm:flex-none">
          <Link href={`/${demo.slug}`}>Ver demo {demo.label}</Link>
        </Button>
        <Button
          asChild
          variant="secondary"
          className="landing-cta min-h-11 flex-1 sm:flex-none"
        >
          <a href={salesUrl} target="_blank" rel="noreferrer">
            {demo.ctaLabel}
          </a>
        </Button>
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
              <a
                href={`/${demo.slug}`}
                target="_blank"
                rel="noreferrer"
              >
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
