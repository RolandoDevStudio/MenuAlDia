import type { BusinessType } from "@/lib/types";

export type LabelKey =
  | "dish"
  | "dishes"
  | "side"
  | "sides"
  | "dailyMenu"
  | "catalog"
  | "business"
  | "combo"
  | "combos"
  | "category"
  | "categories"
  | "popular";

const LABELS: Record<BusinessType, Record<LabelKey, string>> = {
  restaurante: {
    business: "Restaurante",
    dish: "Platillo",
    dishes: "Platillos",
    side: "Guarnición",
    sides: "Guarniciones",
    dailyMenu: "Especiales de hoy",
    catalog: "Catálogo",
    combo: "Combo",
    combos: "Combos",
    category: "Categoría",
    categories: "Categorías",
    popular: "Lo más pedido",
  },
  servicios: {
    business: "Servicios",
    dish: "Servicio",
    dishes: "Servicios",
    side: "Opción",
    sides: "Opciones",
    dailyMenu: "Promo de hoy",
    catalog: "Servicios",
    combo: "Paquete",
    combos: "Paquetes",
    category: "Categoría",
    categories: "Categorías",
    popular: "Destacado",
  },
  productos: {
    business: "Tienda",
    dish: "Producto",
    dishes: "Productos",
    side: "Extra",
    sides: "Extras",
    dailyMenu: "Oferta de hoy",
    catalog: "Catálogo",
    combo: "Colección",
    combos: "Colecciones",
    category: "Categoría",
    categories: "Categorías",
    popular: "Más pedido",
  },
};

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  restaurante: "Restaurante",
  servicios: "Servicios",
  productos: "Tienda",
};

export const BUSINESS_TYPES: BusinessType[] = [
  "restaurante",
  "servicios",
  "productos",
];

/** Map legacy DB values to current BusinessType. */
export function normalizeBusinessType(
  value: string | null | undefined,
): BusinessType {
  if (value === "estetica") return "servicios";
  if (value === "tienda") return "productos";
  if (value === "servicios" || value === "productos" || value === "restaurante") {
    return value;
  }
  return "restaurante";
}

export function labelsFor(
  businessType: BusinessType | string | null | undefined,
): Record<LabelKey, string> {
  const key = normalizeBusinessType(businessType ?? "restaurante");
  return LABELS[key] ?? LABELS.restaurante;
}

export function label(
  businessType: BusinessType | string | null | undefined,
  key: LabelKey,
): string {
  return labelsFor(businessType)[key];
}
