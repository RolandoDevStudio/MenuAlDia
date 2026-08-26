/** Public site origin for menu links, QR, OG. */
export function getAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return "https://menualdia.com.mx";
}

export const BRAND_OG_IMAGE = "/brand/menualdia-icon-512.png";

export function ogImageUrl(url?: string | null): string {
  const trimmed = url?.trim();
  return trimmed || BRAND_OG_IMAGE;
}

export function publicMenuUrl(slug: string, origin?: string): string {
  const base = (origin ?? getAppOrigin()).replace(/\/$/, "");
  return `${base}/${slug}`;
}
