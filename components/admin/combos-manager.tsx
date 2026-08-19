"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Combo, Dish, Restaurant } from "@/lib/types";
import { slugifyCombo, comboDisplayPrice } from "@/lib/combo";
import { formatMxn } from "@/lib/money";
import { buildComboShareMessage } from "@/lib/whatsapp";
import { label } from "@/lib/business-labels";
import { DishPhotoUpload } from "@/components/admin/dish-photo-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type ComboRow = Combo & {
  items: Array<{ dish_id: string; quantity: number; dish?: Dish }>;
};

export function CombosManager({
  restaurant,
}: {
  restaurant: Restaurant;
}) {
  const combosLabel = label(restaurant.business_type, "combos");
  const comboLabel = label(restaurant.business_type, "combo");
  const dishesLabel = label(restaurant.business_type, "dishes");

  const [dishes, setDishes] = useState<Dish[]>([]);
  const [combos, setCombos] = useState<ComboRow[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [fixedPrice, setFixedPrice] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
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
        .eq("is_side", false)
        .order("sort_order"),
      supabase
        .from("combos")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .is("archived_at", null)
        .order("sort_order"),
    ]);
    setDishes((dishRows ?? []) as Dish[]);
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
    const dishMap = new Map(((dishRows ?? []) as Dish[]).map((d) => [d.id, d]));
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

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected],
  );

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
    if (selectedIds.length < 2) {
      setError("Selecciona al menos 2 productos.");
      return;
    }
    if (!title.trim()) {
      setError("Escribe un título.");
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
      })
      .select("*")
      .single();
    if (insError || !data) {
      setSaving(false);
      setError(insError?.message ?? "No se pudo crear");
      return;
    }
    const { error: itemsError } = await supabase.from("combo_items").insert(
      selectedIds.map((dish_id, i) => ({
        combo_id: data.id,
        dish_id,
        quantity: 1,
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
    setSelected({});
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

  function publicUrl(c: Combo) {
    return `${origin}/${restaurant.slug}?c=${c.slug}`;
  }

  async function copyLink(c: Combo) {
    await navigator.clipboard.writeText(publicUrl(c));
    setMessage("Link copiado");
  }

  async function copyWaText(c: ComboRow) {
    const names = c.items.map((i) => i.dish?.name ?? "Ítem").filter(Boolean);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">{combosLabel} Express</h1>
        <p className="text-sm text-muted">
          Empaqueta 2+ {dishesLabel.toLowerCase()} con link viral{" "}
          <code className="text-xs">?c=</code> y Open Graph.
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-black/5 bg-surface p-4">
        <h2 className="text-sm font-semibold">Nuevo {comboLabel.toLowerCase()}</h2>
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
        <div className="space-y-2">
          <Label>Incluye (≥2)</Label>
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {dishes.map((d) => (
              <li key={d.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2">
                  <Checkbox
                    checked={Boolean(selected[d.id])}
                    onCheckedChange={() =>
                      setSelected((p) => ({ ...p, [d.id]: !p[d.id] }))
                    }
                  />
                  <span className="flex-1 text-sm">{d.name}</span>
                  <span className="text-xs text-muted">
                    {formatMxn(Number(d.price))}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        <Button
          type="button"
          className="min-h-11 w-full"
          disabled={saving}
          onClick={() => void createCombo()}
        >
          {saving ? "Guardando…" : `Crear ${comboLabel.toLowerCase()}`}
        </Button>
      </div>

      <ul className="space-y-3">
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
            withItems.items.length >= 2
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
                  <p className="mt-1 text-sm text-brand font-semibold">
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
                {c.items.map((i) => i.dish?.name).filter(Boolean).join(" · ")}
              </p>
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
    </div>
  );
}
