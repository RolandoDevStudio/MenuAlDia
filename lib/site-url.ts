/** Public site origin for menu links, QR, OG. */
export function getAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return "https://menualdia.com.mx";
}

export function publicMenuUrl(slug: string, origin?: string): string {
  const base = (origin ?? getAppOrigin()).replace(/\/$/, "");
  return `${base}/${slug}`;
}
