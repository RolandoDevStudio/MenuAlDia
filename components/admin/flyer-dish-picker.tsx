"use client";

import { useMemo, useState } from "react";
import type { Dish } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { labelsFor } from "@/lib/business-labels";

export type FlyerDishPickerCategory = {
  id: string;
  name: string;
  sort_order: number;
};

type Props = {
  dishes: Dish[];
  categories: FlyerDishPickerCategory[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  businessType?: string | null;
  label?: string;
  emptyHint?: string;
};

export function FlyerDishPicker({
  dishes,
  categories,
  selectedIds,
  onChange,
  businessType,
  label,
  emptyHint,
}: Props) {
  const [query, setQuery] = useState("");
  const giro = labelsFor(businessType);
  const title = label ?? giro.dishes;

  const catOrder = useMemo(() => {
    const sorted = [...categories].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    );
    return sorted;
  }, [categories]);

  const catName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of catOrder) m.set(c.id, c.name);
    return m;
  }, [catOrder]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? dishes.filter((d) => d.name.toLowerCase().includes(q))
      : dishes;
    return [...list].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    );
  }, [dishes, query]);

  const groups = useMemo(() => {
    const byCat = new Map<string | null, Dish[]>();
    for (const d of filtered) {
      const key = d.category_id;
      const arr = byCat.get(key) ?? [];
      arr.push(d);
      byCat.set(key, arr);
    }
    const ordered: { key: string | null; name: string; items: Dish[] }[] = [];
    for (const c of catOrder) {
      const items = byCat.get(c.id);
      if (items?.length) ordered.push({ key: c.id, name: c.name, items });
    }
    const uncategorized = byCat.get(null);
    if (uncategorized?.length) {
      ordered.push({
        key: null,
        name: `Sin ${giro.category.toLowerCase()}`,
        items: uncategorized,
      });
    }
    // categories that exist on dishes but not in list
    for (const [key, items] of byCat) {
      if (key == null) continue;
      if (ordered.some((g) => g.key === key)) continue;
      ordered.push({
        key,
        name: catName.get(key) ?? giro.category,
        items,
      });
    }
    return ordered;
  }, [filtered, catOrder, catName, giro.category]);

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  }

  if (dishes.length === 0) {
    return (
      <p className="text-xs text-muted">
        {emptyHint ?? `No hay ${giro.dishes.toLowerCase()} activos.`}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Label>{title}</Label>
        <span className="text-xs text-muted">
          {selectedIds.length} seleccionado
          {selectedIds.length === 1 ? "" : "s"}
        </span>
      </div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Buscar ${giro.dishes.toLowerCase()}…`}
        className="h-10"
      />
      <div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-black/5 bg-surface p-2">
        {groups.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted">Sin resultados</p>
        ) : (
          groups.map((g) => (
            <div key={g.key ?? "__none"} className="space-y-1.5">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {g.name}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((d) => {
                  const active = selectedIds.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggle(d.id)}
                      className={cn(
                        "min-h-9 rounded-lg border px-2.5 text-left text-sm font-medium transition-colors",
                        active
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-black/10 bg-white text-foreground",
                      )}
                    >
                      {d.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
