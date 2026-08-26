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
