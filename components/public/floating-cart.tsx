"use client";

import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import type { Restaurant } from "@/lib/types";
import { useCartStore } from "@/stores/cart-store";
import { CartSheet } from "@/components/public/cart-sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FloatingCart({ restaurant }: { restaurant: Restaurant }) {
  const setSlug = useCartStore((s) => s.setSlug);
  const items = useCartStore((s) => s.items);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSlug(restaurant.slug);
    setHydrated(true);
  }, [restaurant.slug, setSlug]);

  const count = items.reduce((n, i) => n + i.quantity, 0);
  if (!hydrated || count === 0) return null;

  const shipping =
    restaurant.free_shipping || Number(restaurant.shipping_cost) === 0
      ? 0
      : Number(restaurant.shipping_cost);

  return (
    <>
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 px-4",
          "pb-[max(1rem,env(safe-area-inset-bottom))]",
        )}
      >
        <div className="mx-auto max-w-lg">
          <Button
            size="lg"
            className="w-full shadow-lg"
            onClick={() => setOpen(true)}
            aria-live="polite"
          >
            <ShoppingBag className="h-5 w-5" />
            Ver pedido ({count})
          </Button>
        </div>
      </div>
      <CartSheet
        open={open}
        onOpenChange={setOpen}
        restaurant={restaurant}
        shipping={shipping}
      />
    </>
  );
}

/** Spacer so fixed cart bar does not cover CTAs when cart has items. */
export function CartBottomSpacer() {
  const items = useCartStore((s) => s.items);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const count = items.reduce((n, i) => n + i.quantity, 0);
  if (!hydrated || count === 0) return null;
  return (
    <div
      className="w-full shrink-0"
      style={{ height: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      aria-hidden
    />
  );
}
