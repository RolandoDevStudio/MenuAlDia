"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { BusinessType, Category, Dish } from "@/lib/types";
import { formatMxn } from "@/lib/money";
import { label } from "@/lib/business-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

type DishRow = Pick<
  Dish,
  | "id"
  | "name"
  | "photo_url"
  | "price"
  | "is_side"
  | "is_active"
  | "is_popular"
  | "sort_order"
  | "category_id"
>;

export function CatalogDishList({
  restaurantId,
  restaurantSlug,
  businessType,
  initialDishes,
  categories,
}: {
  restaurantId: string;
  restaurantSlug: string;
  businessType: BusinessType | string | null;
  initialDishes: DishRow[];
  categories: Category[];
}) {
  const router = useRouter();
  const dishLabel = label(businessType, "dish");
  const dishesLabel = label(businessType, "dishes");
  const sideLabel = label(businessType, "side");
  const categoryLabel = label(businessType, "category");
  const popularLabel = label(businessType, "popular");

  const [dishes, setDishes] = useState(initialDishes);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const catName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dishes.filter((d) => {
      if (catFilter === "none" && d.category_id) return false;
      if (
        catFilter !== "all" &&
        catFilter !== "none" &&
        d.category_id !== catFilter
      ) {
        return false;
      }
      if (q && !d.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [dishes, query, catFilter]);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected],
  );

  function toggleOne(id: string, on: boolean) {
    setSelected((p) => ({ ...p, [id]: on }));
  }

  function toggleAll(on: boolean) {
    const next: Record<string, boolean> = {};
    if (on) for (const d of filtered) next[d.id] = true;
    setSelected(next);
  }

  async function revalidate() {
    await fetch("/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: restaurantSlug }),
    });
  }

  async function archiveSelected() {
    if (selectedIds.length === 0) return;
    if (
      !confirm(
        `¿Archivar ${selectedIds.length} ${
          selectedIds.length === 1
            ? dishLabel.toLowerCase()
            : dishesLabel.toLowerCase()
        }? Podrás dejar de verlos en el catálogo activo.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("dishes")
      .update({
        archived_at: new Date().toISOString(),
        is_active: false,
      })
      .in("id", selectedIds)
      .eq("restaurant_id", restaurantId);
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setDishes((prev) => prev.filter((d) => !selectedIds.includes(d.id)));
    setSelected({});
    setMessage("Archivados");
    await revalidate();
    router.refresh();
  }

  if (dishes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          className="min-h-11 flex-1"
          placeholder={`Buscar ${dishesLabel.toLowerCase()}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="min-h-11 rounded-lg border border-black/10 bg-surface px-3 text-sm"
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          aria-label={`Filtrar por ${categoryLabel.toLowerCase()}`}
        >
          <option value="all">Todas las categorías</option>
          <option value="none">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={
              filtered.length > 0 &&
              filtered.every((d) => selected[d.id])
            }
            onCheckedChange={(v) => toggleAll(Boolean(v))}
          />
          Seleccionar visibles
        </label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-11"
          disabled={busy || selectedIds.length === 0}
          onClick={() => void archiveSelected()}
        >
          Archivar ({selectedIds.length})
        </Button>
      </div>

      {message ? <p className="text-sm text-muted">{message}</p> : null}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-muted">
          No hay resultados con ese filtro.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((dish) => (
            <li
              key={dish.id}
              className="flex min-h-14 items-center gap-2 rounded-xl border border-black/5 bg-surface p-3"
            >
              <Checkbox
                checked={Boolean(selected[dish.id])}
                onCheckedChange={(v) => toggleOne(dish.id, Boolean(v))}
                aria-label={`Seleccionar ${dish.name}`}
              />
              <Link
                href={`/admin/catalog/${dish.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 transition hover:opacity-90"
              >
                {dish.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={dish.photo_url}
                    alt={dish.name}
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-black/5 font-[family-name:var(--font-display)] text-lg text-brand/50">
                    {dish.name.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {dish.name}
                    {dish.is_popular ? (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                        {popularLabel}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted">
                    {dish.category_id
                      ? catName.get(dish.category_id) ?? "Categoría"
                      : "Sin categoría"}
                    {dish.is_side ? ` · ${sideLabel}` : ""}
                    {" · "}
                    {formatMxn(Number(dish.price))}
                    {!dish.is_active ? " · Inactivo" : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
