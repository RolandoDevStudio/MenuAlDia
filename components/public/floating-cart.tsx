"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ShoppingBag } from "lucide-react";
import type { Restaurant } from "@/lib/types";
import { useCartStore } from "@/stores/cart-store";
import { CartSheet } from "@/components/public/cart-sheet";
import { Button } from "@/components/ui/button";
import { formatMxn } from "@/lib/money";
import { cn } from "@/lib/utils";

export function FloatingCart({ restaurant }: { restaurant: Restaurant }) {
  const setSlug = useCartStore((s) => s.setSlug);
  const items = useCartStore((s) => s.items);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [badgePop, setBadgePop] = useState(false);
  const prevCount = useRef(0);

  useEffect(() => {
    setSlug(restaurant.slug);
    setHydrated(true);
  }, [restaurant.slug, setSlug]);

  const count = items.reduce((n, i) => n + i.quantity, 0);
  const itemsSubtotal = useMemo(
    () =>
      items.reduce((sum, i) => {
        const addons = (i.addons ?? []).reduce(
          (a, x) => a + Number(x.priceDelta),
          0,
        );
        return sum + (Number(i.unitPrice) + addons) * i.quantity;
      }, 0),
    [items],
  );

  useEffect(() => {
    if (!hydrated) {
      prevCount.current = count;
      return;
    }
    if (count > prevCount.current && count > 0) {
      setBadgePop(true);
      const t = window.setTimeout(() => setBadgePop(false), 360);
      prevCount.current = count;
      return () => window.clearTimeout(t);
    }
    prevCount.current = count;
  }, [count, hydrated]);

  if (!hydrated || count === 0) return null;

  const shipping =
    restaurant.free_shipping || Number(restaurant.shipping_cost) === 0
      ? 0
      : Number(restaurant.shipping_cost);

  return (
    <>
      <div
        className={cn(
          "menu-cart-bar-in fixed inset-x-0 bottom-0 z-40 px-4",
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
            <ShoppingBag
              className={cn("h-5 w-5", badgePop && "menu-badge-pop")}
            />
            <span className={cn("inline-flex", badgePop && "menu-badge-pop")}>
              Ver pedido ({count}) · {formatMxn(itemsSubtotal)}
            </span>
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
