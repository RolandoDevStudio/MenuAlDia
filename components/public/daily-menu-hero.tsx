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
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";

const DRAG_THRESHOLD_PX = 10;
const PROGRAMMATIC_LOCK_MS = 400;
const ADDED_MS = 1400;
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
  sideLabel?: string;
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

function GiroIcon({
  giro,
  className,
}: {
  giro: BusinessType;
  className?: string;
}) {
  const Icon =
    giro === "servicios"
      ? Sparkles
      : giro === "productos"
        ? ShoppingBag
        : UtensilsCrossed;
  return <Icon className={className} strokeWidth={1.5} aria-hidden />;
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
  sideLabel = "Guarnición",
  dishLabel = "Opción",
  businessType,
}: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const [selectedSides, setSelectedSides] = useState<string[]>([]);
  const [activeDishId, setActiveDishId] = useState(dishes[0]?.id ?? "");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  const [justAdded, setJustAdded] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const programmaticLock = useRef(false);
  const lockTimer = useRef<number>(0);
  const addedTimer = useRef<number>(0);

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

  const snapTo = useCallback((id: string) => {
    const track = trackRef.current;
    const card = track?.querySelector<HTMLElement>(`[data-dish-id="${id}"]`);
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
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(lockTimer.current);
      window.clearTimeout(addedTimer.current);
    };
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
    const cards = [...track.querySelectorAll<HTMLElement>("[data-dish-id]")];
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

  useEffect(() => {
    setExpandedIds(new Set());
  }, [activeDishId]);

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

  function wasDrag(e: MouseEvent) {
    const start = pointerStart.current;
    if (!start) return false;
    return (
      Math.abs(e.clientX - start.x) > DRAG_THRESHOLD_PX ||
      Math.abs(e.clientY - start.y) > DRAG_THRESHOLD_PX
    );
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set<string>();
      if (!prev.has(id)) next.add(id);
      return next;
    });
  }

  function handleCardClick(id: string, e: MouseEvent) {
    if (wasDrag(e)) return;
    if (multi && id !== activeDishId) {
      e.preventDefault();
      snapTo(id);
      return;
    }
    const dish = dishes.find((d) => d.id === id);
    if (!dish?.description?.trim()) return;
    toggleExpanded(id);
  }

  function addToCart() {
    if (justAdded) return;
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
    setJustAdded(true);
    window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => {
      setJustAdded(false);
    }, ADDED_MS);
  }

  return (
    <section className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <GiroIcon giro={giro} className="h-5 w-5 shrink-0 text-brand" />
          <h2 className="font-display text-2xl leading-none text-brand-dark">
            {dailyMenuLabel}
          </h2>
        </div>
        {multi ? (
          <p className="mt-1 text-xs text-muted">Desliza para ver más</p>
        ) : null}
      </div>

      <div className="relative">
        {multi ? (
          <>
            <button
              type="button"
              className="absolute -left-1 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-dark shadow-md ring-1 ring-black/5 hover:bg-white disabled:opacity-40 md:flex"
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
              className="absolute -right-1 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-dark shadow-md ring-1 ring-black/5 hover:bg-white disabled:opacity-40 md:flex"
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
            "flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden",
            "scrollbar-none [&::-webkit-scrollbar]:hidden",
            multi ? "-mx-4 scroll-ps-[7.5%] px-[7.5%]" : "",
          )}
        >
          {dishes.map((dish, index) => {
            const expanded = expandedIds.has(dish.id);
            const price = cardPrice(dish);
            const hasDesc = Boolean(dish.description?.trim());
            const isActive = dish.id === active.id;
            const tappable = hasDesc || (multi && !isActive);
            return (
              <article
                key={dish.id}
                data-dish-id={dish.id}
                className={cn(
                  "relative aspect-4/5 shrink-0 snap-start overflow-hidden shadow-lg",
                  mediaFrame,
                  multi ? "w-[85%]" : "w-full",
                  tappable && "cursor-pointer",
                )}
                aria-expanded={hasDesc ? expanded : undefined}
                tabIndex={hasDesc && isActive ? 0 : undefined}
                onPointerDown={handlePointerDown}
                onClick={(e) => handleCardClick(dish.id, e)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  if (!hasDesc || !isActive) return;
                  e.preventDefault();
                  toggleExpanded(dish.id);
                }}
              >
                {dish.photo_url ? (
                  <StorageImage
                    src={dish.photo_url}
                    alt={dish.name}
                    fill
                    sizes={CARD_IMAGE_SIZES}
                    priority={index === 0}
                    className="pointer-events-none"
                  />
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 55%, black))",
                    }}
                  >
                    <GiroIcon
                      giro={giro}
                      className="h-14 w-14 text-white drop-shadow-md"
                    />
                    <span className="sr-only">{dish.name}</span>
                  </div>
                )}

                <div
                  className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/40 to-transparent"
                  aria-hidden
                />

                {expanded && hasDesc ? (
                  <div
                    className="pointer-events-none absolute inset-0 z-10 flex flex-col bg-black/80 p-4 text-white"
                  >
                    <h3 className="font-display text-2xl leading-tight">
                      {dish.name}
                    </h3>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-white/90">
                      {dish.description}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <p
                        className="text-lg font-semibold"
                        style={{
                          color:
                            "color-mix(in srgb, var(--color-primary) 28%, white)",
                        }}
                      >
                        {formatMxn(price).replace("MX$", "$")}
                      </p>
                      <span className="inline-flex min-h-8 shrink-0 items-center rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm">
                        Ver menos
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-white">
                    <h3 className="line-clamp-2 font-display text-2xl leading-tight drop-shadow-sm">
                      {dish.name}
                    </h3>
                    {hasDesc ? (
                      <p className="mt-1 line-clamp-2 text-sm text-white/90">
                        {dish.description}
                      </p>
                    ) : null}
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <p
                        className="text-lg font-semibold drop-shadow-sm"
                        style={{
                          color:
                            "color-mix(in srgb, var(--color-primary) 28%, white)",
                        }}
                      >
                        {formatMxn(price).replace("MX$", "$")}
                      </p>
                      {hasDesc ? (
                        <span className="inline-flex min-h-8 shrink-0 items-center gap-0.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm">
                          Ver más
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>

      {multi ? (
        <div
          className="mt-3 flex justify-center gap-1.5"
          role="group"
          aria-label={dailyMenuLabel}
        >
          {dishes.map((dish, index) => {
            const current = dish.id === active.id;
            return (
              <button
                key={dish.id}
                type="button"
                aria-label={`${dishLabel} ${index + 1} de ${dishes.length}`}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "h-2 rounded-full transition-[width,background-color]",
                  current
                    ? "w-5 bg-(--color-primary)"
                    : "w-2 bg-black/20",
                )}
                onClick={() => snapTo(dish.id)}
              />
            );
          })}
        </div>
      ) : null}

      {sides.length > 0 ? (
        <div className="mt-5">
          <SideChecklist
            sides={sides}
            maxSides={maxSides}
            value={selectedSides}
            onChange={setSelectedSides}
            sidesLabel={sidesLabel}
            sideLabel={sideLabel}
          />
        </div>
      ) : null}

      <Button
        className={cn(
          "mt-5 w-full",
          justAdded && "bg-emerald-600 hover:bg-emerald-600 menu-quick-flash",
        )}
        size="lg"
        disabled={justAdded}
        onClick={addToCart}
      >
        {justAdded ? (
          <>
            <Check className="h-5 w-5" aria-hidden />
            ¡Agregado!
          </>
        ) : (
          `Agregar · ${formatMxn(linePrice)}`
        )}
      </Button>
    </section>
  );
}
