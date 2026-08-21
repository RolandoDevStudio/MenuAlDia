"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dish, DishAddon } from "@/lib/types";
import type { PhotoFrame } from "@/lib/theme";
import { photoFrameClass } from "@/lib/theme";
import { formatMxn } from "@/lib/money";
import {
  formatQty,
  normalizeQty,
  pricePerUnitLabel,
  resolveStepValue,
  resolveUnitType,
} from "@/lib/units";
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
  dish: Dish | null;
  addons: DishAddon[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoFrame?: PhotoFrame;
  sidesLabel?: string;
  shareUrl?: string;
  allowBooking?: boolean;
  allowPurchase?: boolean;
  onRequestCita?: () => void;
};

export function ProductBottomSheet({
  dish,
  addons,
  open,
  onOpenChange,
  photoFrame = "rounded_modern",
  sidesLabel = "Adicionales",
  shareUrl,
  allowBooking = false,
  allowPurchase = true,
  onRequestCita,
}: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const unit = resolveUnitType(dish?.unit_type);
  const step = resolveStepValue(unit, dish?.step_value);
  const [qty, setQty] = useState(step);

  useEffect(() => {
    if (open && dish) {
      const u = resolveUnitType(dish.unit_type);
      const s = resolveStepValue(u, dish.step_value);
      setQty(s);
      setSelected({});
      void fetch("/api/public/dish-engage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: dish.restaurant_id,
          dish_id: dish.id,
          kind: "open",
        }),
        keepalive: true,
      }).catch(() => {});
    }
  }, [open, dish]);

  const activeAddons = useMemo(
    () => addons.filter((a) => a.is_active && !a.archived_at),
    [addons],
  );

  const addonTotal = activeAddons
    .filter((a) => selected[a.id])
    .reduce((s, a) => s + Number(a.price_delta), 0);

  const canBook = allowBooking;
  const canBuy = allowPurchase;
  const linePreview =
    (Number(dish?.price ?? 0) + addonTotal) * (qty > 0 ? qty : 0);

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function bump(delta: number) {
    setQty((q) => {
      const next = normalizeQty(q + delta, step);
      return next > 0 ? next : step;
    });
  }

  function addToCart() {
    if (!dish || !canBuy) return;
    const chosen = activeAddons.filter((a) => selected[a.id]);
    const amount = normalizeQty(qty, step) || step;
    addItem({
      dishId: dish.id,
      name: dish.name,
      unitPrice: Number(dish.price),
      quantity: amount,
      addons: chosen.map((a) => ({
        id: a.id,
        name: a.name,
        priceDelta: Number(a.price_delta),
      })),
      allowPurchase: true,
      allowBooking: canBook,
      unitType: unit,
      stepValue: step,
    });
    void fetch("/api/public/dish-engage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurant_id: dish.restaurant_id,
        dish_id: dish.id,
        kind: "add",
      }),
      keepalive: true,
    }).catch(() => {});
    setSelected({});
    onOpenChange(false);
  }

  async function share() {
    if (!shareUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: dish?.name, url: shareUrl });
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
        if (!v) setSelected({});
        onOpenChange(v);
      }}
    >
      <DialogContent
        className={cn(
          "menu-sheet-in fixed inset-x-0 bottom-0 top-auto left-0 max-h-[88dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-b-none rounded-t-3xl p-0",
          "pb-[max(1rem,env(safe-area-inset-bottom))]",
        )}
      >
        {dish ? (
          <>
            {dish.photo_url ? (
              <div className="relative h-48 w-full overflow-hidden">
                <StorageImage
                  src={dish.photo_url}
                  alt={dish.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 512px"
                />
              </div>
            ) : (
              <div
                className={cn(
                  "flex h-36 w-full items-center justify-center bg-brand/10 font-[family-name:var(--font-display)] text-5xl text-brand",
                  photoFrameClass(photoFrame).replace("object-cover", ""),
                )}
              >
                {dish.name.slice(0, 1)}
              </div>
            )}
            <div className="space-y-4 px-5 pt-4">
              <DialogHeader>
                <DialogTitle className="pr-8 text-xl">{dish.name}</DialogTitle>
                {dish.description ? (
                  <DialogDescription>{dish.description}</DialogDescription>
                ) : null}
                <p className="text-lg font-semibold text-brand">
                  {formatMxn(Number(dish.price))}
                  {pricePerUnitLabel(unit)}
                </p>
              </DialogHeader>

              {activeAddons.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">{sidesLabel}</p>
                  <ul className="space-y-2">
                    {activeAddons.map((a) => (
                      <li key={a.id}>
                        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-black/5 bg-background/60 px-3 py-2">
                          <Checkbox
                            checked={Boolean(selected[a.id])}
                            onCheckedChange={() => toggle(a.id)}
                          />
                          <span className="flex-1 text-sm">{a.name}</span>
                          {Number(a.price_delta) > 0 ? (
                            <span className="text-xs font-medium text-muted">
                              +{formatMxn(Number(a.price_delta))}
                            </span>
                          ) : null}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {canBuy ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-surface px-3 py-2">
                  <span className="text-sm font-medium">Cantidad</span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="h-11 w-11"
                      onClick={() => bump(-step)}
                    >
                      −
                    </Button>
                    <span className="min-w-[4rem] text-center text-sm font-semibold">
                      {formatQty(qty, unit)}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="h-11 w-11"
                      onClick={() => bump(step)}
                    >
                      +
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-2 pb-2">
                <div className="flex gap-2">
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
                  {canBook ? (
                    <Button
                      type="button"
                      className="min-h-11 flex-1"
                      onClick={() => onRequestCita?.()}
                    >
                      Solicitar cita
                    </Button>
                  ) : canBuy ? (
                    <Button
                      type="button"
                      className="min-h-11 flex-1"
                      onClick={addToCart}
                    >
                      Agregar · {formatMxn(linePreview)}
                    </Button>
                  ) : null}
                </div>
                {canBook && canBuy ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11 w-full"
                    onClick={addToCart}
                  >
                    Agregar al carrito · {formatMxn(linePreview)}
                  </Button>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
