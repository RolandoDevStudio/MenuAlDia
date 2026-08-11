const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export function formatMxn(amount: number | string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return mxn.format(Number.isFinite(n) ? n : 0);
}
