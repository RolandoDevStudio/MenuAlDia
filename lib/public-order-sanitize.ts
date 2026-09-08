import type { CartAddon, CartItem } from "./types";

export const PUBLIC_ORDER_TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;

function asNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeAddons(raw: unknown): CartAddon[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const addons: CartAddon[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    if (!name) continue;
    addons.push({
      id: String(o.id ?? name),
      name,
      priceDelta: asNumber(o.priceDelta ?? o.price_delta),
    });
  }
  return addons.length ? addons : undefined;
}

export function sanitizePublicCartItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const items: CartItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    if (!name) continue;
    const unitType =
      o.unitType === "kg" || o.unitType === "liter" ? o.unitType : "unit";
    items.push({
      dishId: String(o.dishId ?? o.dish_id ?? ""),
      name,
      unitPrice: asNumber(o.unitPrice ?? o.unit_price),
      quantity: asNumber(o.quantity, 1) || 1,
      addons: sanitizeAddons(o.addons),
      comboId: o.comboId ? String(o.comboId) : undefined,
      comboTitle: o.comboTitle ? String(o.comboTitle) : undefined,
      unitType,
      stepValue: o.stepValue != null ? asNumber(o.stepValue, 1) : undefined,
      allowPurchase: o.allowPurchase !== false,
    });
  }
  return items;
}
