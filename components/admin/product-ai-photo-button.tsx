"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { deleteStoragePublicUrl } from "@/lib/storage-cleanup";
import { Button } from "@/components/ui/button";
import { AiCtaButton } from "@/components/admin/ai-cta-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const CLIENT_TIMEOUT_MS = 45_000;

export type ProductAiComboItem = {
  name: string;
  quantity: number;
  photoUrl?: string | null;
};

type QuotaProduct = {
  used: number;
  remaining: number;
  total: number;
  limit: number;
};

type Props = {
  restaurantId: string;
  mode: "item" | "combo";
  /** Product or combo name — required to generate. */
  itemName: string;
  description?: string;
  /** Combo line items (mode=combo). */
  comboItems?: ProductAiComboItem[];
  currentPhotoUrl?: string | null;
  canAddPhoto?: boolean;
  disabled?: boolean;
  onApplied: (publicUrl: string) => void;
};

export function ProductAiPhotoButton({
  restaurantId,
  mode,
  itemName,
  description = "",
  comboItems = [],
  currentPhotoUrl,
  canAddPhoto = true,
  disabled = false,
  onApplied,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [quota, setQuota] = useState<QuotaProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [packHint, setPackHint] = useState<string | null>(null);
  const blobRef = useRef<string | null>(null);

  const revokePreview = useCallback(() => {
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current);
      blobRef.current = null;
    }
    setPreviewUrl(null);
    setPreviewFile(null);
  }, []);

  const loadQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai/generate-image");
      const json = (await res.json()) as {
        product?: QuotaProduct;
        remaining?: number;
        error?: string;
      };
      if (!res.ok) return;
      if (json.product) setQuota(json.product);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadQuota();
    return () => revokePreview();
  }, [loadQuota, revokePreview]);

  const nameOk = itemName.trim().length >= 2;
  const comboOk =
    mode !== "combo" ||
    comboItems.filter((i) => i.quantity > 0 && i.name.trim()).length >= 2;
  const remaining = quota?.remaining ?? 0;
  const canGenerate =
    !disabled &&
    canAddPhoto &&
    nameOk &&
    comboOk &&
    remaining > 0 &&
    !busy &&
    !applying;

  async function generate() {
    if (remaining <= 0) {
      setError("Sin créditos de fotos de menú. Pide un pack SPEI en Uso de IA.");
      return;
    }
    if (!nameOk) {
      toast.error("Escribe el nombre primero.");
      return;
    }
    if (!comboOk) {
      toast.error("Agrega al menos 2 productos al combo.");
      return;
    }

    setBusy(true);
    setError(null);
    setPackHint(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const res = await fetch("/api/admin/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          imageKind: "product",
          productMode: mode,
          productName: itemName.trim(),
          productDescription: description.trim() || undefined,
          productItems:
            mode === "combo"
              ? comboItems
                  .filter((i) => i.quantity > 0 && i.name.trim())
                  .map((i) => ({
                    name: i.name.trim(),
                    quantity: i.quantity,
                    photoUrl: i.photoUrl ?? null,
                  }))
              : undefined,
        }),
      });
      const json = (await res.json()) as {
        imageBase64?: string;
        mimeType?: string;
        remaining?: number;
        total?: number;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        if (json.error === "QUOTA_EXCEEDED") {
          setPackHint(json.message ?? "Sin créditos. Pide un pack SPEI.");
        }
        throw new Error(json.message || "No se pudo generar");
      }
      if (!json.imageBase64) throw new Error("Respuesta vacía");

      const bin = Uint8Array.from(atob(json.imageBase64), (c) =>
        c.charCodeAt(0),
      );
      const blob = new Blob([bin], { type: json.mimeType || "image/png" });
      const file = new File([blob], "ai-product.webp", {
        type: blob.type || "image/png",
      });
      revokePreview();
      const url = URL.createObjectURL(file);
      blobRef.current = url;
      setPreviewUrl(url);
      setPreviewFile(file);
      if (typeof json.remaining === "number" && typeof json.total === "number") {
        setQuota((prev) => ({
          used: Math.max(0, json.total! - json.remaining!),
          remaining: json.remaining!,
          total: json.total!,
          limit: prev?.limit ?? json.total!,
        }));
      } else {
        await loadQuota();
      }
      setOpen(true);
      toast.success("Vista previa lista");
    } catch (e) {
      const msg =
        e instanceof Error && e.name === "AbortError"
          ? "Tardó demasiado. Reintenta sin perder lo que ya escribiste."
          : e instanceof Error
            ? e.message
            : "Error al generar";
      setError(msg);
      toast.error(msg);
      await loadQuota();
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  async function applyPreview() {
    if (!previewFile) return;
    setApplying(true);
    setError(null);
    try {
      const compressed = await compressImage(previewFile, "product");
      const supabase = createClient();
      const path = `${restaurantId}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from("dish-photos")
        .upload(path, compressed, {
          upsert: true,
          contentType: "image/webp",
          cacheControl: "31536000",
        });
      if (uploadError) throw new Error(uploadError.message);
      const { data } = supabase.storage.from("dish-photos").getPublicUrl(path);
      const previous = currentPhotoUrl;
      onApplied(data.publicUrl);
      void deleteStoragePublicUrl(supabase, previous ?? null);
      revokePreview();
      setOpen(false);
      toast.success("Foto aplicada (aún debes guardar el producto)");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo subir";
      setError(msg);
      toast.error(msg);
    } finally {
      setApplying(false);
    }
  }

  function discard() {
    revokePreview();
    setOpen(false);
    setError(null);
  }

  const genLabel = !nameOk
    ? "Escribe el nombre primero"
    : !comboOk
      ? "Agrega productos al combo"
      : remaining <= 0
        ? "Sin créditos IA"
        : busy
          ? "Generando…"
          : "Generar con IA";

  return (
    <div className="space-y-2">
      <AiCtaButton
        type="button"
        className="min-h-11 w-full"
        disabled={!canGenerate}
        onClick={() => void generate()}
      >
        {genLabel}
      </AiCtaButton>
      {quota ? (
        <p className="text-[11px] text-muted">
          Fotos IA menú: {quota.used}/{quota.limit}
          {quota.total > quota.limit
            ? ` (+${quota.total - quota.limit} pack)`
            : ""}{" "}
          · quedan {quota.remaining}
        </p>
      ) : null}
      <p className="text-[11px] text-muted">
        Imagen ilustrativa generada con IA. Puedes reemplazarla con una foto
        real.
      </p>
      {packHint ? (
        <p className="text-xs text-amber-800">{packHint}</p>
      ) : null}
      {error && !open ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : null}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) discard();
          else setOpen(true);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vista previa</DialogTitle>
            <DialogDescription>
              Revisa la foto antes de usarla. Descartar no sube nada a Storage.
            </DialogDescription>
          </DialogHeader>
          {previewUrl ? (
            <div className="overflow-hidden rounded-xl bg-black/[0.04]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt=""
                className="mx-auto max-h-72 w-full object-contain"
              />
            </div>
          ) : null}
          <p className="text-xs text-muted">
            Foto ilustrativa generada con IA.
          </p>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className="min-h-11 w-full"
              disabled={applying || busy || !previewFile}
              onClick={() => void applyPreview()}
            >
              {applying ? "Subiendo…" : "Usar esta foto"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={cn("min-h-11 w-full")}
              disabled={busy || applying || remaining <= 0}
              onClick={() => void generate()}
            >
              {busy
                ? "Generando…"
                : `Probar otra opción (Consume 1 crédito · Te quedan ${remaining})`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full"
              disabled={busy || applying}
              onClick={discard}
            >
              Descartar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
