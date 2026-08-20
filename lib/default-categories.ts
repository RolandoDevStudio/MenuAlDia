import type { BusinessType } from "@/lib/types";
import { normalizeBusinessType } from "@/lib/business-labels";

export type DefaultCategorySeed = {
  name: string;
  sort_order: number;
  is_fixed_catalog: boolean;
};

/** Base categories when a new tenant has none after clone/template. */
export function defaultCategoriesFor(
  businessType: BusinessType | string | null | undefined,
): DefaultCategorySeed[] {
  const bt = normalizeBusinessType(businessType);
  if (bt === "productos") {
    return [
      { name: "Novedades", sort_order: 0, is_fixed_catalog: true },
      { name: "Más Vendidos", sort_order: 1, is_fixed_catalog: true },
      { name: "General", sort_order: 2, is_fixed_catalog: true },
    ];
  }
  if (bt === "servicios") {
    return [
      { name: "Servicios", sort_order: 0, is_fixed_catalog: true },
      { name: "Paquetes", sort_order: 1, is_fixed_catalog: true },
      { name: "Adicionales", sort_order: 2, is_fixed_catalog: true },
    ];
  }
  return [
    { name: "Entradas", sort_order: 0, is_fixed_catalog: true },
    { name: "Platillos Fuertes", sort_order: 1, is_fixed_catalog: true },
    { name: "Bebidas", sort_order: 2, is_fixed_catalog: true },
    { name: "Guarniciones", sort_order: 3, is_fixed_catalog: false },
  ];
}
