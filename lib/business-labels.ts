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
  | "combos";

const LABELS: Record<BusinessType, Record<LabelKey, string>> = {
  restaurante: {
    business: "Restaurante",
    dish: "Platillo",
    dishes: "Platillos",
    side: "Guarnición",
    sides: "Guarniciones",
    dailyMenu: "Menú del Día",
    catalog: "Catálogo",
    combo: "Combo",
    combos: "Combos",
  },
  servicios: {
    business: "Servicios",
    dish: "Servicio",
    dishes: "Servicios",
    side: "Opción",
    sides: "Opciones",
    dailyMenu: "Promoción del Día",
    catalog: "Servicios",
    combo: "Paquete",
    combos: "Paquetes",
  },
  productos: {
    business: "Tienda",
    dish: "Producto",
    dishes: "Productos",
    side: "Extra",
    sides: "Extras",
    dailyMenu: "Oferta del Día",
    catalog: "Catálogo",
    combo: "Colección",
    combos: "Colecciones",
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
