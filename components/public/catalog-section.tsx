"use client";

import type { Category, Dish } from "@/lib/types";
import type { PhotoFrame } from "@/lib/theme";
import { photoFrameClass } from "@/lib/theme";
import { formatMxn } from "@/lib/money";
import {
  pricePerUnitLabel,
  resolveStepValue,
  resolveUnitType,
} from "@/lib/units";
import { useCartStore } from "@/stores/cart-store";
import { Button } from "@/components/ui/button";
import { StorageImage } from "@/components/ui/storage-image";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  categories: Category[];
  dishes: Dish[];
  photoFrame?: PhotoFrame;
};

export function CatalogSection({
  categories,
  dishes,
  photoFrame = "rounded_modern",
}: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const fixed = categories.filter((c) => c.is_fixed_catalog);
  const catalogItems = fixed.flatMap((category) =>
    dishes.filter((d) => d.category_id === category.id && !d.is_side),
  );

  if (fixed.length === 0 || catalogItems.length === 0) {
    return (
      <section className="mx-auto max-w-lg px-4 pb-8 pt-2">
        <div className="rounded-2xl border border-dashed border-black/10 bg-surface/70 px-4 py-6 text-center">
          <p className="font-semibold text-brand-dark">
            Aún no hay platillos en el catálogo
          </p>
          <p className="mt-1 text-sm text-muted">
            Cuando el restaurante agregue entradas, bebidas u otros, aparecerán
            aquí.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-lg space-y-8 px-4 pb-8 pt-2">
      {fixed.map((category) => {
        const items = dishes.filter(
          (d) => d.category_id === category.id && !d.is_side,
        );
        if (items.length === 0) return null;
        return (
          <div key={category.id}>
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-brand-dark">
              {category.name}
            </h2>
            <ul className="mt-3 space-y-3">
              {items.map((dish) => (
                <li
                  key={dish.id}
                  className="flex gap-3 rounded-2xl border border-black/5 bg-surface p-3"
                >
                  {dish.photo_url ? (
                    <StorageImage
                      src={dish.photo_url}
                      alt={dish.name}
                      width={80}
                      height={80}
                      sizes="80px"
                      className={cn("h-20 w-20", photoFrameClass(photoFrame))}
                    />
                  ) : (
                    <div
                      className={cn(
                        "flex h-20 w-20 items-center justify-center bg-gradient-to-br from-[color-mix(in_srgb,var(--color-primary)_22%,transparent)] to-[color-mix(in_srgb,var(--color-primary)_35%,transparent)] font-[family-name:var(--font-display)] text-2xl text-brand-dark/50",
                        photoFrameClass(photoFrame).replace("object-cover", ""),
                      )}
                    >
                      {dish.name.slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{dish.name}</p>
                    {dish.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                        {dish.description}
                      </p>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-brand">
                        {formatMxn(Number(dish.price))}
                        {pricePerUnitLabel(resolveUnitType(dish.unit_type))}
                      </span>
                      <Button
                        size="sm"
                        className="min-h-11"
                        variant="secondary"
                        onClick={() => {
                          const unit = resolveUnitType(dish.unit_type);
                          const step = resolveStepValue(unit, dish.step_value);
                          addItem({
                            dishId: dish.id,
                            name: dish.name,
                            unitPrice: Number(dish.price),
                            quantity: step,
                            unitType: unit,
                            stepValue: step,
                            allowPurchase: dish.allow_purchase !== false,
                            allowBooking: Boolean(dish.allow_booking),
                          });
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Agregar
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
