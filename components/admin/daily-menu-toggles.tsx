"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { BusinessType, Dish } from "@/lib/types";
import { formatMxn } from "@/lib/money";
import { labelsFor } from "@/lib/business-labels";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PricingMode = "package" | "individual";

type Props = {
  restaurantId: string;
  dailyMenuId: string;
  packagePrice: number;
  maxSides: number;
  pricingMode?: PricingMode;
  isActive?: boolean;
  mains: Dish[];
  sides: Dish[];
  selectedMainIds: string[];
  selectedSideIds: string[];
  publicSlug: string;
  businessType?: BusinessType | string | null;
};

export function DailyMenuToggles({
  restaurantId,
  dailyMenuId,
  packagePrice: initialPrice,
  maxSides: initialMaxSides,
  pricingMode: initialPricingMode = "package",
  isActive = true,
  mains,
  sides,
  selectedMainIds: initialMains,
  selectedSideIds: initialSides,
  publicSlug,
  businessType = "restaurante",
}: Props) {
  const router = useRouter();
  const labels = labelsFor(businessType);
  const [mainIds, setMainIds] = useState(new Set(initialMains));
  const [sideIds, setSideIds] = useState(new Set(initialSides));
  const [packagePrice, setPackagePrice] = useState(String(initialPrice));
  const [maxSides, setMaxSides] = useState(String(initialMaxSides));
  const [pricingMode, setPricingMode] = useState<PricingMode>(
    initialPricingMode,
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "on" | "off">("all");

  const q = query.trim().toLowerCase();
  function matchesDish(dish: Dish, selected: boolean) {
    if (q && !dish.name.toLowerCase().includes(q)) return false;
    if (filter === "on" && !selected) return false;
    if (filter === "off" && selected) return false;
    return true;
  }
  const filteredMains = mains.filter((d) => matchesDish(d, mainIds.has(d.id)));
  const filteredSides = sides.filter((d) => matchesDish(d, sideIds.has(d.id)));

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
      toast.success(on ? "Agregado al menú de hoy" : "Quitado del menú de hoy");
      router.refresh();
    } catch (e) {
      setMainIds(prev);
      const msg = e instanceof Error ? e.message : "No se pudo guardar";
      setError(msg);
      toast.error(msg);
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
      toast.success(on ? "Guarnición activa" : "Guarnición desactivada");
      router.refresh();
    } catch (e) {
      setSideIds(prev);
      const msg = e instanceof Error ? e.message : "No se pudo guardar";
      setError(msg);
      toast.error(msg);
    } finally {
      setSavingId(null);
    }
  }

  async function saveMeta() {
    setError(null);
    setSavingMeta(true);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("daily_menu_selections")
      .update({
        package_price: Number(packagePrice) || 0,
        max_sides: Number(maxSides) || 1,
        pricing_mode: pricingMode,
        menu_date: new Date().toISOString().slice(0, 10),
      })
      .eq("id", dailyMenuId)
      .eq("restaurant_id", restaurantId);

    setSavingMeta(false);
    if (dbError) {
      setError(dbError.message);
      toast.error(dbError.message);
      return;
    }
    await revalidate();
    toast.success("Configuración del día guardada");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {!isActive ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {labels.dailyMenu} está oculto en el menú público.{" "}
          <Link href="/admin/settings#daily-menu" className="font-semibold underline">
            Activarlo en Ajustes
          </Link>
        </p>
      ) : null}

      <div className="rounded-xl border border-black/5 bg-surface/80 px-3 py-3 text-xs leading-relaxed text-muted">
        <p>
          Activa las <strong>opciones</strong> del día. El cliente elige{" "}
          <strong>un</strong> {labels.dish.toLowerCase()} y hasta N{" "}
          {labels.sides.toLowerCase()} — no se agregan todos juntos como combo.
        </p>
        <p className="mt-1">
          Distinto de <strong>{labels.popular}</strong>: ese es solo un badge en
          el {labels.catalog.toLowerCase()}, sin precio paquete.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-black/5 bg-surface p-4 space-y-3">
        <h2 className="text-sm font-semibold">Precio y límites</h2>
        <div className="space-y-2">
          <Label>Cómo se cobra</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={pricingMode === "package" ? "default" : "secondary"}
              className="min-h-11"
              onClick={() => setPricingMode("package")}
            >
              Precio paquete
            </Button>
            <Button
              type="button"
              variant={pricingMode === "individual" ? "default" : "secondary"}
              className="min-h-11"
              onClick={() => setPricingMode("individual")}
            >
              Precio individual
            </Button>
          </div>
          <p className="text-[11px] text-muted">
            {pricingMode === "package"
              ? "Un solo precio fijo sin importar qué opción elija el cliente."
              : `Se usa el precio de catálogo del ${labels.dish.toLowerCase()} elegido.`}
          </p>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-3">
          {pricingMode === "package" ? (
            <div className="space-y-1.5">
              <Label htmlFor="packagePrice">Precio paquete (MXN)</Label>
              <Input
                id="packagePrice"
                inputMode="decimal"
                value={packagePrice}
                onChange={(e) => setPackagePrice(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Precio</Label>
              <p className="flex h-11 items-center text-sm text-muted">
                Según cada {labels.dish.toLowerCase()}
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="maxSides">Máx. {labels.sides.toLowerCase()}</Label>
            <Input
              id="maxSides"
              inputMode="numeric"
              value={maxSides}
              onChange={(e) => setMaxSides(e.target.value)}
            />
          </div>
        </div>
        <Button className="w-full" onClick={() => void saveMeta()} disabled={savingMeta}>
          {savingMeta ? "Guardando…" : "Guardar configuración"}
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Opciones de {labels.dishes.toLowerCase()} hoy
        </h2>
        <div className="space-y-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar ${labels.dish.toLowerCase()}…`}
            className="min-h-11"
            aria-label="Buscar"
          />
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "Todos"],
                ["on", "En el menú"],
                ["off", "Fuera"],
              ] as const
            ).map(([id, lab]) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={filter === id ? "default" : "outline"}
                onClick={() => setFilter(id)}
              >
                {lab}
              </Button>
            ))}
          </div>
        </div>
        {mains.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/10 px-4 py-6 text-center">
            <p className="text-sm text-muted">
              No hay {labels.dishes.toLowerCase()} en el {labels.catalog.toLowerCase()}.
            </p>
            <Button asChild variant="secondary" size="sm" className="mt-3">
              <Link href="/admin/catalog/new">Crear {labels.dish.toLowerCase()}</Link>
            </Button>
          </div>
        ) : filteredMains.length === 0 ? (
          <p className="text-sm text-muted">Sin resultados con ese filtro.</p>
        ) : (
          <ul className="space-y-2">
            {filteredMains.map((dish) => (
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
                    Catálogo {formatMxn(Number(dish.price))}
                  </p>
                </div>
                <Switch
                  checked={mainIds.has(dish.id)}
                  onCheckedChange={(on) => void toggleMain(dish.id, on)}
                  disabled={savingId === `main-${dish.id}`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{labels.sides} disponibles</h2>
        {sides.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/10 px-4 py-6 text-center">
            <p className="text-sm text-muted">
              Marca {labels.dishes.toLowerCase()} como{" "}
              {labels.side.toLowerCase()} en el {labels.catalog.toLowerCase()}.
            </p>
            <Button asChild variant="secondary" size="sm" className="mt-3">
              <Link href="/admin/catalog/new">Ir al {labels.catalog.toLowerCase()}</Link>
            </Button>
          </div>
        ) : filteredSides.length === 0 ? (
          <p className="text-sm text-muted">Sin guarniciones con ese filtro.</p>
        ) : (
          <ul className="space-y-2">
            {filteredSides.map((dish) => (
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
                  onCheckedChange={(on) => void toggleSide(dish.id, on)}
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
