/**
 * Canonical Mexican mobile identity: exactly 10 digits, or null.
 * Do not use this for wa.me business URLs (those may prepend 52).
 */
export function normalizeMxPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  let ten = digits;
  if (digits.length === 13 && digits.startsWith("521")) {
    ten = digits.slice(3);
  } else if (digits.length === 12 && digits.startsWith("52")) {
    ten = digits.slice(2);
  }
  if (ten.length !== 10) return null;
  return ten;
}

/** Meta webhook / Graph wa_id → CRM 10-digit MX phone. */
export function waIdToMx10(waId: string): string | null {
  return normalizeMxPhone(waId);
}

/**
 * MX-10 → E.164 digits for Graph API send (Mexico: 52 + 10).
 * Prefer this for outbound; inbound may arrive as 521… and still normalize via waIdToMx10.
 */
export function mx10ToWaE164(ten: string): string | null {
  const n = normalizeMxPhone(ten);
  if (!n) return null;
  return `52${n}`;
}
