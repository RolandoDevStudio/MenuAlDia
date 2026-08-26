"use client";

import { useState } from "react";
import type { Dish } from "@/lib/types";
import type { PhotoFrame } from "@/lib/theme";
import { photoFrameClass } from "@/lib/theme";
import { formatMxn } from "@/lib/money";
import { useCartStore } from "@/stores/cart-store";
import { SideChecklist } from "@/components/public/side-checklist";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ZoomableMenuPhoto } from "@/components/public/zoomable-menu-photo";

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
};

export function DailyMenuHero({
  dishes,
  sides,
  packagePrice,
  maxSides,
  pricingMode = "package",
  photoFrame = "rounded_modern",
  dailyMenuLabel = "Especiales de hoy",
  sidesLabel = "Guarniciones",
  dishesLabel = "Opciones",
  dishLabel = "Opción",
}: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const [selectedSides, setSelectedSides] = useState<string[]>([]);
  const [activeDishId, setActiveDishId] = useState(dishes[0]?.id ?? "");

  if (dishes.length === 0) {
    return null;
  }

  const active = dishes.find((d) => d.id === activeDishId) ?? dishes[0];
  const linePrice =
    pricingMode === "individual"
      ? Number(active.price) || 0
      : packagePrice;

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
          tu {dishLabel.toLowerCase()}
          {dishes.length > 1 ? " (toca una opción)" : ""}
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

      <div
        className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lg"
        style={{
          background: `linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 72%, black))`,
        }}
      >
        <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            {dailyMenuLabel}
          </p>
          <div className="mt-3 flex items-start justify-between gap-3">
            <h2
              key={`title-${active.id}`}
              className="menu-hero-fade font-[family-name:var(--font-display)] text-4xl leading-none"
            >
              {active.name}
            </h2>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-card)_92%,var(--color-primary))] text-center font-[family-name:var(--font-display)] text-xl leading-none text-brand-dark shadow">
              {formatMxn(linePrice).replace("MX$", "$")}
            </div>
          </div>
          {active.description ? (
            <p
              key={`desc-${active.id}`}
              className="menu-hero-fade mt-2 text-sm text-white/85"
            >
              {active.description}
            </p>
          ) : null}
        </div>
      </div>

      {active.photo_url ? (
        <div
          key={active.id}
          className={cn(
            "menu-hero-fade relative mt-4 h-48 w-full overflow-hidden",
            photoFrameClass(photoFrame).replace("object-cover", ""),
          )}
        >
          <ZoomableMenuPhoto
            src={active.photo_url}
            alt={active.name}
            className="h-48"
          />
        </div>
      ) : (
        <div
          key={active.id}
          className={cn(
            "menu-hero-fade mt-4 flex h-36 items-center justify-center bg-gradient-to-br from-[color-mix(in_srgb,var(--color-primary)_25%,transparent)] to-[color-mix(in_srgb,var(--color-primary)_40%,transparent)] font-[family-name:var(--font-display)] text-5xl text-brand-dark/40",
            photoFrameClass(photoFrame).replace("object-cover", ""),
          )}
        >
          {active.name.slice(0, 1)}
        </div>
      )}

      {dishes.length > 1 ? (
        <div className="mt-4 space-y-1">
          <p className="text-[11px] font-medium text-muted">
            Toca para cambiar de opción
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dishes.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setActiveDishId(d.id)}
                className={cn(
                  "min-h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-[background-color,color,transform] duration-200",
                  d.id === active.id
                    ? "scale-[1.03] bg-brand text-white"
                    : "border border-black/10 bg-surface text-foreground",
                )}
              >
                {d.name}
                {pricingMode === "individual" ? (
                  <span className="ml-1 opacity-80">
                    {formatMxn(Number(d.price)).replace("MX$", "$")}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
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
          />
        </div>
      ) : null}

      <Button className="mt-5 w-full" size="lg" onClick={addToCart}>
        Agregar · {formatMxn(linePrice)}
      </Button>
    </section>
  );
}
