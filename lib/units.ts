export type DishUnitType = "unit" | "kg" | "liter";

export const UNIT_TYPE_LABELS: Record<DishUnitType, string> = {
  unit: "Pieza / unidad",
  kg: "Kilos (kg)",
  liter: "Litros (L)",
};

export const UNIT_TYPE_SHORT: Record<DishUnitType, string> = {
  unit: "pza",
  kg: "kg",
  liter: "L",
};

export function isDishUnitType(v: unknown): v is DishUnitType {
  return v === "unit" || v === "kg" || v === "liter";
}

export function defaultStepForUnit(unit: DishUnitType): number {
  if (unit === "unit") return 1;
  return 0.1;
}

export function resolveUnitType(raw: unknown): DishUnitType {
  return isDishUnitType(raw) ? raw : "unit";
}

export function resolveStepValue(
  unit: DishUnitType,
  step: unknown,
): number {
  const n = Number(step);
  if (Number.isFinite(n) && n > 0) return n;
  return defaultStepForUnit(unit);
}

/** Round qty to a sensible decimal for the step. */
export function normalizeQty(qty: number, step: number): number {
  if (!(qty > 0) || !(step > 0)) return 0;
  const decimals = String(step).includes(".")
    ? (String(step).split(".")[1]?.length ?? 0)
    : 0;
  const rounded = Math.round(qty / step) * step;
  return Number(rounded.toFixed(Math.min(4, Math.max(0, decimals))));
}

export function formatQty(qty: number, unit: DishUnitType): string {
  const short = UNIT_TYPE_SHORT[unit];
  if (unit === "unit") {
    return `${Math.round(qty)} ${short}`;
  }
  const s = Number.isInteger(qty) ? String(qty) : String(Number(qty.toFixed(3)));
  return `${s} ${short}`;
}

export function pricePerUnitLabel(unit: DishUnitType): string {
  if (unit === "unit") return "";
  return ` / ${UNIT_TYPE_SHORT[unit]}`;
}
