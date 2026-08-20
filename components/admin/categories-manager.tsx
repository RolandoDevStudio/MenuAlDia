"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { can, type PlanType } from "@/lib/plans";
import { label } from "@/lib/business-labels";
import type { BusinessType, Category } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type CatRow = Category & { dish_count: number };

function SortableRow({
  cat,
  dishLabel,
  dishesLabel,
  editingId,
  editName,
  setEditName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  showFixedToggle,
  onToggleFixed,
}: {
  cat: CatRow;
  dishLabel: string;
  dishesLabel: string;
  editingId: string | null;
  editName: string;
  setEditName: (v: string) => void;
  onStartEdit: (c: CatRow) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (c: CatRow) => void;
  showFixedToggle: boolean;
  onToggleFixed: (c: CatRow, value: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const blocked = cat.dish_count > 0;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border border-black/5 bg-surface p-3",
        isDragging && "z-10 shadow-md",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-1 flex h-11 w-11 shrink-0 touch-none items-center justify-center rounded-lg text-muted hover:bg-black/5"
          aria-label="Arrastrar para reordenar"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          {editingId === cat.id ? (
            <div className="flex flex-wrap gap-2">
              <Input
                className="min-h-11 flex-1"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
              <Button
                type="button"
                size="sm"
                className="min-h-11"
                onClick={() => onSaveEdit(cat.id)}
              >
                Guardar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="min-h-11"
                onClick={onCancelEdit}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{cat.name}</p>
                <p className="text-xs text-muted">
                  {cat.dish_count}{" "}
                  {cat.dish_count === 1
                    ? dishLabel.toLowerCase()
                    : dishesLabel.toLowerCase()}
                  {!cat.is_fixed_catalog ? " · menú del día" : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11"
                  onClick={() => onStartEdit(cat)}
                  aria-label="Renombrar"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11 text-red-600 disabled:opacity-40"
                  disabled={blocked}
                  onClick={() => onDelete(cat)}
                  aria-label="Eliminar"
                  title={
                    blocked
                      ? `No puedes borrar: tiene ${cat.dish_count} ${dishesLabel.toLowerCase()}`
                      : "Eliminar"
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          {blocked ? (
            <p className="text-xs text-amber-800">
              No puedes borrar esta categoría porque tiene {cat.dish_count}{" "}
              {cat.dish_count === 1
                ? dishLabel.toLowerCase()
                : dishesLabel.toLowerCase()}
              . Reasigna{" "}
              {cat.dish_count === 1 ? "el" : "los"}{" "}
              {dishesLabel.toLowerCase()} a otra categoría primero.
            </p>
          ) : null}
          {showFixedToggle && editingId !== cat.id ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-black/5 px-2 py-2">
              <Label
                htmlFor={`fixed-${cat.id}`}
                className="text-xs font-normal text-muted"
              >
                Fija de catálogo
              </Label>
              <Switch
                id={`fixed-${cat.id}`}
                checked={cat.is_fixed_catalog}
                onCheckedChange={(v) => onToggleFixed(cat, v)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function CategoriesManager({
  restaurantId,
  restaurantSlug,
  businessType,
  planType,
}: {
  restaurantId: string;
  restaurantSlug: string;
  businessType: BusinessType | string | null;
  planType: PlanType;
}) {
  const categoriesLabel = label(businessType, "categories");
  const categoryLabel = label(businessType, "category");
  const dishLabel = label(businessType, "dish");
  const dishesLabel = label(businessType, "dishes");
  const showFixedToggle = can(planType, "daily_menu");

  const [rows, setRows] = useState<CatRow[]>([]);
  const [newName, setNewName] = useState("");
  const [newFixed, setNewFixed] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 220, tolerance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const ids = useMemo(() => rows.map((r) => r.id), [rows]);

  async function revalidate() {
    const res = await fetch("/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: restaurantSlug }),
    });
    if (!res.ok) {
      setMessage(
        "Guardado. El menú público puede tardar en actualizarse.",
      );
    }
  }

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: cats }, { data: dishes }] = await Promise.all([
      supabase
        .from("categories")
        .select("id, restaurant_id, name, sort_order, is_fixed_catalog")
        .eq("restaurant_id", restaurantId)
        .order("sort_order"),
      supabase
        .from("dishes")
        .select("category_id")
        .eq("restaurant_id", restaurantId)
        .is("archived_at", null),
    ]);

    const counts = new Map<string, number>();
    for (const d of dishes ?? []) {
      if (!d.category_id) continue;
      counts.set(d.category_id, (counts.get(d.category_id) ?? 0) + 1);
    }

    setRows(
      ((cats ?? []) as Category[]).map((c) => ({
        ...c,
        dish_count: counts.get(c.id) ?? 0,
      })),
    );
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCategory() {
    setError(null);
    setMessage(null);
    const name = newName.trim();
    if (!name) {
      setError(`Escribe un nombre de ${categoryLabel.toLowerCase()}.`);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: insErr } = await supabase.from("categories").insert({
      restaurant_id: restaurantId,
      name,
      sort_order: rows.length,
      is_fixed_catalog: showFixedToggle ? newFixed : true,
    });
    setBusy(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setNewName("");
    setNewFixed(true);
    setMessage(`${categoryLabel} creada`);
    await revalidate();
    await load();
  }

  async function saveEdit(id: string) {
    const name = editName.trim();
    if (!name) return;
    const supabase = createClient();
    const { error: updErr } = await supabase
      .from("categories")
      .update({ name })
      .eq("id", id);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    setEditingId(null);
    setMessage("Nombre actualizado");
    await revalidate();
    await load();
  }

  async function deleteCategory(cat: CatRow) {
    if (cat.dish_count > 0) return;
    setError(null);
    const supabase = createClient();
    const { error: delErr } = await supabase
      .from("categories")
      .delete()
      .eq("id", cat.id);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    setMessage("Categoría eliminada");
    await revalidate();
    await load();
  }

  async function toggleFixed(cat: CatRow, value: boolean) {
    const prev = rows;
    setRows((r) =>
      r.map((c) => (c.id === cat.id ? { ...c, is_fixed_catalog: value } : c)),
    );
    const supabase = createClient();
    const { error: updErr } = await supabase
      .from("categories")
      .update({ is_fixed_catalog: value })
      .eq("id", cat.id);
    if (updErr) {
      setRows(prev);
      setError(updErr.message);
      return;
    }
    await revalidate();
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = rows;
    const next = arrayMove(rows, oldIndex, newIndex).map((c, i) => ({
      ...c,
      sort_order: i,
    }));
    setRows(next);
    setError(null);

    const supabase = createClient();
    const results = await Promise.all(
      next.map((c, i) =>
        supabase
          .from("categories")
          .update({ sort_order: i })
          .eq("id", c.id),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      setRows(previous);
      setError(
        failed.error.message ||
          "No se pudo guardar el orden. Intenta de nuevo.",
      );
      return;
    }
    await revalidate();
  }

  return (
    <section className="space-y-3 rounded-2xl border border-black/5 bg-surface p-4">
      <div>
        <h2 className="text-sm font-semibold">{categoriesLabel}</h2>
        <p className="text-xs text-muted">
          Arrastra el ícono para reordenar. Así aparecen en el menú público.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-cat">Nueva {categoryLabel.toLowerCase()}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="new-cat"
            className="min-h-11 flex-1"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ej. Entradas"
          />
          <Button
            type="button"
            className="min-h-11"
            disabled={busy}
            onClick={() => void createCategory()}
          >
            <Plus className="h-4 w-4" />
            Añadir
          </Button>
        </div>
        {showFixedToggle ? (
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="new-fixed" className="text-xs font-normal">
              Fija de catálogo (vs menú del día)
            </Label>
            <Switch
              id="new-fixed"
              checked={newFixed}
              onCheckedChange={setNewFixed}
            />
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/10 px-3 py-6 text-center text-sm text-muted">
          Aún no hay {categoriesLabel.toLowerCase()}. Crea la primera arriba.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => void onDragEnd(e)}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {rows.map((cat) => (
                <SortableRow
                  key={cat.id}
                  cat={cat}
                  dishLabel={dishLabel}
                  dishesLabel={dishesLabel}
                  editingId={editingId}
                  editName={editName}
                  setEditName={setEditName}
                  onStartEdit={(c) => {
                    setEditingId(c.id);
                    setEditName(c.name);
                  }}
                  onSaveEdit={(id) => void saveEdit(id)}
                  onCancelEdit={() => setEditingId(null)}
                  onDelete={(c) => void deleteCategory(c)}
                  showFixedToggle={showFixedToggle}
                  onToggleFixed={(c, v) => void toggleFixed(c, v)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
