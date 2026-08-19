import type { ComboWithItems } from "@/lib/types";

export function comboDisplayPrice(combo: ComboWithItems): number {
  if (combo.fixed_price != null && Number(combo.fixed_price) > 0) {
    return Number(combo.fixed_price);
  }
  return combo.items.reduce(
    (sum, i) => sum + Number(i.dish.price) * i.quantity,
    0,
  );
}

export function slugifyCombo(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "combo";
}
