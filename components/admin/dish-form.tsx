"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Category, Dish, PlanType } from "@/lib/types";
import { dishLimit } from "@/lib/plans";
import { dishFormSchema, fieldErrorsFromZod } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DishPhotoUpload } from "@/components/admin/dish-photo-upload";

type Props = {
  restaurantId: string;
  categories: Category[];
  dish?: Dish | null;
  publicSlug: string;
  planType?: PlanType | string;
  currentDishCount?: number;
};

export function DishForm({
  restaurantId,
  categories,
  dish,
  publicSlug,
  planType = "catalog",
  currentDishCount = 0,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(dish?.name ?? "");
  const [description, setDescription] = useState(dish?.description ?? "");
  const [price, setPrice] = useState(String(dish?.price ?? 0));
  const [categoryId, setCategoryId] = useState(dish?.category_id ?? "");
  const [isSide, setIsSide] = useState(dish?.is_side ?? false);
  const [isActive, setIsActive] = useState(dish?.is_active ?? true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(dish?.photo_url ?? null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const limit = dishLimit(planType);
  const atLimit = !dish && limit != null && currentDishCount >= limit;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (atLimit) {
      setFormError(
        `Tu plan Catálogo permite máximo ${limit} productos. Mejora a Menú al Día o Pro.`,
      );
      return;
    }

    const parsed = dishFormSchema.safeParse({
      name,
      description,
      price,
      category_id: categoryId || null,
      is_side: isSide,
      is_active: isActive,
      photo_url: photoUrl || null,
    });
    if (!parsed.success) {
      const errors = fieldErrorsFromZod(parsed.error);
      setFieldErrors(errors);
      const firstKey = Object.keys(errors)[0];
      if (firstKey) {
        document.getElementById(firstKey)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        document.getElementById(firstKey)?.focus();
      }
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const payload = {
      restaurant_id: restaurantId,
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      price: parsed.data.price,
      category_id: parsed.data.category_id || null,
      is_side: parsed.data.is_side,
      is_active: parsed.data.is_active,
      photo_url: parsed.data.photo_url || null,
    };

    const { error: dbError } = dish
      ? await supabase.from("dishes").update(payload).eq("id", dish.id)
      : await supabase.from("dishes").insert(payload);

    setSaving(false);
    if (dbError) {
      setFormError(dbError.message);
      return;
    }

    await fetch("/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: publicSlug }),
    });
    router.push("/admin/catalog");
    router.refresh();
  }

  async function onDelete() {
    if (!dish) return;
    if (!confirm("¿Eliminar este platillo?")) return;
    setDeleting(true);
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase.from("dishes").delete().eq("id", dish.id);
    if (error) {
      setFormError(error.message);
      setDeleting(false);
      return;
    }
    await fetch("/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: publicSlug }),
    });
    router.push("/admin/catalog");
    router.refresh();
  }

  if (atLimit) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center">
        <p className="font-semibold text-brand-dark">Límite del plan Catálogo</p>
        <p className="mt-2 text-sm text-muted">
          Ya tienes {currentDishCount}/{limit} productos. Mejora a Menú al Día o
          Pro para agregar más.
        </p>
        <Button
          type="button"
          className="mt-4"
          variant="secondary"
          onClick={() => router.push("/admin/catalog")}
        >
          Volver al catálogo
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-4">
      <DishPhotoUpload
        restaurantId={restaurantId}
        value={photoUrl}
        onChange={setPhotoUrl}
      />
      <div className="space-y-1.5">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!fieldErrors.name}
        />
        {fieldErrors.name ? (
          <p className="text-xs text-red-600">{fieldErrors.name}</p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="price">Precio regular (MXN)</Label>
        <Input
          id="price"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          aria-invalid={!!fieldErrors.price}
        />
        {fieldErrors.price ? (
          <p className="text-xs text-red-600">{fieldErrors.price}</p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="category_id">Categoría</Label>
        <select
          id="category_id"
          className="flex h-11 w-full rounded-lg border border-black/10 bg-surface px-3 text-sm"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-h-14 items-center justify-between rounded-xl border border-black/5 bg-surface px-3 py-3">
        <Label htmlFor="isSide">Es guarnición</Label>
        <Switch id="isSide" checked={isSide} onCheckedChange={setIsSide} />
      </div>
      <div className="flex min-h-14 items-center justify-between rounded-xl border border-black/5 bg-surface px-3 py-3">
        <Label htmlFor="isActive">Activo en catálogo</Label>
        <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
      </div>
      {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
      <div className="sticky bottom-0 space-y-2 bg-background/95 py-3 backdrop-blur">
        <Button type="submit" className="w-full" disabled={saving || deleting}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
        {dish ? (
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            onClick={onDelete}
            disabled={saving || deleting}
          >
            {deleting ? "Eliminando…" : "Eliminar"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
