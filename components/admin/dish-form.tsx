"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { BusinessType, Category, Dish, DishAddon, PlanType } from "@/lib/types";
import { PLAN_LABELS, photoDishLimit } from "@/lib/plans";
import { label, normalizeBusinessType } from "@/lib/business-labels";
import { dishFormSchema, fieldErrorsFromZod } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DishPhotoUpload } from "@/components/admin/dish-photo-upload";
import { useAdminDockSave } from "@/components/admin/admin-dock";
import {
  UNIT_TYPE_LABELS,
  defaultStepForUnit,
  isDishUnitType,
  type DishUnitType,
} from "@/lib/units";

type Props = {
  restaurantId: string;
  categories: Category[];
  dish?: Dish | null;
  publicSlug: string;
  planType?: PlanType | string;
  currentPhotoCount?: number;
  businessType?: BusinessType | string | null;
};

export function DishForm({
  restaurantId,
  categories,
  dish,
  publicSlug,
  planType = "catalog",
  currentPhotoCount = 0,
  businessType = "restaurante",
}: Props) {
  const router = useRouter();
  const dishLabel = label(businessType, "dish");
  const sideLabel = label(businessType, "side");
  const isServicios = normalizeBusinessType(businessType) === "servicios";
  const isTienda = normalizeBusinessType(businessType) === "productos";
  const [name, setName] = useState(dish?.name ?? "");
  const [description, setDescription] = useState(dish?.description ?? "");
  const [price, setPrice] = useState(String(dish?.price ?? 0));
  const [categoryId, setCategoryId] = useState(dish?.category_id ?? "");
  const [isSide, setIsSide] = useState(dish?.is_side ?? false);
  const [isActive, setIsActive] = useState(dish?.is_active ?? true);
  const popularLabel = label(businessType, "popular");
  const [isPopular, setIsPopular] = useState(dish?.is_popular ?? false);
  const [allowPurchase, setAllowPurchase] = useState(
    dish?.allow_purchase !== false,
  );
  const [allowBooking, setAllowBooking] = useState(
    dish?.allow_booking ?? isServicios,
  );
  const [unitType, setUnitType] = useState<DishUnitType>(
    isDishUnitType(dish?.unit_type) ? dish!.unit_type! : "unit",
  );
  const [stepValue, setStepValue] = useState(
    String(dish?.step_value ?? defaultStepForUnit("unit")),
  );
  const [photoUrl, setPhotoUrl] = useState<string | null>(dish?.photo_url ?? null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addons, setAddons] = useState<DishAddon[]>([]);
  const [addonName, setAddonName] = useState("");
  const [addonPrice, setAddonPrice] = useState("0");

  const photoLimit = photoDishLimit(planType);
  const resolvedPlan: PlanType =
    planType === "daily" || planType === "pro" || planType === "catalog"
      ? planType
      : "catalog";
  const planLabel = PLAN_LABELS[resolvedPlan];
  const hadPhoto = Boolean(dish?.photo_url?.trim());
  const hasPhoto = Boolean(photoUrl?.trim());
  const addingNewPhoto = hasPhoto && !hadPhoto;
  const atPhotoLimit = currentPhotoCount >= photoLimit;
  const canAddPhoto = hadPhoto || !atPhotoLimit;
  const photoLimitMessage = `Tu plan ${planLabel} permite hasta ${photoLimit} productos con foto (${currentPhotoCount}/${photoLimit}). Mejora de plan para subir más fotos.`;

  const loadAddons = useCallback(async () => {
    if (!dish) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("dish_addons")
      .select("*")
      .eq("dish_id", dish.id)
      .is("archived_at", null)
      .order("sort_order");
    setAddons((data ?? []) as DishAddon[]);
  }, [dish]);

  useEffect(() => {
    void loadAddons();
  }, [loadAddons]);

  useAdminDockSave({
    formId: "dish-form",
    label: "Guardar",
    disabled: saving || deleting,
    pending: saving,
  });

  async function revalidate() {
    await fetch("/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: publicSlug }),
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (addingNewPhoto && atPhotoLimit) {
      setFormError(photoLimitMessage);
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

    if (!allowPurchase && !allowBooking) {
      setFormError("Activa al menos Compra o Agendar.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const stepNum = Number(stepValue);
    const payload = {
      restaurant_id: restaurantId,
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      price: parsed.data.price,
      category_id: parsed.data.category_id || null,
      is_side: parsed.data.is_side,
      is_active: parsed.data.is_active,
      is_popular: isPopular,
      photo_url: parsed.data.photo_url || null,
      allow_purchase: allowPurchase,
      allow_booking: allowBooking,
      unit_type: isTienda ? unitType : "unit",
      step_value: isTienda
        ? Number.isFinite(stepNum) && stepNum > 0
          ? stepNum
          : defaultStepForUnit(unitType)
        : 1,
    };

    const { data: saved, error: dbError } = dish
      ? await supabase
          .from("dishes")
          .update(payload)
          .eq("id", dish.id)
          .select("id")
          .single()
      : await supabase.from("dishes").insert(payload).select("id").single();

    setSaving(false);
    if (dbError) {
      setFormError(dbError.message);
      return;
    }

    await revalidate();
    if (dish) {
      router.refresh();
      setFormError(null);
    } else if (saved?.id) {
      router.push(`/admin/catalog/${saved.id}`);
      router.refresh();
    } else {
      router.push("/admin/catalog");
      router.refresh();
    }
  }

  async function onArchive() {
    if (!dish) return;
    if (!confirm(`¿Archivar este ${dishLabel.toLowerCase()}? No se borrará el historial.`))
      return;
    setDeleting(true);
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("dishes")
      .update({ archived_at: new Date().toISOString(), is_active: false })
      .eq("id", dish.id);
    if (error) {
      setFormError(error.message);
      setDeleting(false);
      return;
    }
    await revalidate();
    router.push("/admin/catalog");
    router.refresh();
  }

  async function addAddon() {
    if (!dish || !addonName.trim()) return;
    const supabase = createClient();
    const { error } = await supabase.from("dish_addons").insert({
      dish_id: dish.id,
      name: addonName.trim(),
      price_delta: Number(addonPrice) || 0,
      sort_order: addons.length,
      is_active: true,
    });
    if (error) {
      setFormError(error.message);
      return;
    }
    setAddonName("");
    setAddonPrice("0");
    await loadAddons();
    await revalidate();
  }

  async function archiveAddon(id: string) {
    const supabase = createClient();
    await supabase
      .from("dish_addons")
      .update({ archived_at: new Date().toISOString(), is_active: false })
      .eq("id", id);
    await loadAddons();
    await revalidate();
  }

  return (
    <form id="dish-form" onSubmit={onSubmit} className="space-y-4 pb-4">
      <Link
        href="/admin/catalog"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand"
      >
        <ArrowLeft className="h-4 w-4" />
        Catálogo
      </Link>
      <DishPhotoUpload
        restaurantId={restaurantId}
        value={photoUrl}
        onChange={setPhotoUrl}
        canAddPhoto={canAddPhoto}
        limitMessage={photoLimitMessage}
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
      {isTienda ? (
        <div className="space-y-3 rounded-xl border border-black/5 bg-surface p-3">
          <p className="text-sm font-semibold">Unidad de venta</p>
          <div className="space-y-1.5">
            <Label htmlFor="unit_type">Se vende por</Label>
            <select
              id="unit_type"
              className="flex h-11 w-full rounded-lg border border-black/10 bg-background px-3 text-sm"
              value={unitType}
              onChange={(e) => {
                const u = e.target.value as DishUnitType;
                setUnitType(u);
                setStepValue(String(defaultStepForUnit(u)));
              }}
            >
              {(Object.keys(UNIT_TYPE_LABELS) as DishUnitType[]).map((u) => (
                <option key={u} value={u}>
                  {UNIT_TYPE_LABELS[u]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="step_value">Incremento en el carrito</Label>
            <Input
              id="step_value"
              inputMode="decimal"
              value={stepValue}
              onChange={(e) => setStepValue(e.target.value)}
            />
            <p className="text-[11px] text-muted">
              Ej. 1 para piezas, 0.1 o 0.25 para kg/L.
            </p>
          </div>
        </div>
      ) : null}
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
        <Label htmlFor="isSide">Es {sideLabel} (legacy)</Label>
        <Switch id="isSide" checked={isSide} onCheckedChange={setIsSide} />
      </div>
      <div className="flex min-h-14 items-center justify-between rounded-xl border border-black/5 bg-surface px-3 py-3">
        <Label htmlFor="isActive">Activo en catálogo</Label>
        <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
      </div>
      <div className="flex min-h-14 items-center justify-between rounded-xl border border-black/5 bg-surface px-3 py-3">
        <div>
          <Label htmlFor="isPopular">{popularLabel}</Label>
          <p className="text-xs text-muted">Badge en el menú público</p>
        </div>
        <Switch
          id="isPopular"
          checked={isPopular}
          onCheckedChange={setIsPopular}
        />
      </div>

      {isServicios ? (
        <div className="space-y-2 rounded-xl border border-black/5 bg-surface p-3">
          <p className="text-sm font-semibold">Cómo lo pide el cliente</p>
          <p className="text-xs text-muted">
            Agendar = cita por WhatsApp. Compra = pedido/carrito (productos).
          </p>
          <div className="flex min-h-12 items-center justify-between gap-3">
            <Label htmlFor="allowBooking">Se puede agendar</Label>
            <Switch
              id="allowBooking"
              checked={allowBooking}
              onCheckedChange={setAllowBooking}
            />
          </div>
          <div className="flex min-h-12 items-center justify-between gap-3">
            <Label htmlFor="allowPurchase">Se puede comprar</Label>
            <Switch
              id="allowPurchase"
              checked={allowPurchase}
              onCheckedChange={setAllowPurchase}
            />
          </div>
        </div>
      ) : null}

      {dish ? (
        <div className="space-y-3 rounded-2xl border border-black/5 bg-surface p-4">
          <h2 className="text-sm font-semibold">{sideLabel}s / adicionales</h2>
          <p className="text-xs text-muted">
            Opciones propias de este {dishLabel.toLowerCase()}. Guarda el
            producto primero si es nuevo.
          </p>
          <ul className="space-y-2">
            {addons.map((a) => (
              <li
                key={a.id}
                className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-background/70 px-3 py-2 text-sm"
              >
                <span>
                  {a.name}
                  {Number(a.price_delta) > 0
                    ? ` (+$${Number(a.price_delta)})`
                    : ""}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void archiveAddon(a.id)}
                >
                  Archivar
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Nombre"
              value={addonName}
              onChange={(e) => setAddonName(e.target.value)}
              className="min-h-11"
            />
            <Input
              placeholder="+$"
              inputMode="decimal"
              value={addonPrice}
              onChange={(e) => setAddonPrice(e.target.value)}
              className="min-h-11 sm:w-24"
            />
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => void addAddon()}
            >
              Agregar
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">
          Después de crear el {dishLabel.toLowerCase()} podrás agregar
          adicionales.
        </p>
      )}

      {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
      {dish ? (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={onArchive}
          disabled={saving || deleting}
        >
          {deleting ? "Archivando…" : "Archivar"}
        </Button>
      ) : null}
    </form>
  );
}
