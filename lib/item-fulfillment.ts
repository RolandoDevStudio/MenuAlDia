import type { CartItem } from "@/lib/types";

export function dishAllowsPurchase(d: {
  allow_purchase?: boolean | null;
}): boolean {
  return d.allow_purchase !== false;
}

export function dishAllowsBooking(d: {
  allow_booking?: boolean | null;
}): boolean {
  return d.allow_booking === true;
}

export function comboAllowsPurchase(c: {
  allow_purchase?: boolean | null;
}): boolean {
  return c.allow_purchase !== false;
}

export function comboAllowsBooking(c: {
  allow_booking?: boolean | null;
}): boolean {
  return c.allow_booking === true;
}

export function cartItemAllowsPurchase(i: CartItem): boolean {
  return i.allowPurchase !== false;
}

export function cartItemAllowsBooking(i: CartItem): boolean {
  return i.allowBooking === true;
}

export function cartHasBookable(items: CartItem[]): boolean {
  return items.some(cartItemAllowsBooking);
}

export function cartHasPurchasable(items: CartItem[]): boolean {
  return items.some(cartItemAllowsPurchase);
}

export function bookableCartItems(items: CartItem[]): CartItem[] {
  return items.filter(cartItemAllowsBooking);
}

export function purchasableCartItems(items: CartItem[]): CartItem[] {
  return items.filter(cartItemAllowsPurchase);
}
