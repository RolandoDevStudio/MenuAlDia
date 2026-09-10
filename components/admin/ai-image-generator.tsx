"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cropImageToAspect, compressImage } from "@/lib/compress-image";
import { Button } from "@/components/ui/button";
import { AiCtaButton } from "@/components/admin/ai-cta-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { AiImagePreset } from "@/lib/ai-schemas";
import { IMAGE_KIND_ASPECTS } from "@/lib/ai-schemas";
import type {
  FlyerAiAspectRatio,
  FlyerLayoutPreset,
  FlyerMarketingOpts,
  ProductImageSource,
} from "@/lib/flyer-ai-prompt";
import { aspectRatioToImagePreset } from "@/lib/flyer-ai-prompt";

type ImageKind = "flyer" | "banner" | "background";

export type FlyerCompositionItem = {
  name: string;
  price?: number | null;
  category?: string | null;
  photoUrl?: string | null;
  isSide?: boolean;
};

export type FlyerCompositionPayload = {
  mode: "menu" | "business" | "free";
  dishNames?: string[];
  items?: FlyerCompositionItem[];
  title?: string;
  restaurantName?: string;
  slogan?: string;
  businessType?: string | null;
  marketing?: Partial<FlyerMarketingOpts>;
  layoutPreset?: FlyerLayoutPreset;
  productImageSource?: ProductImageSource;
  similarity?: number;
  aspectRatio?: FlyerAiAspectRatio;
  finishedAsset?: boolean;
  followReferenceLayout?: boolean;
};

type ReferencePayload = {
  referenceBase64: string;
  referenceMime: string;
};

type Props = {
  restaurantId: string;
  imageKind: ImageKind;
  defaultPreset?: AiImagePreset;
  onApplied?: (publicUrl: string) => void;
  applyLabel?: string;
  onApplyBackground?: (publicUrl: string) => void;
  applyBackgroundLabel?: string;
  advancedStudioCollapsed?: boolean;
  downloadLabel?: string;
  prompt?: string;
  onPromptChange?: (value: string) => void;
  referenceEnabled?: boolean;
  extraActions?: ReactNode;
  composition?: FlyerCompositionPayload | null;
  externalReference?: ReferencePayload | null;
  slim?: boolean;
  onQuotaChange?: (quota: { remaining: number; total: number }) => void;
  onBusyChange?: (busy: boolean) => void;
};

const STYLES = ["fonda", "pizarra", "minimal", "color marca"] as const;
const REF_MAX_B64 = 400_000;

const MARKETING_TIPS = [
  "Tip: en feed, 3–5 platillos se leen mejor que una lista larga.",
  "Tip: una foto nítida del protagonista vale más que muchas medianas.",
  "Tip: publica al mediodía o al atardecer, cuando más piden comida.",
  "Tip: precios claros y un solo CTA (WhatsApp) convierten mejor.",
  "Tip: menos texto = más claridad; la IA también deforma menos.",
];

export async function fileToReferencePayload(
  file: File,
): Promise<ReferencePayload | null> {
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

export async function urlToReferencePayload(
  url: string,
): Promise<ReferencePayload | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("No se pudo cargar la referencia");
    const blob = await res.blob();
    const file = new File([blob], "reference.jpg", {
      type: blob.type || "image/jpeg",
    });
    return fileToReferencePayload(file);
  } catch {
    toast.error("No se pudo usar esa imagen como referencia");
    return null;
  }
}

