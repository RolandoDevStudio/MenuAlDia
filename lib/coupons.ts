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

/** End of calendar day 23:59:59.999 in America/Mexico_City → UTC ISO. */
export function endOfCouponDay(dateYmd: string): string {
  const ymd = dateYmd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error("fecha inválida");
  }
  // Approximate: treat as CDMX offset −06:00 (CST) / −05:00 (CDT).
  // Use noon UTC probe then format in zone, then set local end.
  const probe = new Date(`${ymd}T12:00:00.000Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    timeZoneName: "shortOffset",
  }).formatToParts(probe);
  const tz =
    parts.find((p) => p.type === "timeZoneName")?.value?.replace("GMT", "") ||
    "-06";
  // Normalize to ±HH:MM
  let offset = tz.includes(":")
    ? tz
    : tz.length <= 3
      ? `${tz}:00`
      : tz;
  if (/^[+-]\d{2}$/.test(offset)) offset = `${offset}:00`;
  return new Date(`${ymd}T23:59:59.999${offset}`).toISOString();
}

export function startOfCouponDay(dateYmd: string): string {
  const ymd = dateYmd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error("fecha inválida");
  }
  const probe = new Date(`${ymd}T12:00:00.000Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    timeZoneName: "shortOffset",
  }).formatToParts(probe);
  const tz =
    parts.find((p) => p.type === "timeZoneName")?.value?.replace("GMT", "") ||
    "-06";
  let offset = tz.includes(":")
    ? tz
    : tz.length <= 3
      ? `${tz}:00`
      : tz;
  if (/^[+-]\d{2}$/.test(offset)) offset = `${offset}:00`;
  return new Date(`${ymd}T00:00:00.000${offset}`).toISOString();
}

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
