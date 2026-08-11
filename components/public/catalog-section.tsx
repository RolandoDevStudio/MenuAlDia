"use client";

import type { Category, Dish } from "@/lib/types";
import { formatMxn } from "@/lib/money";
import { useCartStore } from "@/stores/cart-store";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

type Props = {
  categories: Category[];
  dishes: Dish[];
};

export function CatalogSection({ categories, dishes }: Props) {
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
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={dish.photo_url}
                      alt={dish.name}
                      className="h-20 w-20 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-gradient-to-br from-[#f0d4b8] to-[#e8a05a]/30 font-[family-name:var(--font-display)] text-2xl text-brand-dark/50">
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
                      </span>
                      <Button
                        size="sm"
                        className="min-h-11"
                        variant="secondary"
                        onClick={() =>
                          addItem({
                            dishId: dish.id,
                            name: dish.name,
                            unitPrice: Number(dish.price),
                            quantity: 1,
                          })
                        }
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