export function probeImageAspectFromUrl(
  url: string,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function probeImageAspectFromBase64(
  base64: string,
  mimeType: string,
): Promise<{ width: number; height: number } | null> {
  return probeImageAspectFromUrl(
    `data:${mimeType || "image/jpeg"};base64,${base64}`,
  );
}

export function AiImageGenerator({
  restaurantId,
  imageKind,
  defaultPreset,
  onApplied,
  applyLabel = "Aplicar al menú público",
  onApplyBackground,
  applyBackgroundLabel = "Usar como fondo del estudio",
  advancedStudioCollapsed = false,
  downloadLabel = "Descargar",
  prompt: controlledPrompt,
  onPromptChange,
  referenceEnabled,
  extraActions,
  composition,
  externalReference,
  slim = false,
  onQuotaChange,
  onBusyChange,
}: Props) {
  const [showStudioAdvanced, setShowStudioAdvanced] = useState(
    !advancedStudioCollapsed,
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [internalPrompt, setInternalPrompt] = useState("");
  const prompt = controlledPrompt ?? internalPrompt;
  const setPrompt = onPromptChange ?? setInternalPrompt;

  const [style, setStyle] = useState<string>(STYLES[0]);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [quota, setQuota] = useState<{ remaining: number; total: number } | null>(
    null,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [referenceName, setReferenceName] = useState<string | null>(null);
  const [referencePayload, setReferencePayload] =
    useState<ReferencePayload | null>(null);

  const allowReference =
    !slim && (referenceEnabled ?? imageKind === "flyer");
  const compositionMode = Boolean(composition) || slim;

  const preset: AiImagePreset = composition?.aspectRatio
    ? aspectRatioToImagePreset(composition.aspectRatio)
    : (defaultPreset ??
      (imageKind === "banner"
        ? "banner"
        : imageKind === "background"
          ? "background"
          : "flyer"));
  const aspect = IMAGE_KIND_ASPECTS[preset];

  const setBusyAll = useCallback(
    (next: boolean) => {
      setBusy(next);
      onBusyChange?.(next);
    },
    [onBusyChange],
  );

  const loadQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai/generate-image");
      const json = (await res.json()) as {
        remaining?: number;
        total?: number;
      };
      if (res.ok) {
        const next = {
          remaining: json.remaining ?? 0,
          total: json.total ?? 0,
        };
        setQuota(next);
        onQuotaChange?.(next);
      }
    } catch {
      /* ignore */
    }
  }, [onQuotaChange]);

  useEffect(() => {
    void loadQuota();
  }, [loadQuota]);

  useEffect(() => {
    if (!generating) return;
    const id = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % MARKETING_TIPS.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [generating]);

  useEffect(() => {
    if (!generating) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [generating]);

  async function onReferenceFile(file: File | null) {
    if (!file) {
      setReferenceName(null);
      setReferencePayload(null);
      return;
    }
    setBusyAll(true);
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
      setBusyAll(false);
    }
  }

  async function generate() {
    if (!compositionMode && prompt.trim().length < 8) {
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

    setBusyAll(true);
    setGenerating(true);
    setTipIndex(0);
    try {
      const ref = externalReference ?? referencePayload;
      const res = await fetch("/api/admin/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageKind,
          preset,
          prompt: prompt.trim(),
          ...(compositionMode ? {} : { style }),
          ...(ref ?? {}),
          ...(composition
            ? {
                mode: composition.mode,
                dishNames: composition.dishNames,
                items: composition.items,
                title: composition.title,
                restaurantName: composition.restaurantName,
                slogan: composition.slogan,
                businessType: composition.businessType,
                marketing: composition.marketing,
                layoutPreset: composition.layoutPreset,
                productImageSource: composition.productImageSource,
                similarity: composition.similarity,
                aspectRatio: composition.aspectRatio,
                finishedAsset: composition.finishedAsset !== false,
                followReferenceLayout: Boolean(
                  composition.followReferenceLayout,
                ),
              }
            : {}),
        }),
      });
      const json = (await res.json()) as {
        imageBase64?: string;
        mimeType?: string;
        remaining?: number;
        total?: number;
        message?: string;
        targetAspect?: { w: number; h: number };
        finishedAsset?: boolean;
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
      const bin = Uint8Array.from(atob(json.imageBase64), (c) =>
        c.charCodeAt(0),
      );
      const blob = new Blob([bin], { type: json.mimeType || "image/png" });
      const target = json.targetAspect ?? aspect.target;
      const cropped = await cropImageToAspect(blob, target.w, target.h);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(cropped);
      setPreviewUrl(url);
      setPreviewFile(cropped);
      if (typeof json.remaining === "number" && typeof json.total === "number") {
        const next = { remaining: json.remaining, total: json.total };
        setQuota(next);
        onQuotaChange?.(next);
      } else {
        await loadQuota();
      }
      toast.success(
        composition?.finishedAsset !== false && compositionMode
          ? "Flyer listo para publicar. Guárdalo o descárgalo."
          : "Imagen lista. Descarga o aplícala.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al generar");
      await loadQuota();
    } finally {
      setGenerating(false);
      setBusyAll(false);
    }
  }

  async function uploadPreview(): Promise<string | null> {
    if (!previewFile) return null;
    const compressed = await compressImage(
      previewFile,
      imageKind === "flyer" ? "og" : "banner",
    );
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
    setBusyAll(true);
    try {
      const url = await uploadPreview();
      if (!url) return;
      onApplied(url);
      toast.success("Aplicado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setBusyAll(false);
    }
  }

  async function uploadAndApplyBackground() {
    if (!previewFile || !onApplyBackground) return;
    setBusyAll(true);
    try {
      const url = await uploadPreview();
      if (!url) return;
      onApplyBackground(url);
      toast.success("Fondo aplicado al estudio");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setBusyAll(false);
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
    <div className="relative space-y-3 rounded-2xl border border-dashed border-brand/30 bg-brand/5 p-3">
      {generating ? (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/90 px-4 text-center backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand/20 border-t-brand" />
          <p className="text-sm font-semibold text-brand-dark">
            Generando tu flyer…
          </p>
          <p className="max-w-xs text-xs text-muted transition-opacity duration-500">
            {MARKETING_TIPS[tipIndex]}
          </p>
          <p className="text-[11px] text-muted">
            No cierres ni cambies de pestaña; suele tardar varios segundos.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
          Generar con IA · {aspect.label}
        </p>
        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-brand-dark">
          Imágenes IA: {quota?.remaining ?? "—"} / {quota?.total ?? "—"}
        </span>
      </div>

      {!compositionMode ? (
        <div className="space-y-1">
          <Label>Prompt</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Ej. Banner cálido con tacos al pastor y ambiente de fonda"
            disabled={busy}
          />
        </div>
      ) : null}

      {!compositionMode ? (
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStyle(s)}
              disabled={busy}
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
      ) : null}

      {allowReference ? (
        <div className="space-y-1">
          <Label htmlFor={`ai-ref-${imageKind}`}>
            Imagen de referencia (opcional)
          </Label>
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
        <AiCtaButton
          disabled={busy}
          hideIcon={generating}
          onClick={() => void generate()}
        >
          {generating ? "Generando…" : "Generar con IA"}
        </AiCtaButton>
        {!compositionMode ? extraActions : null}
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

      {compositionMode ? (
        <div className="space-y-2 rounded-xl border border-black/5 bg-white/50 p-2">
          <button
            type="button"
            className="text-xs font-semibold text-muted hover:text-brand"
            onClick={() => setShowAdvanced((v) => !v)}
            disabled={busy}
          >
            {showAdvanced
              ? "Ocultar avanzado"
              : "Avanzado · dirección creativa"}
          </button>
          {showAdvanced ? (
            <div className="space-y-2">
              <Label>Dirección creativa (opcional)</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
                placeholder="Ej. más festivo, menos texto, colores tierra…"
                disabled={busy}
              />
              <p className="text-[11px] text-muted">
                No hace falta listar platillos ni precios: eso ya va del
                checklist. Déjalo vacío si la referencia y los datos bastan.
              </p>
              {extraActions ? (
                <div className="flex flex-wrap gap-2">{extraActions}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {previewUrl ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Vista previa IA"
            className="max-h-72 w-full rounded-xl object-contain bg-black/5"
          />
          <div className="flex flex-wrap gap-2">
            {onApplied ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => void uploadAndApply()}
              >
                {applyLabel}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={download}>
              {downloadLabel}
            </Button>
          </div>
          {onApplyBackground ? (
            advancedStudioCollapsed ? (
              <div className="space-y-2 rounded-xl border border-black/5 bg-white/50 p-2">
                <button
                  type="button"
                  className="text-xs font-semibold text-brand"
                  onClick={() => setShowStudioAdvanced((v) => !v)}
                >
                  {showStudioAdvanced
                    ? "Ocultar avanzado"
                    : "Avanzado · fondo + estudio"}
                </button>
                {showStudioAdvanced ? (
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
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void uploadAndApplyBackground()}
              >
                {applyBackgroundLabel}
              </Button>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
