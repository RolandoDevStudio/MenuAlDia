"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cropImageToAspect, compressImage } from "@/lib/compress-image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { AiImagePreset } from "@/lib/ai-schemas";
import { IMAGE_KIND_ASPECTS } from "@/lib/ai-schemas";

type ImageKind = "flyer" | "banner" | "background";

type Props = {
  restaurantId: string;
  imageKind: ImageKind;
  defaultPreset?: AiImagePreset;
  onApplied?: (publicUrl: string) => void;
  applyLabel?: string;
};

const STYLES = ["fonda", "pizarra", "minimal", "color marca"] as const;

export function AiImageGenerator({
  restaurantId,
  imageKind,
  defaultPreset,
  onApplied,
  applyLabel = "Aplicar al menú público",
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<string>(STYLES[0]);
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState<{ remaining: number; total: number } | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  const preset: AiImagePreset =
    defaultPreset ??
    (imageKind === "banner"
      ? "banner"
      : imageKind === "background"
        ? "background"
        : "flyer");
  const aspect = IMAGE_KIND_ASPECTS[preset];

  const loadQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai/generate-image");
      const json = (await res.json()) as {
        remaining?: number;
        total?: number;
      };
      if (res.ok) {
        setQuota({
          remaining: json.remaining ?? 0,
          total: json.total ?? 0,
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadQuota();
  }, [loadQuota]);

  async function generate() {
    if (prompt.trim().length < 8) {
      toast.error("Describe un poco más lo que quieres generar");
      return;
    }
    const remaining = quota?.remaining ?? 0;
    const total = quota?.total ?? 0;
    const ok = window.confirm(
      `Se descontará 1 imagen del cupo. Te quedan ${remaining} de ${total} este mes. ¿Continuar?`,
    );
    if (!ok) return;
    if (remaining <= 0) {
      toast.error("Sin cupo de imágenes IA. Solicita un pack en Ajustes.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageKind,
          preset,
          prompt: prompt.trim(),
          style,
        }),
      });
      const json = (await res.json()) as {
        imageBase64?: string;
        mimeType?: string;
        remaining?: number;
        total?: number;
        message?: string;
        targetAspect?: { w: number; h: number };
      };
      if (!res.ok) {
        toast.error(json.message || "No se pudo generar");
        await loadQuota();
        return;
      }
      if (!json.imageBase64) {
        toast.error("Respuesta vacía");
        return;
      }
      const bin = Uint8Array.from(atob(json.imageBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bin], { type: json.mimeType || "image/png" });
      const target = json.targetAspect ?? aspect.target;
      const cropped = await cropImageToAspect(blob, target.w, target.h);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(cropped);
      setPreviewUrl(url);
      setPreviewFile(cropped);
      if (typeof json.remaining === "number" && typeof json.total === "number") {
        setQuota({ remaining: json.remaining, total: json.total });
      } else {
        await loadQuota();
      }
      toast.success("Imagen lista. Descarga o aplícala.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al generar");
      await loadQuota();
    } finally {
      setBusy(false);
    }
  }

  async function uploadAndApply() {
    if (!previewFile) return;
    setBusy(true);
    try {
      const compressed = await compressImage(previewFile, "banner");
      const supabase = createClient();
      const path = `${restaurantId}/ai/${imageKind}/${crypto.randomUUID()}.webp`;
      const { error } = await supabase.storage
        .from("restaurant-assets")
        .upload(path, compressed, {
          upsert: true,
          contentType: "image/webp",
          cacheControl: "31536000",
        });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage
        .from("restaurant-assets")
        .getPublicUrl(path);
      onApplied?.(data.publicUrl);
      toast.success("Aplicado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `menualdia-${imageKind}.webp`;
    a.click();
  }

  async function requestPack() {
    const res = await fetch("/api/admin/ai/pack-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = (await res.json()) as { message?: string };
    if (!res.ok) {
      toast.error(json.message || "No se pudo solicitar");
      return;
    }
    toast.success("Solicitud enviada. El superadmin confirmará el pago.");
  }

  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-brand/30 bg-brand/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
          Generar con IA · {aspect.label}
        </p>
        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-brand-dark">
          Imágenes IA: {quota?.remaining ?? "—"} / {quota?.total ?? "—"}
        </span>
      </div>
      <div className="space-y-1">
        <Label>Prompt</Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Ej. Banner cálido con tacos al pastor y ambiente de fonda"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {STYLES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStyle(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              style === s
                ? "bg-brand text-white"
                : "border border-black/10 bg-white"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => void generate()}>
          Generar
        </Button>
        {(quota?.remaining ?? 0) <= 0 ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void requestPack()}
          >
            Pedir pack extra
          </Button>
        ) : null}
      </div>
      {previewUrl ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Vista previa IA"
            className="max-h-56 w-full rounded-xl object-contain bg-black/5"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={download}>
              Descargar
            </Button>
            {onApplied ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => void uploadAndApply()}
              >
                {applyLabel}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <Input className="hidden" />
    </div>
  );
}
