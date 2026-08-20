"use client";

import { useMemo, useState } from "react";
import type { Dish, DishAddon } from "@/lib/types";
import type { PhotoFrame } from "@/lib/theme";
import { photoFrameClass } from "@/lib/theme";
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
import { Label } from "@/components/ui/label";
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
  /** Giro servicios: primary CTA opens appointment flow. */
  citaMode?: boolean;
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
  citaMode = false,
  onRequestCita,
}: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const activeAddons = useMemo(
    () => addons.filter((a) => a.is_active && !a.archived_at),
    [addons],
  );

  const addonTotal = activeAddons
    .filter((a) => selected[a.id])
    .reduce((s, a) => s + Number(a.price_delta), 0);

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function addToCart() {
    if (!dish) return;
    const chosen = activeAddons.filter((a) => selected[a.id]);
    addItem({
      dishId: dish.id,
      name: dish.name,
      unitPrice: Number(dish.price),
      quantity: 1,
      addons: chosen.map((a) => ({
        id: a.id,
        name: a.name,
        priceDelta: Number(a.price_delta),
      })),
    });
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
                  {formatMxn(Number(dish.price) + addonTotal)}
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
                  {citaMode ? (
                    <Button
                      type="button"
                      className="min-h-11 flex-1"
                      onClick={() => {
                        onRequestCita?.();
                      }}
                    >
                      Solicitar cita
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="min-h-11 flex-1"
                      onClick={addToCart}
                    >
                      Agregar al carrito
                    </Button>
                  )}
                </div>
                {citaMode ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11 w-full"
                    onClick={addToCart}
                  >
                    Agregar al carrito
                  </Button>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <div className="p-6">
            <DialogTitle>Producto</DialogTitle>
            <Label className="text-muted">No encontrado</Label>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
