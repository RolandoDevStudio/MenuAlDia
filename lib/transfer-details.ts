import type { Restaurant } from "@/lib/types";

export type PublicTransferDetails = {
  holder: string;
  bank: string;
  clabe: string;
};

export function normalizeClabe(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function formatClabeDisplay(clabe: string): string {
  const digits = normalizeClabe(clabe);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

type TransferFields = Pick<
  Restaurant,
  "show_transfer_details" | "bank_account_holder" | "bank_name" | "bank_clabe"
>;

/** Public checkout + WA: only if the admin toggle is on and CLABE is 18 digits. */
export function publicTransferDetails(
  r: TransferFields,
): PublicTransferDetails | null {
  if (r.show_transfer_details !== true) return null;
  const clabe = normalizeClabe(r.bank_clabe ?? "");
  if (clabe.length !== 18) return null;
  return {
    holder: (r.bank_account_holder ?? "").trim(),
    bank: (r.bank_name ?? "").trim(),
    clabe,
  };
}

/** Lines for the WhatsApp order message (transfer payment). */
export function transferWhatsAppLines(r: TransferFields): string[] {
  const transfer = publicTransferDetails(r);
  if (!transfer) {
    return [
      "Por favor, ¿me puedes compartir los datos para transferir (banco / CLABE / cuenta)?",
    ];
  }
  const lines: string[] = [];
  if (transfer.holder) lines.push(`Titular: ${transfer.holder}`);
  if (transfer.bank) lines.push(`Banco: ${transfer.bank}`);
  lines.push(`CLABE: ${transfer.clabe}`);
  lines.push("Envía tu comprobante en este chat.");
  return lines;
}

/** Drop draft bank fields from the public menu payload unless they are displayable. */
export function sanitizePublicRestaurantTransfer<T extends TransferFields>(
  r: T,
): T {
  const details = publicTransferDetails(r);
  if (details) {
    return {
      ...r,
      bank_account_holder: details.holder,
      bank_name: details.bank,
      bank_clabe: details.clabe,
    };
  }
  return {
    ...r,
    show_transfer_details: false,
    bank_account_holder: "",
    bank_name: "",
    bank_clabe: "",
  };
}
