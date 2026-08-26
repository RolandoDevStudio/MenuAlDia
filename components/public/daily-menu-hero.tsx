"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import type { BusinessType, Dish } from "@/lib/types";
import type { PhotoFrame } from "@/lib/theme";
import { photoFrameClass } from "@/lib/theme";
import { formatMxn } from "@/lib/money";
import { normalizeBusinessType } from "@/lib/business-labels";
import { useCartStore } from "@/stores/cart-store";
import { SideChecklist } from "@/components/public/side-checklist";
import { Button } from "@/components/ui/button";
import { StorageImage } from "@/components/ui/storage-image";
import { cn } from "@/lib/utils";
import { ZoomableMenuPhoto } from "@/components/public/zoomable-menu-photo";
import {
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";

const DRAG_THRESHOLD_PX = 10;
const PROGRAMMATIC_LOCK_MS = 400;
const CARD_IMAGE_SIZES = "(max-width: 640px) 85vw, 420px";

type Props = {
  dishes: Dish[];
  sides: Dish[];
  packagePrice: number;
  maxSides: number;
  pricingMode?: "package" | "individual";
  photoFrame?: PhotoFrame;
  dailyMenuLabel?: string;
  sidesLabel?: string;
  dishesLabel?: string;
  dishLabel?: string;
  businessType?: BusinessType | string | null;
};

function scrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined") return "smooth";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

function carouselFrameClass(frame: PhotoFrame): string {
  if (frame === "circle_avatar") return "rounded-2xl";
  return photoFrameClass(frame)
    .replace("object-cover", "")
    .replace("aspect-square", "")
    .trim();
}

function GiroFallbackIcon({ giro }: { giro: BusinessType }) {
  const Icon =
    giro === "servicios"
      ? Sparkles
      : giro === "productos"
        ? ShoppingBag
        : UtensilsCrossed;
  return (
    <Icon
      className="h-14 w-14 text-white drop-shadow-md"
      strokeWidth={1.5}
      aria-hidden
    />
  );
}

export function DailyMenuHero({
  dishes,
  sides,
  packagePrice,
  maxSides,
  pricingMode = "package",
  photoFrame = "rounded_modern",
  dailyMenuLabel = "Especiales de hoy",
  sidesLabel = "Guarniciones",
  dishLabel = "Opción",
  businessType,
}: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const [selectedSides, setSelectedSides] = useState<string[]>([]);
  const [activeDishId, setActiveDishId] = useState(dishes[0]?.id ?? "");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const trackRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const programmaticLock = useRef(false);
  const lockTimer = useRef<number>(0);

  const giro = normalizeBusinessType(businessType);
  const multi = dishes.length > 1;
  const active = dishes.find((d) => d.id === activeDishId) ?? dishes[0];
  const activeIndex = Math.max(
    0,
    dishes.findIndex((d) => d.id === (active?.id ?? "")),
  );
  const linePrice =
    pricingMode === "individual"
      ? Number(active?.price) || 0
      : packagePrice;
  const dishWord = dishLabel.toLowerCase();
  const mediaFrame = carouselFrameClass(photoFrame);

  const updateEnds = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setAtStart(track.scrollLeft <= 4);
    setAtEnd(track.scrollLeft + track.clientWidth >= track.scrollWidth - 4);
  }, []);

  const snapTo = useCallback(
    (id: string) => {
      const track = trackRef.current;
      const card = track?.querySelector<HTMLElement>(
        `[data-dish-id="${id}"]`,
      );
      setActiveDishId(id);
      if (!track || !card) return;
      programmaticLock.current = true;
      window.clearTimeout(lockTimer.current);
      const pad = Number.parseFloat(getComputedStyle(track).paddingLeft) || 0;
      track.scrollTo({
        left: card.offsetLeft - pad,
        behavior: scrollBehavior(),
      });
      lockTimer.current = window.setTimeout(() => {
        programmaticLock.current = false;
      }, PROGRAMMATIC_LOCK_MS);
    },
    [],
  );

  useEffect(() => {
    return () => window.clearTimeout(lockTimer.current);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateEnds();
    track.addEventListener("scroll", updateEnds, { passive: true });
    return () => track.removeEventListener("scroll", updateEnds);
  }, [dishes.length, updateEnds]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !multi) return;
    const cards = [
      ...track.querySelectorAll<HTMLElement>("[data-dish-id]"),
    ];
    const io = new IntersectionObserver(
      (entries) => {
        if (programmaticLock.current) return;
        const best = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = (best?.target as HTMLElement | undefined)?.dataset.dishId;
        if (id) setActiveDishId(id);
      },
      { root: track, threshold: [0.55, 0.6, 0.75] },
    );
    cards.forEach((card) => io.observe(card));
    return () => io.disconnect();
  }, [dishes, multi]);

  if (dishes.length === 0 || !active) {
    return null;
  }

  function cardPrice(dish: Dish): number {
    return pricingMode === "individual"
      ? Number(dish.price) || 0
      : packagePrice;
  }

  function handlePointerDown(e: PointerEvent) {
    pointerStart.current = { x: e.clientX, y: e.clientY };
  }

  function handleCardClick(id: string, e: MouseEvent) {
    if (!multi || id === activeDishId) return;
    const start = pointerStart.current;
    if (start) {
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) return;
    }
    e.preventDefault();
    snapTo(id);
  }

  function toggleExpanded(id: string, e: MouseEvent) {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addToCart() {
    const sideNames = sides
      .filter((s) => selectedSides.includes(s.id))
      .map((s) => s.name);
    addItem({
      dishId: active.id,
      name: `${dailyMenuLabel}: ${active.name}`,
      unitPrice: linePrice,
      quantity: 1,
      sideIds: selectedSides,
      sideNames,
      isDailyMenu: true,
    });
  }

  let step = 1;

  return (
    <section className="mx-auto max-w-lg px-4 py-6">
      <ol className="mb-3 space-y-1 rounded-xl bg-surface/80 px-3 py-2 text-xs text-muted">
        <li>
          <span className="font-semibold text-foreground">{step++}.</span> Elige
          tu {dishWord}
          {multi ? " (desliza para elegir)" : ""}
        </li>
        {sides.length > 0 ? (
          <li>
            <span className="font-semibold text-foreground">{step++}.</span>{" "}
            Elige hasta {maxSides} {sidesLabel.toLowerCase()}
          </li>
        ) : null}
        <li>
          <span className="font-semibold text-foreground">{step}.</span> Agrega
          al carrito
        </li>
      </ol>

      <h2 className="mb-3 font-display text-2xl leading-none text-brand-dark">
        {dailyMenuLabel}
      </h2>

      <div className="relative">
        {multi ? (
          <>
            <button
              type="button"
              className="absolute -left-1 top-28 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-dark shadow-md ring-1 ring-black/5 hover:bg-white disabled:opacity-40 md:flex"
              aria-label={`Anterior ${dishWord}`}
              aria-disabled={atStart}
              disabled={atStart}
              onClick={() => {
                const prev = dishes[activeIndex - 1];
                if (prev) snapTo(prev.id);
              }}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              className="absolute -right-1 top-28 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-dark shadow-md ring-1 ring-black/5 hover:bg-white disabled:opacity-40 md:flex"
              aria-label={`Siguiente ${dishWord}`}
              aria-disabled={atEnd}
              disabled={atEnd}
              onClick={() => {
                const next = dishes[activeIndex + 1];
                if (next) snapTo(next.id);
              }}
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        ) : null}

        <div
          ref={trackRef}
          className={cn(
            "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden px-4",
            "scrollbar-none [&::-webkit-scrollbar]:hidden",
          )}
        >
          {dishes.map((dish, index) => {
            const isActive = dish.id === active.id;
            const expanded = expandedIds.has(dish.id);
            const price = cardPrice(dish);
            return (
              <article
                key={dish.id}
                data-dish-id={dish.id}
                className={cn(
                  "flex shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-black/5 bg-surface shadow-sm",
                  multi ? "w-[85%]" : "w-full",
                  isActive ? "ring-1 ring-brand/30" : "",
                )}
                onPointerDown={handlePointerDown}
                onClick={(e) => handleCardClick(dish.id, e)}
              >
                <div
                  className={cn(
                    "relative aspect-video w-full overflow-hidden",
                    mediaFrame,
                  )}
                >
                  {dish.photo_url && isActive ? (
                    <ZoomableMenuPhoto
                      src={dish.photo_url}
                      alt={dish.name}
                      className="h-full w-full"
                      sizes={CARD_IMAGE_SIZES}
                      priority={index === 0}
                    />
                  ) : dish.photo_url ? (
                    <StorageImage
                      src={dish.photo_url}
                      alt={dish.name}
                      fill
                      sizes={CARD_IMAGE_SIZES}
                      className="pointer-events-none"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 55%, black))",
                      }}
                    >
                      <GiroFallbackIcon giro={giro} />
                      <span className="sr-only">{dish.name}</span>
                    </div>
                  )}
                </div>

                <div className="flex min-h-34 flex-1 flex-col px-3 pb-3 pt-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-h-10 line-clamp-2 font-display text-xl leading-tight text-brand-dark">
                      {dish.name}
                    </h3>
                    <p className="shrink-0 text-base font-semibold text-foreground">
                      {formatMxn(price).replace("MX$", "$")}
                    </p>
                  </div>
                  <div className="mt-1 min-h-11">
                    {dish.description ? (
                      expanded ? (
                        <p className="max-h-18 overflow-y-auto text-sm text-muted">
                          {dish.description}
                        </p>
                      ) : (
                        <p className="line-clamp-2 text-sm text-muted">
                          {dish.description}
                        </p>
                      )
                    ) : null}
                  </div>
                  <div className="mt-auto min-h-5 pt-1">
                    {dish.description ? (
                      <button
                        type="button"
                        className="inline-flex min-h-8 items-center gap-0.5 text-xs font-semibold text-brand"
                        onClick={(e) => toggleExpanded(dish.id, e)}
                      >
                        {expanded ? "Ver menos" : "Ver más"}
                        <ChevronRight
                          className={cn(
                            "h-3.5 w-3.5 transition-transform",
                            expanded && "rotate-90",
                          )}
                          aria-hidden
                        />
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {sides.length > 0 ? (
        <div className="mt-5">
          <SideChecklist
            sides={sides}
            maxSides={maxSides}
            value={selectedSides}
            onChange={setSelectedSides}
            sidesLabel={sidesLabel}
          />
        </div>
      ) : null}

      <Button className="mt-5 w-full" size="lg" onClick={addToCart}>
        Agregar · {formatMxn(linePrice)}
      </Button>
    </section>
  );
}
