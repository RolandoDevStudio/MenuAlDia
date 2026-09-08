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

/** Public menu share image: dedicated OG, then banner, then logo. */
export function menuShareImageUrl(
  theme: {
    ogImageUrl?: string | null;
    bannerUrl?: string | null;
  },
  logoUrl?: string | null,
  extra?: string | null,
): string {
  return ogImageUrl(
    extra || theme.ogImageUrl || theme.bannerUrl || logoUrl,
  );
}

export function publicMenuUrl(slug: string, origin?: string): string {
  const base = (origin ?? getAppOrigin()).replace(/\/$/, "");
  return `${base}/${slug}`;
}

export function publicOrderTicketUrl(token: string, origin?: string): string {
  const base = (origin ?? getAppOrigin()).replace(/\/$/, "");
  return `${base}/t/${encodeURIComponent(token)}`;
}
