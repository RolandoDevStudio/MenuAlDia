"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/lib/types";

type CartState = {
  slug: string | null;
  items: CartItem[];
  setSlug: (slug: string) => void;
  addItem: (item: CartItem) => void;
  removeItem: (dishId: string, sideKey?: string) => void;
  updateQty: (dishId: string, quantity: number, sideKey?: string) => void;
  clear: () => void;
  subtotal: () => number;
};

function itemKey(item: Pick<CartItem, "dishId" | "sideIds">) {
  const sides = [...(item.sideIds ?? [])].sort().join(",");
  return `${item.dishId}::${sides}`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      slug: null,
      items: [],
      setSlug: (slug) => {
        const current = get().slug;
        if (current && current !== slug) {
          set({ slug, items: [] });
        } else {
          set({ slug });
        }
      },
      addItem: (item) => {
        const key = itemKey(item);
        const existing = get().items.find((i) => itemKey(i) === key);
        if (existing) {
          set({
            items: get().items.map((i) =>
              itemKey(i) === key
                ? { ...i, quantity: i.quantity + item.quantity }
                : i,
            ),
          });
        } else {
          set({ items: [...get().items, item] });
        }
      },
      removeItem: (dishId, sideKey = "") => {
        set({
          items: get().items.filter((i) => itemKey(i) !== `${dishId}::${sideKey}`),
        });
      },
      updateQty: (dishId, quantity, sideKey = "") => {
        if (quantity <= 0) {
          get().removeItem(dishId, sideKey);
          return;
        }
        set({
          items: get().items.map((i) =>
            itemKey(i) === `${dishId}::${sideKey}` ? { ...i, quantity } : i,
          ),
        });
      },
      clear: () => set({ items: [] }),
      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    }),
    { name: "menualdia-cart" },
  ),
);
