"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AiImageGenerator } from "@/components/admin/ai-image-generator";
import { FlyerDishPicker } from "@/components/admin/flyer-dish-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { labelsFor } from "@/lib/business-labels";
import type { Dish } from "@/lib/types";

export type FlyerAiMode = "menu" | "business" | "free";

type CategoryLite = { id: string; name: string; sort_order: number };

type Props = {
  restaurant: {
    id: string;
    slug: string;
    name: string;
    slogan?: string | null;
    business_type?: string | null;
  };
  dishes: Dish[];
  categories: CategoryLite[];
  todayPreselectedIds?: string[];
  onApplyBackground?: (url: string) => void;
};

const MODES: { id: FlyerAiMode; label: string; hint: string }[] = [
  {
    id: "menu",
    label: "Menú",
    hint: "Destaca platillos o productos concretos",
  },
  {
    id: "business",
    label: "Negocio",
    hint: "Identidad y atmósfera de marca",
  },
  {
    id: "free",
    label: "Libre",
    hint: "Prompt abierto para redes",
  },
];

export function FlyerAiPanel({
  restaurant,
  dishes,
  categories,
  todayPreselectedIds,
  onApplyBackground,
}: Props) {
  const giro = labelsFor(restaurant.business_type);
  const initialIds = todayPreselectedIds ?? [];
  const [mode, setMode] = useState<FlyerAiMode>(() =>
    initialIds.length > 0 ? "menu" : "business",
  );
  const [title, setTitle] = useState("Especial de hoy");
  const [prompt, setPrompt] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(() => initialIds);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const prevSelectedCount = useRef(initialIds.length);

  const activeDishes = useMemo(
    () => dishes.filter((d) => selectedIds.includes(d.id)),
    [dishes, selectedIds],
  );

  useEffect(() => {
    const prev = prevSelectedCount.current;
    prevSelectedCount.current = selectedIds.length;
    // Solo al desmarcar el último ítem en modo Menú (no al entrar vacío a elegir).
    if (mode === "menu" && prev > 0 && selectedIds.length === 0) {
      setMode("business");
      toast.message("Sin productos seleccionados", {
        description:
          "Cambié a modo Negocio. Puedes volver a Menú cuando elijas ítems.",
      });
    }
  }, [mode, selectedIds.length]);

  async function saveToGallery(url: string) {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("flyers").insert({
        restaurant_id: restaurant.id,
        title: title.trim() || "Flyer IA",
        subtitle: "",
        headline: title.trim() || "Flyer IA",
        weekday_label: "",
        aspect: "feed_4_5",
        price_mode: "package",
        package_price: null,
        png_path: url,
        source: "ai",
      });
      if (error) throw new Error(error.message);
      setLastUrl(url);
      toast.success("Guardado en galería");
      void fetch("/api/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: restaurant.slug }),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function suggestPrompt() {
    setSuggesting(true);
    try {
      const res = await fetch("/api/admin/ai/suggest-flyer-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          dishNames: activeDishes.map((d) => d.name),
          restaurantName: restaurant.name,
          slogan: restaurant.slogan ?? "",
          businessType: restaurant.business_type ?? "restaurante",
        }),
      });
      const json = (await res.json()) as { prompt?: string; message?: string };
      if (!res.ok) {
        toast.error(json.message || "No se pudo sugerir");
        return;
      }
      if (!json.prompt?.trim()) {
        toast.error("Respuesta vacía");
        return;
      }
      setPrompt(json.prompt.trim());
      toast.success("Prompt sugerido");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al sugerir");
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="mb-6 space-y-3 rounded-2xl border border-black/10 bg-surface p-4">
      <div>
        <h2 className="text-sm font-semibold">Flyer con IA</h2>
        <p className="text-xs text-muted">
          Genera con IA, recorta a 4:5, guarda en galería o úsalo como fondo
          del estudio.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Modo</Label>
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                mode === m.id
                  ? "bg-brand text-white"
                  : "border border-black/10 bg-white"
              }`}
              title={m.hint}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          {MODES.find((m) => m.id === mode)?.hint}
        </p>
      </div>

      {mode === "menu" ? (
        <FlyerDishPicker
          dishes={dishes}
          categories={categories}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          businessType={restaurant.business_type}
          label={`${giro.dishes} a destacar`}
        />
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="flyer-ai-title">Título</Label>
        <Input
          id="flyer-ai-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <AiImageGenerator
        restaurantId={restaurant.id}
        imageKind="flyer"
        defaultPreset="flyer"
        referenceEnabled
        prompt={prompt}
        onPromptChange={setPrompt}
        applyLabel={saving ? "Guardando…" : "Guardar en galería"}
        onApplied={(url) => void saveToGallery(url)}
        onApplyBackground={onApplyBackground}
        applyBackgroundLabel="Usar como fondo del estudio"
        extraActions={
          <Button
            type="button"
            variant="outline"
            disabled={suggesting}
            onClick={() => void suggestPrompt()}
          >
            {suggesting ? "Sugiriendo…" : "Sugerir prompt"}
          </Button>
        }
      />
      {lastUrl ? (
        <Button asChild variant="outline" size="sm">
          <a href="/admin/flyers">Ver galería</a>
        </Button>
      ) : null}
    </div>
  );
}
