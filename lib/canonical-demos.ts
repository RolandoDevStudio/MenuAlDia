import type { BusinessType } from "@/lib/types";

export type CanonicalDemoId = "restaurante" | "servicios" | "tienda";

export type CanonicalDemo = {
  id: CanonicalDemoId;
  slug: string;
  businessType: BusinessType;
  label: string;
  /** CTA for sales WhatsApp */
  ctaLabel: string;
  /** Short label for tabs */
  tabLabel: string;
};

/** Official production demos / clone templates. */
export const CANONICAL_DEMOS: readonly CanonicalDemo[] = [
  {
    id: "restaurante",
    slug: "demo-restaurante",
    businessType: "restaurante",
    label: "Restaurante",
    tabLabel: "Restaurante",
    ctaLabel: "Crear mi Menú de Restaurante",
  },
  {
    id: "servicios",
    slug: "demo-servicios",
    businessType: "servicios",
    label: "Servicios",
    tabLabel: "Servicios",
    ctaLabel: "Crear mi Catálogo de Servicios",
  },
  {
    id: "tienda",
    slug: "demo-tienda",
    businessType: "productos",
    label: "Tienda",
    tabLabel: "Tienda",
    ctaLabel: "Crear mi Catálogo de Tienda",
  },
] as const;

export const OFFICIAL_DOMAIN = "menualdia.com.mx";

export function isCanonicalDemoSlug(slug: string): boolean {
  return CANONICAL_DEMOS.some((d) => d.slug === slug);
}

export function getCanonicalDemo(
  idOrSlug: string,
): CanonicalDemo | undefined {
  return CANONICAL_DEMOS.find(
    (d) => d.id === idOrSlug || d.slug === idOrSlug,
  );
}

export function salesInterestMessage(giroLabel: string): string {
  return `Hola, vi la demo de ${giroLabel} en ${OFFICIAL_DOMAIN} y me interesa activar mi prueba.`;
}
