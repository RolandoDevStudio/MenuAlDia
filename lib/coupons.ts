import {
  endOfMexicoCityDay,
  startOfMexicoCityDay,
} from "@/lib/dates";
import { formatMxn } from "@/lib/money";

export type CouponDiscountType = "percent" | "fixed";

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function clampDiscount(params: {
  type: CouponDiscountType;
  value: number;
  base: number;
}): number {
  const base = Math.max(0, Number(params.base) || 0);
  const value = Math.max(0, Number(params.value) || 0);
  if (!(base > 0) || !(value > 0)) return 0;
  if (params.type === "percent") {
    const pct = Math.min(100, value);
    return Math.min(base, Math.round((base * pct) / 100));
  }
  return Math.min(base, Math.round(value));
}

export function missingMinSubtotalMessage(missing: number): string {
  const m = Math.max(0, Math.ceil(missing));
  return `Agrega ${formatMxn(m)} más a tu carrito para activar este cupón`;
}

export const endOfCouponDay = endOfMexicoCityDay;
export const startOfCouponDay = startOfMexicoCityDay;

export type SpeiInfo = {
  bank: string;
  beneficiary: string;
  clabe: string;
  concept_hint: string;
};

export const DEFAULT_SPEI_INFO: SpeiInfo = {
  bank: "",
  beneficiary: "",
  clabe: "",
  concept_hint: "Indica tu nombre o slug del negocio en el concepto",
};
