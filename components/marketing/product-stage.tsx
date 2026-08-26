"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Hand,
  Store,
  UtensilsCrossed,
  Sparkles,
} from "lucide-react";
import {
  CANONICAL_DEMOS,
  OFFICIAL_DOMAIN,
  getCanonicalDemo,
  type CanonicalDemoId,
} from "@/lib/canonical-demos";
import { THEME_PRESETS } from "@/lib/theme";
import type { LandingDemoPosters } from "@/lib/landing-content";
import { StorageImage } from "@/components/ui/storage-image";
import { PhoneFrame } from "@/components/marketing/phone-frame";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { trackLandingEvent } from "@/lib/landing-events";
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

function demoTabPrimary(presetKey: string): string {
  return THEME_PRESETS[presetKey]?.colors.primary ?? "#c45c26";
}

/** Target logical width so header chips (redes, Cómo llegar) stay in a row. */
const DEMO_IDEAL_WIDTH_PX = 390;
const DEMO_SCALE_MIN = 0.72;
const DEMO_SCALE_MAX = 0.92;
const DEMO_SCALE_FALLBACK = 0.88;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function scaleFromFrameWidth(widthPx: number) {
  if (widthPx <= 0) return DEMO_SCALE_FALLBACK;
  return clamp(widthPx / DEMO_IDEAL_WIDTH_PX, DEMO_SCALE_MIN, DEMO_SCALE_MAX);
}

type Props = {
  className?: string;
  demoPosters?: LandingDemoPosters;
  onActiveDemoChange?: (id: CanonicalDemoId) => void;
};

/**
 * Hero demo: giro tabs + poster PhoneFrame; tap opens fullscreen demo modal.
 */
export function ProductStage({
  className,
  demoPosters = {},
  onActiveDemoChange,
}: Props) {
  const [activeId, setActiveId] =
    useState<CanonicalDemoId>("restaurante");
  const [modalOpen, setModalOpen] = useState(false);
  const [demoScale, setDemoScale] = useState(DEMO_SCALE_FALLBACK);
  const screenRef = useRef<HTMLDivElement | null>(null);
  const demo = getCanonicalDemo(activeId)!;
  const posterUrl =
    demoPosters[activeId]?.trim() || FALLBACK_POSTERS[activeId];
  const urlLabel = `${OFFICIAL_DOMAIN}/${demo.slug}`;

  useEffect(() => {
    setModalOpen(false);
  }, [activeId]);

  useEffect(() => {
    onActiveDemoChange?.(activeId);
    // Intentionally only on mount: parent defaults giro; tabs call below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!modalOpen) return;

    let ro: ResizeObserver | null = null;
    let cancelled = false;
    let raf = 0;

    const attach = () => {
      const el = screenRef.current;
      if (!el) {
        raf = requestAnimationFrame(attach);
        return;
      }
      if (cancelled) return;

      const update = () => {
        setDemoScale(scaleFromFrameWidth(el.getBoundingClientRect().width));
      };
      update();
      ro = new ResizeObserver(update);
      ro.observe(el);
    };

    attach();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [modalOpen]);

  function openDemoModal() {
    trackLandingEvent("demo_open");
    setModalOpen(true);
  }

  function selectTab(id: CanonicalDemoId) {
    setActiveId(id);
    setModalOpen(false);
    onActiveDemoChange?.(id);
  }

  return (
    <div id="demo-stage" className={cn("w-full scroll-mt-24", className)}>
      <div
        className="flex gap-1 rounded-xl border border-black/10 bg-white/90 p-1"
        role="tablist"
        aria-label="Giro del negocio"
      >
        {CANONICAL_DEMOS.map((d) => {
          const TabIcon = ICONS[d.id];
          const active = d.id === activeId;
          const primary = demoTabPrimary(d.themePreset);
          return (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(d.id)}
              className={cn(
                "inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors duration-200 sm:gap-2 sm:text-sm",
                active
                  ? "text-white shadow-sm"
                  : "text-muted hover:bg-black/5 hover:text-foreground",
              )}
              style={active ? { backgroundColor: primary } : undefined}
            >
              <TabIcon
                className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
                aria-hidden
              />
              {d.tabLabel}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex justify-center">
        <PhoneFrame urlLabel={urlLabel}>
          <div className="absolute inset-0">
            <StorageImage
              src={posterUrl}
              alt={`Captura demo ${demo.label}`}
              fill
              sizes="375px"
              priority
              className="object-cover object-top"
            />
            <button
              type="button"
              onClick={openDemoModal}
              className="absolute inset-0 z-10 flex cursor-pointer items-end justify-center bg-transparent p-3 pb-5"
              aria-label="Toca para probar la demo interactiva"
            >
              <span className="pointer-events-auto inline-flex max-w-[95%] items-center gap-2 rounded-full border border-white/40 bg-slate-900/70 px-3 py-2 text-left text-[11px] font-semibold leading-snug text-white shadow-lg backdrop-blur-md">
                <Hand className="h-4 w-4 shrink-0" aria-hidden />
                Toca para probar la demo
              </span>
            </button>
          </div>
        </PhoneFrame>
      </div>

      <p className="mt-2 text-center">
        <Link
          href={`/${demo.slug}`}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackLandingEvent("demo_open")}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-foreground hover:underline"
        >
          Abrir en pestaña
          <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      </p>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogPortal>
          <DialogOverlay className="bg-slate-950/90" />
          <DialogPrimitive.Content
            className={cn(
              "fixed inset-0 z-50 flex h-dvh w-screen flex-col outline-none",
              "bg-slate-950 text-white",
            )}
            aria-describedby={undefined}
          >
            <DialogTitle className="sr-only">
              Demo interactiva · {demo.label}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Vista previa del menú {demo.label}. Usa Regresar atrás para volver
              a la landing.
            </DialogDescription>

            <header className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-slate-950/95 px-3 py-2.5 sm:px-4">
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 gap-2 bg-white text-slate-900 hover:bg-white/90"
                onClick={() => setModalOpen(false)}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Regresar atrás
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  Demo · {demo.label}
                </p>
                <p className="truncate font-mono text-[11px] text-slate-400">
                  {urlLabel}
                </p>
              </div>
            </header>

            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2 sm:p-4">
              <PhoneFrame
                fitContain
                urlLabel={urlLabel}
                className="h-full w-full [&_p]:text-slate-400"
              >
                <div
                  ref={screenRef}
                  className="absolute inset-0 overflow-hidden bg-white"
                >
                  <iframe
                    key={demo.slug}
                    title={`Demo ${demo.label}`}
                    src={`/${demo.slug}`}
                    className="absolute left-0 top-0 origin-top-left border-0 bg-white"
                    style={{
                      width: `${100 / demoScale}%`,
                      height: `${100 / demoScale}%`,
                      transform: `scale(${demoScale})`,
                    }}
                  />
                </div>
              </PhoneFrame>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </div>
  );
}
