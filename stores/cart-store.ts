"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/lib/types";

type CartState = {
  slug: string | null;
  items: CartItem[];
  setSlug: (slug: string) => void;
  addItem: (item: CartItem) => void;
  addItems: (items: CartItem[]) => void;
  removeItem: (dishId: string, sideKey?: string) => void;
  updateQty: (dishId: string, quantity: number, sideKey?: string) => void;
  clear: () => void;
  subtotal: () => number;
};

function addonKey(item: Pick<CartItem, "addons" | "sideIds">) {
  if (item.addons && item.addons.length > 0) {
    return [...item.addons.map((a) => a.id)].sort().join(",");
  }
  return [...(item.sideIds ?? [])].sort().join(",");
}

function itemKey(item: Pick<CartItem, "dishId" | "sideIds" | "addons" | "comboId">) {
  return `${item.comboId ?? ""}::${item.dishId}::${addonKey(item)}`;
}

function matchKey(item: CartItem, dishId: string, sideKey: string) {
  return (
    item.dishId === dishId &&
    addonKey(item) === sideKey
  );
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
      addItems: (items) => {
        for (const item of items) get().addItem(item);
      },
      removeItem: (dishId, sideKey = "") => {
        set({
          items: get().items.filter((i) => !matchKey(i, dishId, sideKey)),
        });
      },
      updateQty: (dishId, quantity, sideKey = "") => {
        if (quantity <= 0) {
          get().removeItem(dishId, sideKey);
          return;
        }
        set({
          items: get().items.map((i) =>
            matchKey(i, dishId, sideKey) ? { ...i, quantity } : i,
          ),
        });
      },
      clear: () => set({ items: [] }),
      subtotal: () =>
        get().items.reduce((sum, i) => {
          const addons = (i.addons ?? []).reduce((s, a) => s + a.priceDelta, 0);
          return sum + (i.unitPrice + addons) * i.quantity;
        }, 0),
    }),
    { name: "menualdia-cart" },
  ),
);
