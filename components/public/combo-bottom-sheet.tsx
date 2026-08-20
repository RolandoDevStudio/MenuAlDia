"use client";

import { useMemo, useState } from "react";
import type { ComboWithItems, DishAddon } from "@/lib/types";
import { comboDisplayPrice } from "@/lib/combo";
import { formatMxn } from "@/lib/money";
import { useCartStore } from "@/stores/cart-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StorageImage } from "@/components/ui/storage-image";
import { cn } from "@/lib/utils";
import { Share2 } from "lucide-react";

type Props = {
  combo: ComboWithItems | null;
  addonsByDishId: Record<string, DishAddon[]>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sidesLabel?: string;
  shareUrl?: string;
  ctaLabel?: string;
};

export function ComboBottomSheet({
  combo,
  addonsByDishId,
  open,
  onOpenChange,
  sidesLabel = "Adicionales",
  shareUrl,
  ctaLabel = "🛒 Agregar Paquete al Carrito",
}: Props) {
  const addItems = useCartStore((s) => s.addItems);
  const [selectedByDish, setSelectedByDish] = useState<
    Record<string, Record<string, boolean>>
  >({});

  const price = useMemo(
    () => (combo ? comboDisplayPrice(combo) : 0),
    [combo],
  );

  const sumList = useMemo(() => {
    if (!combo) return 0;
    return combo.items.reduce(
      (s, i) => s + Number(i.dish.price) * i.quantity,
      0,
    );
  }, [combo]);

  function toggle(dishId: string, addonId: string) {
    setSelectedByDish((prev) => ({
      ...prev,
      [dishId]: {
        ...(prev[dishId] ?? {}),
        [addonId]: !prev[dishId]?.[addonId],
      },
    }));
  }

  function addPackage() {
    if (!combo) return;
    const unitBase =
      combo.fixed_price != null && Number(combo.fixed_price) > 0
        ? Number(combo.fixed_price) / combo.items.reduce((s, i) => s + i.quantity, 0)
        : null;

    const lines = combo.items.flatMap((ci) => {
      const addons = (addonsByDishId[ci.dish_id] ?? []).filter(
        (a) => a.is_active && !a.archived_at && selectedByDish[ci.dish_id]?.[a.id],
      );
      return Array.from({ length: ci.quantity }, () => ({
        dishId: ci.dish.id,
        name: ci.dish.name,
        unitPrice:
          unitBase != null ? unitBase : Number(ci.dish.price),
        quantity: 1,
        addons: addons.map((a) => ({
          id: a.id,
          name: a.name,
          priceDelta: Number(a.price_delta),
        })),
        comboId: combo.id,
        comboTitle: combo.title,
      }));
    });

    addItems(lines);
    setSelectedByDish({});
    onOpenChange(false);
  }

  async function share() {
    if (!shareUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: combo?.title, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setSelectedByDish({});
        onOpenChange(v);
      }}
    >
      <DialogContent
        className={cn(
          "menu-sheet-in fixed inset-x-0 bottom-0 top-auto left-0 max-h-[88dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-b-none rounded-t-3xl p-0",
          "pb-[max(1rem,env(safe-area-inset-bottom))]",
        )}
      >
        {combo ? (
          <div className="space-y-4 px-5 pt-5">
            {combo.photo_url ? (
              <div className="relative h-40 w-full overflow-hidden rounded-2xl">
                <StorageImage
                  src={combo.photo_url}
                  alt={combo.title}
                  fill
                  sizes="(max-width: 640px) 100vw, 512px"
                />
              </div>
            ) : null}
            <DialogHeader>
              <DialogTitle className="pr-8 text-xl">🔥 {combo.title}</DialogTitle>
              {combo.description ? (
                <DialogDescription>{combo.description}</DialogDescription>
              ) : null}
              <p className="text-lg font-semibold text-brand">
                {formatMxn(price)}
                {combo.fixed_price != null && sumList > price ? (
                  <span className="ml-2 text-sm font-normal text-muted line-through">
                    {formatMxn(sumList)}
                  </span>
                ) : null}
              </p>
            </DialogHeader>

            <ul className="space-y-4">
              {combo.items.map((ci) => {
                const addons = (addonsByDishId[ci.dish_id] ?? []).filter(
                  (a) => a.is_active && !a.archived_at,
                );
                return (
                  <li
                    key={`${ci.combo_id}-${ci.dish_id}`}
                    className="rounded-2xl border border-black/5 bg-background/50 p-3"
                  >
                    <p className="font-semibold">
                      {ci.quantity > 1 ? `${ci.quantity}× ` : ""}
                      {ci.dish.name}
                    </p>
                    {ci.dish.description ? (
                      <p className="mt-0.5 text-xs text-muted">
                        {ci.dish.description}
                      </p>
                    ) : null}
                    {addons.length > 0 ? (
                      <div className="mt-2 space-y-1.5">
                        <p className="text-xs font-semibold text-muted">
                          {sidesLabel}
                        </p>
                        {addons.map((a) => (
                          <label
                            key={a.id}
                            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-1"
                          >
                            <Checkbox
                              checked={Boolean(
                                selectedByDish[ci.dish_id]?.[a.id],
                              )}
                              onCheckedChange={() =>
                                toggle(ci.dish_id, a.id)
                              }
                            />
                            <span className="flex-1 text-sm">{a.name}</span>
                            {Number(a.price_delta) > 0 ? (
                              <span className="text-xs text-muted">
                                +{formatMxn(Number(a.price_delta))}
                              </span>
                            ) : null}
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <div className="flex gap-2 pb-2">
              {shareUrl ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 min-w-11 shrink-0"
                  onClick={share}
                  aria-label="Compartir"
                >
                  <Share2 className="h-5 w-5" />
                </Button>
              ) : null}
              <Button
                type="button"
                className="min-h-11 flex-1 text-base"
                onClick={addPackage}
              >
                {ctaLabel}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
