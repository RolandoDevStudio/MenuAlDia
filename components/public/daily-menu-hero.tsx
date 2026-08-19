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

type Props = {
  dishes: Dish[];
  sides: Dish[];
  packagePrice: number;
  maxSides: number;
  photoFrame?: PhotoFrame;
  dailyMenuLabel?: string;
  sidesLabel?: string;
  dishesLabel?: string;
};

export function DailyMenuHero({
  dishes,
  sides,
  packagePrice,
  maxSides,
  photoFrame = "rounded_modern",
  dailyMenuLabel = "Menú del día",
  sidesLabel = "Guarniciones",
  dishesLabel = "Platillos",
}: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const [selectedSides, setSelectedSides] = useState<string[]>([]);
  const [activeDishId, setActiveDishId] = useState(dishes[0]?.id ?? "");

  if (dishes.length === 0) {
    return (
      <section className="mx-auto max-w-lg px-4 py-8">
        <div className="rounded-3xl border border-dashed border-brand/25 bg-surface/70 px-5 py-8 text-center">
          <p className="font-[family-name:var(--font-display)] text-3xl text-brand">
            Hoy no hay {dailyMenuLabel.toLowerCase()}
          </p>
          <p className="mt-2 text-sm text-muted">
            Aún no se activaron {dishesLabel.toLowerCase()} para hoy. Revisa el
            catálogo o vuelve más tarde.
          </p>
        </div>
      </section>
    );
  }

  const active = dishes.find((d) => d.id === activeDishId) ?? dishes[0];

  function addToCart() {
    const sideNames = sides
      .filter((s) => selectedSides.includes(s.id))
      .map((s) => s.name);
    addItem({
      dishId: active.id,
      name: `${dailyMenuLabel}: ${active.name}`,
      unitPrice: packagePrice,
      quantity: 1,
      sideIds: selectedSides,
      sideNames,
      isDailyMenu: true,
    });
  }

  return (
    <section className="mx-auto max-w-lg px-4 py-6">
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
            <h2 className="font-[family-name:var(--font-display)] text-4xl leading-none">
              {active.name}
            </h2>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-card)_92%,var(--color-primary))] text-center font-[family-name:var(--font-display)] text-xl leading-none text-brand-dark shadow">
              {formatMxn(packagePrice).replace("MX$", "$")}
            </div>
          </div>
          {active.description ? (
            <p className="mt-2 text-sm text-white/85">{active.description}</p>
          ) : null}
        </div>
      </div>

      {active.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={active.photo_url}
          alt={active.name}
          className={cn("mt-4 h-48 w-full", photoFrameClass(photoFrame))}
        />
      ) : (
        <div
          className={cn(
            "mt-4 flex h-36 items-center justify-center bg-gradient-to-br from-[color-mix(in_srgb,var(--color-primary)_25%,transparent)] to-[color-mix(in_srgb,var(--color-primary)_40%,transparent)] font-[family-name:var(--font-display)] text-5xl text-brand-dark/40",
            photoFrameClass(photoFrame).replace("object-cover", ""),
          )}
        >
          {active.name.slice(0, 1)}
        </div>
      )}

      {dishes.length > 1 ? (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {dishes.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setActiveDishId(d.id)}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium ${
                d.id === active.id
                  ? "bg-brand text-white"
                  : "border border-black/10 bg-surface text-foreground"
              }`}
            >
              {d.name}
            </button>
          ))}
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
        Agregar {dailyMenuLabel.toLowerCase()}
      </Button>
    </section>
  );
}
