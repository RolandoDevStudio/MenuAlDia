export type InvoiceStatus = "global" | "pending" | "issued" | "cancelled";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  global: "Global",
  pending: "Pendiente",
  issued: "Emitida",
  cancelled: "Cancelada",
};

export function isInvoiceStatus(v: unknown): v is InvoiceStatus {
  return (
    v === "global" ||
    v === "pending" ||
    v === "issued" ||
    v === "cancelled"
  );
}

/** Keep legacy needs_invoice in sync with invoice_status. */
export function needsInvoiceFromStatus(status: InvoiceStatus): boolean {
  return status !== "global";
}

export function resolveInvoiceStatus(payment: {
  invoice_status?: string | null;
  needs_invoice?: boolean | null;
}): InvoiceStatus {
  if (isInvoiceStatus(payment.invoice_status)) return payment.invoice_status;
  return payment.needs_invoice ? "pending" : "global";
}
