"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
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
  /** Optional second action after preview (e.g. studio background). */
  onApplyBackground?: (publicUrl: string) => void;
  applyBackgroundLabel?: string;
  /** Controlled prompt when provided. */
  prompt?: string;
  onPromptChange?: (value: string) => void;
  /** Show reference image picker (default: true for flyer). */
  referenceEnabled?: boolean;
  /** Extra controls next to Generar (e.g. suggest prompt). */
  extraActions?: ReactNode;
};

const STYLES = ["fonda", "pizarra", "minimal", "color marca"] as const;
const REF_MAX_B64 = 400_000;

async function fileToReferencePayload(
  file: File,
): Promise<{ referenceBase64: string; referenceMime: string } | null> {
  const compressed = await compressImage(file, "scan");
  const buf = await compressed.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  let b64 = btoa(binary);
  if (b64.length > REF_MAX_B64) {
    // Re-compress harder via smaller canvas edge
    const blob = new Blob([bytes], { type: compressed.type });
    const imgUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("No se pudo leer la referencia"));
        el.src = imgUrl;
      });
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 640 / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const jpeg = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.55),
      );
      if (!jpeg) return null;
      const ab = await jpeg.arrayBuffer();
      const u8 = new Uint8Array(ab);
      binary = "";
      for (let i = 0; i < u8.length; i += chunk) {
        binary += String.fromCharCode(...u8.subarray(i, i + chunk));
      }
      b64 = btoa(binary);
      if (b64.length > REF_MAX_B64) {
        toast.error("La imagen de referencia es demasiado grande");
        return null;
      }
      return { referenceBase64: b64, referenceMime: "image/jpeg" };
    } finally {
      URL.revokeObjectURL(imgUrl);
    }
  }
  return {
    referenceBase64: b64,
    referenceMime: compressed.type || "image/jpeg",
  };
}

export function AiImageGenerator({
  restaurantId,
  imageKind,
  defaultPreset,
  onApplied,
  applyLabel = "Aplicar al menú público",
  onApplyBackground,
  applyBackgroundLabel = "Usar como fondo del estudio",
  prompt: controlledPrompt,
  onPromptChange,
  referenceEnabled,
  extraActions,
}: Props) {
  const [internalPrompt, setInternalPrompt] = useState("");
  const prompt = controlledPrompt ?? internalPrompt;
  const setPrompt = onPromptChange ?? setInternalPrompt;

  const [style, setStyle] = useState<string>(STYLES[0]);
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState<{ remaining: number; total: number } | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [referenceName, setReferenceName] = useState<string | null>(null);
  const [referencePayload, setReferencePayload] = useState<{
    referenceBase64: string;
    referenceMime: string;
  } | null>(null);

  const allowReference =
    referenceEnabled ?? imageKind === "flyer";

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

  async function onReferenceFile(file: File | null) {
    if (!file) {
      setReferenceName(null);
      setReferencePayload(null);
      return;
    }
    setBusy(true);
    try {
      const payload = await fileToReferencePayload(file);
      if (!payload) return;
      setReferencePayload(payload);
      setReferenceName(file.name);
      toast.success("Referencia lista");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo leer la imagen");
      setReferenceName(null);
      setReferencePayload(null);
    } finally {
      setBusy(false);
    }
  }

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
          ...(referencePayload ?? {}),
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

  async function uploadPreview(): Promise<string | null> {
    if (!previewFile) return null;
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
    return data.publicUrl;
  }

  async function uploadAndApply() {
    if (!previewFile || !onApplied) return;
    setBusy(true);
    try {
      const url = await uploadPreview();
      if (!url) return;
      onApplied(url);
      toast.success("Aplicado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setBusy(false);
    }
  }

  async function uploadAndApplyBackground() {
    if (!previewFile || !onApplyBackground) return;
    setBusy(true);
    try {
      const url = await uploadPreview();
      if (!url) return;
      onApplyBackground(url);
      toast.success("Fondo aplicado al estudio");
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
      {allowReference ? (
        <div className="space-y-1">
          <Label htmlFor={`ai-ref-${imageKind}`}>Imagen de referencia (opcional)</Label>
          <Input
            id={`ai-ref-${imageKind}`}
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              void onReferenceFile(f);
              e.target.value = "";
            }}
          />
          {referenceName ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>Referencia: {referenceName}</span>
              <button
                type="button"
                className="font-semibold text-brand"
                onClick={() => void onReferenceFile(null)}
              >
                Quitar
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => void generate()}>
          Generar
        </Button>
        {extraActions}
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
            {onApplyBackground ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void uploadAndApplyBackground()}
              >
                {applyBackgroundLabel}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
