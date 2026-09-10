import { formatMxn } from "./money";

export type MenuSort = "menu" | "name" | "price_asc" | "price_desc";

export type MenuSearchFilters = {
  query: string;
  presupuestoMin: number | null;
  presupuestoMax: number | null;
  comensales: number | null;
  tags: string[];
  categoryIds: string[];
  popularOnly: boolean;
  sortBy: MenuSort;
};

export const emptyMenuFilters: MenuSearchFilters = {
  query: "",
  presupuestoMin: null,
  presupuestoMax: null,
  comensales: null,
  tags: [],
  categoryIds: [],
  popularOnly: false,
  sortBy: "menu",
};

function normalize(filters: MenuSearchFilters): MenuSearchFilters {
  return {
    ...emptyMenuFilters,
    ...filters,
    query: filters.query ?? "",
    tags: filters.tags ?? [],
    categoryIds: filters.categoryIds ?? [],
    popularOnly: Boolean(filters.popularOnly),
    sortBy: filters.sortBy ?? "menu",
  };
}

export function dishMatchesFilters(
  dish: {
    name: string;
    description?: string | null;
    price: number;
    category_id?: string | null;
    is_popular?: boolean;
  },
  raw: MenuSearchFilters,
): boolean {
  const filters = normalize(raw);
  if (filters.popularOnly && !dish.is_popular) return false;
  if (
    filters.categoryIds.length > 0 &&
    (!dish.category_id || !filters.categoryIds.includes(dish.category_id))
  ) {
    return false;
  }
  if (
    filters.presupuestoMin != null &&
    dish.price < filters.presupuestoMin
  ) {
    return false;
  }
  if (
    filters.presupuestoMax != null &&
    dish.price > filters.presupuestoMax
  ) {
    return false;
  }
  const hay = `${dish.name} ${dish.description ?? ""}`.toLowerCase();
  if (filters.query) {
    const tokens = filters.query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.every((t) => hay.includes(t))) return false;
  }
  for (const tag of filters.tags) {
    if (!hay.includes(tag.toLowerCase())) return false;
  }
  return true;
}

export function comboMatchesFilters(
  combo: {
    title: string;
    description?: string | null;
    price: number;
    itemNames: string;
  },
  raw: MenuSearchFilters,
): boolean {
  const filters = normalize(raw);
  if (filters.popularOnly) return false;
  if (filters.categoryIds.length > 0) return false;
  return dishMatchesFilters(
    {
      name: `${combo.title} ${combo.itemNames}`,
      description: combo.description,
      price: combo.price,
    },
    {
      ...filters,
      categoryIds: [],
      popularOnly: false,
    },
  );
}

export function sortMenuItems<T>(
  items: T[],
  sortBy: MenuSort | undefined,
  getName: (item: T) => string,
  getPrice: (item: T) => number,
): T[] {
  if (!sortBy || sortBy === "menu") return items;
  const copy = [...items];
  if (sortBy === "name") {
    copy.sort((a, b) => getName(a).localeCompare(getName(b), "es"));
  } else if (sortBy === "price_asc") {
    copy.sort((a, b) => getPrice(a) - getPrice(b));
  } else if (sortBy === "price_desc") {
    copy.sort((a, b) => getPrice(b) - getPrice(a));
  }
  return copy;
}

export function menuFiltersNarrow(raw: MenuSearchFilters): boolean {
  const filters = normalize(raw);
  return Boolean(
    filters.query.trim() ||
      filters.presupuestoMin != null ||
      filters.presupuestoMax != null ||
      filters.comensales != null ||
      filters.tags.length > 0 ||
      filters.categoryIds.length > 0 ||
      filters.popularOnly,
  );
}

export function countActiveMenuFilters(raw: MenuSearchFilters): number {
  const filters = normalize(raw);
  let n = 0;
  if (filters.presupuestoMin != null || filters.presupuestoMax != null) n += 1;
  if (filters.comensales != null) n += 1;
  if (filters.tags.length > 0) n += 1;
  if (filters.categoryIds.length > 0) n += 1;
  if (filters.popularOnly) n += 1;
  if (filters.sortBy !== "menu") n += 1;
  return n;
}

export function menuPricePresets(
  min: number,
  max: number,
): { label: string; min: number | null; max: number | null }[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= 0) return [];
  const lo = Math.max(0, min);
  const hi = Math.max(lo, max);
  if (hi <= lo) {
    return [{ label: `Hasta ${formatMxn(hi)}`, min: null, max: Math.ceil(hi) }];
  }
  const step = hi >= 80 ? 10 : 5;
  const roundUp = (n: number) => Math.ceil(n / step) * step;
  const roundDown = (n: number) => Math.floor(n / step) * step;
  const a = Math.max(roundUp(lo + (hi - lo) / 3), lo + step);
  const b = Math.max(roundDown(lo + (2 * (hi - lo)) / 3), a + step);
  const presets = [
    { label: `Hasta ${formatMxn(a)}`, min: null as number | null, max: a },
    { label: `${formatMxn(a)} – ${formatMxn(b)}`, min: a, max: b },
    { label: `Desde ${formatMxn(b)}`, min: b, max: null as number | null },
  ];
  return presets.filter((p) => p.max == null || p.min == null || p.max > p.min);
}
