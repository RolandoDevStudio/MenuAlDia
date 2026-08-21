"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Combo, Dish, Restaurant } from "@/lib/types";
import { slugifyCombo, comboDisplayPrice } from "@/lib/combo";
import { formatMxn } from "@/lib/money";
import { buildComboShareMessage } from "@/lib/whatsapp";
import { label, normalizeBusinessType } from "@/lib/business-labels";
import { DishPhotoUpload } from "@/components/admin/dish-photo-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type ComboRow = Combo & {
  items: Array<{ dish_id: string; quantity: number; dish?: Dish }>;
};

function QtyStepper({
  value,
  onChange,
  label: ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="h-9 w-9 shrink-0"
        aria-label={`Quitar ${ariaLabel}`}
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums">
        {value}
      </span>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="h-9 w-9 shrink-0"
        aria-label={`Añadir ${ariaLabel}`}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function CombosManager({
  restaurant,
}: {
  restaurant: Restaurant;
}) {
  const combosLabel = label(restaurant.business_type, "combos");
  const comboLabel = label(restaurant.business_type, "combo");
  const dishesLabel = label(restaurant.business_type, "dishes");
  const dishLabel = label(restaurant.business_type, "dish");
  const sidesLabel = label(restaurant.business_type, "sides");
  const sideLabel = label(restaurant.business_type, "side");
  const isServicios =
    normalizeBusinessType(restaurant.business_type) === "servicios";

  const [mains, setMains] = useState<Dish[]>([]);
  const [sides, setSides] = useState<Dish[]>([]);
  const [allDishMap, setAllDishMap] = useState<Map<string, Dish>>(new Map());
  const [combos, setCombos] = useState<ComboRow[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [fixedPrice, setFixedPrice] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [allowPurchase, setAllowPurchase] = useState(true);
  const [allowBooking, setAllowBooking] = useState(isServicios);
  /** dishId → quantity (0 = not included) */
  const [qtyById, setQtyById] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: dishRows }, { data: comboRows }] = await Promise.all([
      supabase
        .from("dishes")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .is("archived_at", null)
        .order("sort_order"),
      supabase
        .from("combos")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .is("archived_at", null)
        .order("sort_order"),
    ]);
    const dishes = (dishRows ?? []) as Dish[];
    setMains(dishes.filter((d) => !d.is_side));
    setSides(dishes.filter((d) => d.is_side));
    setAllDishMap(new Map(dishes.map((d) => [d.id, d])));

    const list = (comboRows ?? []) as Combo[];
    const ids = list.map((c) => c.id);
    let items: Array<{ combo_id: string; dish_id: string; quantity: number }> =
      [];
    if (ids.length) {
      const { data } = await supabase
        .from("combo_items")
        .select("combo_id, dish_id, quantity")
        .in("combo_id", ids);
      items = data ?? [];
    }
    const dishMap = new Map(dishes.map((d) => [d.id, d]));
    setCombos(
      list.map((c) => ({
        ...c,
        items: items
          .filter((i) => i.combo_id === c.id)
          .map((i) => ({ ...i, dish: dishMap.get(i.dish_id) })),
      })),
    );
  }, [restaurant.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const lines = useMemo(
    () =>
      Object.entries(qtyById)
        .filter(([, q]) => q > 0)
        .map(([dish_id, quantity]) => ({ dish_id, quantity })),
    [qtyById],
  );

  const totalUnits = useMemo(
    () => lines.reduce((s, l) => s + l.quantity, 0),
    [lines],
  );

  const hasMain = useMemo(
    () =>
      lines.some((l) => {
        const d = allDishMap.get(l.dish_id);
        return d && !d.is_side;
      }),
    [lines, allDishMap],
  );

  const preventiveHint = useMemo(() => {
    if (totalUnits < 2) {
      return `Agrega al menos 2 ítems para completar el ${comboLabel.toLowerCase()}.`;
    }
    if (!hasMain) {
      return `Añade un ${dishLabel.toLowerCase()} (no solo ${sidesLabel.toLowerCase()}).`;
    }
    return null;
  }, [totalUnits, hasMain, comboLabel, dishLabel, sidesLabel]);

  const canCreate = !preventiveHint && Boolean(title.trim()) && !saving;

  function setQty(dishId: string, n: number) {
    setQtyById((prev) => {
      const next = { ...prev };
      if (n <= 0) delete next[dishId];
      else next[dishId] = n;
      return next;
    });
  }

  async function revalidate() {
    await fetch("/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: restaurant.slug }),
    });
  }

  async function createCombo() {
    setError(null);
    setMessage(null);
    if (preventiveHint) {
      setError(preventiveHint);
      return;
    }
    if (!title.trim()) {
      setError("Escribe un título.");
      return;
    }
    if (!allowPurchase && !allowBooking) {
      setError("Activa al menos Compra o Agendar.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const s = (slug.trim() || slugifyCombo(title)).slice(0, 48);
    const { data, error: insError } = await supabase
      .from("combos")
      .insert({
        restaurant_id: restaurant.id,
        title: title.trim(),
        slug: s,
        description: description.trim(),
        photo_url: photoUrl,
        fixed_price: fixedPrice ? Number(fixedPrice) : null,
        is_active: true,
        allow_purchase: allowPurchase,
        allow_booking: allowBooking,
      })
      .select("*")
      .single();
    if (insError || !data) {
      setSaving(false);
      setError(insError?.message ?? "No se pudo crear");
      return;
    }
    const { error: itemsError } = await supabase.from("combo_items").insert(
      lines.map((l, i) => ({
        combo_id: data.id,
        dish_id: l.dish_id,
        quantity: l.quantity,
        sort_order: i,
      })),
    );
    setSaving(false);
    if (itemsError) {
      setError(itemsError.message);
      return;
    }
    setTitle("");
    setDescription("");
    setSlug("");
    setFixedPrice("");
    setPhotoUrl(null);
    setAllowPurchase(true);
    setAllowBooking(isServicios);
    setQtyById({});
    setMessage(`${comboLabel} creado`);
    await revalidate();
    await load();
  }

  async function archiveCombo(id: string) {
    const supabase = createClient();
    await supabase
      .from("combos")
      .update({ archived_at: new Date().toISOString(), is_active: false })
      .eq("id", id);
    await revalidate();
    await load();
  }

  async function patchComboFlags(
    id: string,
    patch: { allow_purchase?: boolean; allow_booking?: boolean },
  ) {
    const supabase = createClient();
    const current = combos.find((c) => c.id === id);
    const nextPurchase =
      patch.allow_purchase ?? current?.allow_purchase !== false;
    const nextBooking =
      patch.allow_booking ?? current?.allow_booking === true;
    if (!nextPurchase && !nextBooking) {
      setError("Activa al menos Compra o Agendar.");
      return;
    }
    setError(null);
    await supabase.from("combos").update(patch).eq("id", id);
    await revalidate();
    await load();
  }

  function publicUrl(c: Combo) {
    return `${origin}/${restaurant.slug}?c=${c.slug}`;
  }

  async function copyLink(c: Combo) {
    await navigator.clipboard.writeText(publicUrl(c));
    setMessage("Link copiado");
  }

  async function copyWaText(c: ComboRow) {
    const names = c.items
      .map((i) => {
        const n = i.dish?.name ?? "Ítem";
        return i.quantity > 1 ? `${i.quantity}× ${n}` : n;
      })
      .filter(Boolean);
    const price =
      c.fixed_price != null
        ? Number(c.fixed_price)
        : c.items.reduce(
            (s, i) => s + Number(i.dish?.price ?? 0) * i.quantity,
            0,
          );
    const text = buildComboShareMessage({
      businessName: restaurant.name,
      comboTitle: c.title,
      description: c.description,
      itemNames: names,
      price,
      url: publicUrl(c),
    });
    await navigator.clipboard.writeText(text);
    setMessage("Texto para WhatsApp copiado");
  }

  function renderDishList(list: Dish[], sectionLabel: string) {
    if (list.length === 0) {
      return (
        <p className="text-xs text-muted">
          No hay {sectionLabel.toLowerCase()} activos.
        </p>
      );
    }
    return (
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {list.map((d) => {
          const q = qtyById[d.id] ?? 0;
          return (
            <li
              key={d.id}
              className="flex min-h-11 items-center gap-2 rounded-lg px-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{d.name}</p>
                <p className="text-xs text-muted">
                  {formatMxn(Number(d.price))}
                </p>
              </div>
              <QtyStepper
                value={q}
                onChange={(n) => setQty(d.id, n)}
                label={d.name}
              />
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">{combosLabel} Express</h1>
        <p className="text-sm text-muted">
          Empaqueta {dishesLabel.toLowerCase()} y{" "}
          {sidesLabel.toLowerCase()} con cantidades y link viral{" "}
          <code className="text-xs">?c=</code>.
        </p>
      </div>

      <ul className="space-y-3">
        {combos.length === 0 ? (
          <li className="rounded-xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-muted">
            Aún no hay {combosLabel.toLowerCase()}. Crea el primero abajo.
          </li>
        ) : null}
        {combos.map((c) => {
          const withItems = {
            ...c,
            items: c.items
              .filter((i) => i.dish)
              .map((i) => ({
                combo_id: c.id,
                dish_id: i.dish_id,
                quantity: i.quantity,
                sort_order: 0,
                dish: i.dish!,
              })),
          };
          const price =
            withItems.items.length >= 1
              ? comboDisplayPrice(withItems)
              : Number(c.fixed_price ?? 0);
          return (
            <li
              key={c.id}
              className="space-y-2 rounded-2xl border border-black/5 bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{c.title}</p>
                  <p className="text-xs text-muted">
                    /{restaurant.slug}?c={c.slug}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-brand">
                    {formatMxn(price)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void archiveCombo(c.id)}
                >
                  Archivar
                </Button>
              </div>
              <p className="text-xs text-muted">
                {c.items
                  .map((i) => {
                    const n = i.dish?.name;
                    if (!n) return null;
                    return i.quantity > 1 ? `${i.quantity}× ${n}` : n;
                  })
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {isServicios ? (
                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="inline-flex items-center gap-2">
                    <Switch
                      checked={c.allow_booking === true}
                      onCheckedChange={(v) =>
                        void patchComboFlags(c.id, { allow_booking: v })
                      }
                    />
                    Agendar
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <Switch
                      checked={c.allow_purchase !== false}
                      onCheckedChange={(v) =>
                        void patchComboFlags(c.id, { allow_purchase: v })
                      }
                    />
                    Compra
                  </label>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11"
                  onClick={() => void copyLink(c)}
                >
                  Copiar link
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11"
                  onClick={() => void copyWaText(c)}
                >
                  Copiar texto WhatsApp
                </Button>
                <Button asChild variant="secondary" className="min-h-11">
                  <Link href={`/admin/flyer?combo=${c.id}`}>Usar en Flyer</Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <details className="space-y-3 rounded-2xl border border-black/5 bg-surface p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
          Nuevo {comboLabel.toLowerCase()} ▸
        </summary>
        <div className="mt-3 space-y-3 border-t border-black/5 pt-3">
        <div className="space-y-1.5">
          <Label>Título</Label>
          <Input
            className="min-h-11"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slug) setSlug(slugifyCombo(e.target.value));
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Slug (URL)</Label>
          <Input
            className="min-h-11"
            value={slug}
            onChange={(e) => setSlug(slugifyCombo(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Descripción</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Precio paquete (opcional)</Label>
          <Input
            className="min-h-11"
            inputMode="decimal"
            value={fixedPrice}
            onChange={(e) => setFixedPrice(e.target.value)}
            placeholder="Vacío = suma de productos"
          />
        </div>
        <DishPhotoUpload
          restaurantId={restaurant.id}
          value={photoUrl}
          onChange={setPhotoUrl}
          label="Imagen promo"
          kind="banner"
        />

        {isServicios ? (
          <div className="space-y-2 rounded-xl border border-black/5 bg-background/60 p-3">
            <p className="text-xs font-semibold">Cómo lo pide el cliente</p>
            <div className="flex min-h-11 items-center justify-between gap-3">
              <Label htmlFor="combo-booking">Se puede agendar</Label>
              <Switch
                id="combo-booking"
                checked={allowBooking}
                onCheckedChange={setAllowBooking}
              />
            </div>
            <div className="flex min-h-11 items-center justify-between gap-3">
              <Label htmlFor="combo-purchase">Se puede comprar</Label>
              <Switch
                id="combo-purchase"
                checked={allowPurchase}
                onCheckedChange={setAllowPurchase}
              />
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>{dishesLabel}</Label>
          {renderDishList(mains, dishesLabel)}
        </div>
        <div className="space-y-2">
          <Label>
            {sidesLabel} ({sideLabel.toLowerCase()}s incluidas)
          </Label>
          {renderDishList(sides, sidesLabel)}
        </div>

        {preventiveHint ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {preventiveHint}
          </p>
        ) : (
          <p className="text-xs text-muted">
            {totalUnits} unidad{totalUnits === 1 ? "" : "es"} en el paquete.
          </p>
        )}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        <Button
          type="button"
          className="min-h-11 w-full"
          disabled={!canCreate}
          onClick={() => void createCombo()}
        >
          {saving ? "Guardando…" : `Crear ${comboLabel.toLowerCase()}`}
        </Button>
        </div>
      </details>
    </div>
  );
}
