import type { BusinessType } from "@/lib/types";

export type LabelKey =
  | "dish"
  | "dishes"
  | "side"
  | "sides"
  | "dailyMenu"
  | "catalog"
  | "business";

const LABELS: Record<BusinessType, Record<LabelKey, string>> = {
  restaurante: {
    business: "Restaurante",
    dish: "Platillo",
    dishes: "Platillos",
    side: "Guarnición",
    sides: "Guarniciones",
    dailyMenu: "Menú del Día",
    catalog: "Catálogo",
  },
  estetica: {
    business: "Estética",
    dish: "Servicio",
    dishes: "Servicios",
    side: "Complemento",
    sides: "Complementos",
    dailyMenu: "Promoción del Día",
    catalog: "Servicios",
  },
  tienda: {
    business: "Tienda",
    dish: "Producto",
    dishes: "Productos",
    side: "Adicional",
    sides: "Adicionales",
    dailyMenu: "Destacados del Día",
    catalog: "Catálogo",
  },
  servicios: {
    business: "Servicios",
    dish: "Producto",
    dishes: "Productos",
    side: "Adicional",
    sides: "Adicionales",
    dailyMenu: "Destacados del Día",
    catalog: "Catálogo",
  },
};

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  restaurante: "Restaurante",
  estetica: "Estética / Belleza",
  tienda: "Tienda",
  servicios: "Servicios",
};

export const BUSINESS_TYPES: BusinessType[] = [
  "restaurante",
  "estetica",
  "tienda",
  "servicios",
];

export function labelsFor(
  businessType: BusinessType | string | null | undefined,
): Record<LabelKey, string> {
  const key = (businessType ?? "restaurante") as BusinessType;
  return LABELS[key] ?? LABELS.restaurante;
}

export function label(
  businessType: BusinessType | string | null | undefined,
  key: LabelKey,
): string {
  return labelsFor(businessType)[key];
}
