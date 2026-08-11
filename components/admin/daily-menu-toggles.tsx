"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dish } from "@/lib/types";
import { formatMxn } from "@/lib/money";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  restaurantId: string;
  dailyMenuId: string;
  packagePrice: number;
  maxSides: number;
  mains: Dish[];
  sides: Dish[];
  selectedMainIds: string[];
  selectedSideIds: string[];
  publicSlug: string;
};

export function DailyMenuToggles({
  restaurantId,
  dailyMenuId,
  packagePrice: initialPrice,
  maxSides: initialMaxSides,
  mains,
  sides,
  selectedMainIds: initialMains,
  selectedSideIds: initialSides,
  publicSlug,
}: Props) {
  const router = useRouter();
  const [mainIds, setMainIds] = useState(new Set(initialMains));
  const [sideIds, setSideIds] = useState(new Set(initialSides));
  const [packagePrice, setPackagePrice] = useState(String(initialPrice));
  const [maxSides, setMaxSides] = useState(String(initialMaxSides));
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function revalidate() {
    await fetch("/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: publicSlug }),
    });
  }

  async function persistMains(next: Set<string>) {
    const supabase = createClient();
    const { error: delError } = await supabase
      .from("daily_menu_dishes")
      .delete()
      .eq("daily_menu_id", dailyMenuId);
    if (delError) throw new Error(delError.message);
    if (next.size > 0) {
      const { error: insError } = await supabase.from("daily_menu_dishes").insert(
        [...next].map((dish_id) => ({ daily_menu_id: dailyMenuId, dish_id })),
      );
      if (insError) throw new Error(insError.message);
    }
    await revalidate();
  }

  async function persistSides(next: Set<string>) {
    const supabase = createClient();
    const { error: delError } = await supabase
      .from("daily_menu_sides")
      .delete()
      .eq("daily_menu_id", dailyMenuId);
    if (delError) throw new Error(delError.message);
    if (next.size > 0) {
      const { error: insError } = await supabase.from("daily_menu_sides").insert(
        [...next].map((dish_id) => ({ daily_menu_id: dailyMenuId, dish_id })),
      );
      if (insError) throw new Error(insError.message);
    }
    await revalidate();
  }

  async function toggleMain(id: string, on: boolean) {
    const prev = new Set(mainIds);
    const next = new Set(mainIds);
    if (on) next.add(id);
    else next.delete(id);
    setMainIds(next);
    setError(null);
    setSavingId(`main-${id}`);
    try {
      await persistMains(next);
      router.refresh();
    } catch (e) {
      setMainIds(prev);
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleSide(id: string, on: boolean) {
    const prev = new Set(sideIds);
    const next = new Set(sideIds);
    if (on) next.add(id);
    else next.delete(id);
    setSideIds(next);
    setError(null);
    setSavingId(`side-${id}`);
    try {
      await persistSides(next);
      router.refresh();
    } catch (e) {
      setSideIds(prev);
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSavingId(null);
    }
  }

  async function saveMeta() {
    setError(null);
    setSuccess(null);
    setSavingMeta(true);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("daily_menu_selections")
      .update({
        package_price: Number(packagePrice) || 0,
        max_sides: Number(maxSides) || 1,
        menu_date: new Date().toISOString().slice(0, 10),
      })
      .eq("id", dailyMenuId)
      .eq("restaurant_id", restaurantId);

    setSavingMeta(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    await revalidate();
    setSuccess("Precio del menú actualizado");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-lg bg-accent/10 px-3 py-2 text-sm text-accent" role="status">
          {success}
        </p>
      ) : null}

      <section className="rounded-2xl border border-black/5 bg-surface p-4">
        <h2 className="text-sm font-semibold">Precio del paquete</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="packagePrice">Precio (MXN)</Label>
            <Input
              id="packagePrice"
              inputMode="decimal"
              value={packagePrice}
              onChange={(e) => setPackagePrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxSides">Máx. guarniciones</Label>
            <Input
              id="maxSides"
              inputMode="numeric"
              value={maxSides}
              onChange={(e) => setMaxSides(e.target.value)}
            />
          </div>
        </div>
        <Button className="mt-4 w-full" onClick={saveMeta} disabled={savingMeta}>
          {savingMeta ? "Guardando…" : "Guardar precio"}
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Platillos del día</h2>
        {mains.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/10 px-4 py-6 text-center">
            <p className="text-sm text-muted">No hay platillos en el catálogo.</p>
            <Button asChild variant="secondary" size="sm" className="mt-3">
              <Link href="/admin/catalog/new">Crear platillo</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {mains.map((dish) => (
              <li
                key={dish.id}
                className={cn(
                  "flex min-h-14 items-center justify-between gap-3 rounded-xl border border-black/5 bg-surface px-3 py-3",
                  savingId === `main-${dish.id}` && "opacity-70",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{dish.name}</p>
                  <p className="text-xs text-muted">
                    Regular {formatMxn(Number(dish.price))}
                  </p>
                </div>
                <Switch
                  checked={mainIds.has(dish.id)}
                  onCheckedChange={(on) => toggleMain(dish.id, on)}
                  disabled={savingId === `main-${dish.id}`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Guarniciones disponibles</h2>
        {sides.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/10 px-4 py-6 text-center">
            <p className="text-sm text-muted">
              Marca platillos como guarnición en el catálogo.
            </p>
            <Button asChild variant="secondary" size="sm" className="mt-3">
              <Link href="/admin/catalog/new">Ir al catálogo</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {sides.map((dish) => (
              <li
                key={dish.id}
                className={cn(
                  "flex min-h-14 items-center justify-between gap-3 rounded-xl border border-black/5 bg-surface px-3 py-3",
                  savingId === `side-${dish.id}` && "opacity-70",
                )}
              >
                <span className="font-medium">{dish.name}</span>
                <Switch
                  checked={sideIds.has(dish.id)}
                  onCheckedChange={(on) => toggleSide(dish.id, on)}
                  disabled={savingId === `side-${dish.id}`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
