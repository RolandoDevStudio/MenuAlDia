"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AiImageGenerator } from "@/components/admin/ai-image-generator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  restaurantId: string;
  restaurantSlug: string;
};

export function FlyerAiPanel({ restaurantId, restaurantSlug }: Props) {
  const [title, setTitle] = useState("Especial de hoy");
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveToGallery(url: string) {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("flyers").insert({
        restaurant_id: restaurantId,
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
        body: JSON.stringify({ slug: restaurantSlug }),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-6 space-y-3 rounded-2xl border border-black/10 bg-surface p-4">
      <div>
        <h2 className="text-sm font-semibold">Flyer con IA</h2>
        <p className="text-xs text-muted">
          Genera con Imagen 3, recorta a 4:5 y guarda en galería.
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="flyer-ai-title">Título</Label>
        <Input
          id="flyer-ai-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <AiImageGenerator
        restaurantId={restaurantId}
        imageKind="flyer"
        defaultPreset="flyer"
        applyLabel={saving ? "Guardando…" : "Guardar en galería"}
        onApplied={(url) => void saveToGallery(url)}
      />
      {lastUrl ? (
        <Button asChild variant="outline" size="sm">
          <a href="/admin/flyers">Ver galería</a>
        </Button>
      ) : null}
    </div>
  );
}
