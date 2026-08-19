"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  Category,
  ComboWithItems,
  Dish,
  DishAddon,
  Restaurant,
} from "@/lib/types";
import type { PhotoFrame } from "@/lib/theme";
import { photoFrameClass } from "@/lib/theme";
import { formatMxn } from "@/lib/money";
import { comboDisplayPrice } from "@/lib/combo";
import { ProductBottomSheet } from "@/components/public/product-bottom-sheet";
import { ComboBottomSheet } from "@/components/public/combo-bottom-sheet";
import { StorageImage } from "@/components/ui/storage-image";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  restaurant: Restaurant;
  categories: Category[];
  dishes: Dish[];
  addonsByDishId: Record<string, DishAddon[]>;
  combos: ComboWithItems[];
  photoFrame?: PhotoFrame;
  sidesLabel?: string;
  combosLabel?: string;
  initialDishId?: string | null;
  initialComboSlug?: string | null;
};

export function PublicMenuClient({
  slug,
  categories,
  dishes,
  addonsByDishId,
  combos,
  photoFrame = "rounded_modern",
  sidesLabel = "Adicionales",
  combosLabel = "Combos",
  initialDishId,
  initialComboSlug,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [productId, setProductId] = useState<string | null>(
    initialDishId ?? null,
  );
  const [comboSlug, setComboSlug] = useState<string | null>(
    initialComboSlug ?? null,
  );
  const [activeCat, setActiveCat] = useState<string>("all");

  useEffect(() => {
    if (initialComboSlug) setComboSlug(initialComboSlug);
    else if (initialDishId) setProductId(initialDishId);
  }, [initialDishId, initialComboSlug]);

  const product = useMemo(
    () => dishes.find((d) => d.id === productId) ?? null,
    [dishes, productId],
  );
  const combo = useMemo(
    () => combos.find((c) => c.slug === comboSlug) ?? null,
    [combos, comboSlug],
  );

  const fixed = categories.filter((c) => c.is_fixed_catalog);
  const catalogDishes = dishes.filter((d) => !d.is_side);

  function clearQuery() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("p");
    params.delete("c");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  function openProduct(id: string) {
    setComboSlug(null);
    setProductId(id);
  }

  function openCombo(s: string) {
    setProductId(null);
    setComboSlug(s);
  }

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  return (
    <>
      {combos.length > 0 ? (
        <section className="mx-auto max-w-lg px-4 pb-2 pt-4">
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-brand-dark">
            {combosLabel}
          </h2>
          <ul className="mt-3 space-y-3">
            {combos.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => openCombo(c.slug)}
                  className="flex min-h-11 w-full gap-3 rounded-2xl border border-brand/20 bg-surface p-3 text-left transition active:scale-[0.99]"
                >
                  {c.photo_url ? (
                    <StorageImage
                      src={c.photo_url}
                      alt=""
                      width={80}
                      height={80}
                      sizes="80px"
                      className={cn("h-20 w-20", photoFrameClass(photoFrame))}
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand/10 text-2xl">
                      🔥
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{c.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                      {c.items.map((i) => i.dish.name).join(" · ")}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-brand">
                      {formatMxn(comboDisplayPrice(c))}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mx-auto max-w-lg px-4 pb-8 pt-2">
        {fixed.length > 1 ? (
          <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setActiveCat("all")}
              className={cn(
                "min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold",
                activeCat === "all"
                  ? "bg-brand text-white"
                  : "bg-surface text-muted",
              )}
            >
              Todo
            </button>
            {fixed.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCat(c.id)}
                className={cn(
                  "min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold",
                  activeCat === c.id
                    ? "bg-brand text-white"
                    : "bg-surface text-muted",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        ) : null}

        {fixed.length === 0 || catalogDishes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-surface/70 px-4 py-6 text-center">
            <p className="font-semibold text-brand-dark">
              Aún no hay ítems en el catálogo
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {fixed
              .filter((c) => activeCat === "all" || activeCat === c.id)
              .map((category) => {
                const items = catalogDishes.filter(
                  (d) => d.category_id === category.id,
                );
                if (items.length === 0) return null;
                return (
                  <div key={category.id} id={`cat-${category.id}`}>
                    <h2 className="font-[family-name:var(--font-display)] text-3xl text-brand-dark">
                      {category.name}
                    </h2>
                    <ul className="mt-3 space-y-3">
                      {items.map((dish) => (
                        <li key={dish.id}>
                          <button
                            type="button"
                            onClick={() => openProduct(dish.id)}
                            className="flex min-h-11 w-full gap-3 rounded-2xl border border-black/5 bg-surface p-3 text-left transition active:scale-[0.99]"
                          >
                            {dish.photo_url ? (
                              <StorageImage
                                src={dish.photo_url}
                                alt=""
                                width={80}
                                height={80}
                                sizes="80px"
                                className={cn(
                                  "h-20 w-20",
                                  photoFrameClass(photoFrame),
                                )}
                              />
                            ) : (
                              <div
                                className={cn(
                                  "flex h-20 w-20 items-center justify-center bg-brand/15 font-[family-name:var(--font-display)] text-2xl text-brand-dark/50",
                                  photoFrameClass(photoFrame).replace(
                                    "object-cover",
                                    "",
                                  ),
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
                              <p className="mt-2 text-sm font-semibold text-brand">
                                {formatMxn(Number(dish.price))}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      <ProductBottomSheet
        dish={product}
        addons={product ? addonsByDishId[product.id] ?? [] : []}
        open={Boolean(product)}
        onOpenChange={(o) => {
          if (!o) {
            setProductId(null);
            clearQuery();
          }
        }}
        photoFrame={photoFrame}
        sidesLabel={sidesLabel}
        shareUrl={
          product && origin
            ? `${origin}/${slug}?p=${product.id}`
            : undefined
        }
      />

      <ComboBottomSheet
        combo={combo}
        addonsByDishId={addonsByDishId}
        open={Boolean(combo)}
        onOpenChange={(o) => {
          if (!o) {
            setComboSlug(null);
            clearQuery();
          }
        }}
        sidesLabel={sidesLabel}
        shareUrl={
          combo && origin ? `${origin}/${slug}?c=${combo.slug}` : undefined
        }
      />
    </>
  );
}
