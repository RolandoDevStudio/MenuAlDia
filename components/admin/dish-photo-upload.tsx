"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage, type CompressKind } from "@/lib/compress-image";
import { deleteStoragePublicUrl } from "@/lib/storage-cleanup";
import {
  downloadImageGuide,
  IMAGE_GUIDES,
  type ImageGuideId,
} from "@/lib/image-guides";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  restaurantId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  kind?: CompressKind;
  folder?: string;
  /** When false, block adding a first photo (replace existing still allowed). */
  canAddPhoto?: boolean;
  limitMessage?: string | null;
  /** Size hint + downloadable proportion guide */
  guide?: ImageGuideId;
  chooseLabel?: string;
  changeLabel?: string;
};

export function DishPhotoUpload({
  restaurantId,
  value,
  onChange,
  label = "Foto",
  kind = "product",
  folder = "dish-photos",
  canAddPhoto = true,
  limitMessage = null,
  guide,
  chooseLabel = "Elegir foto",
  changeLabel = "Cambiar foto",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasPhoto = Boolean(value?.trim());
  const blockedNew = !hasPhoto && !canAddPhoto;
  const meta = guide ? IMAGE_GUIDES[guide] : null;
  const frameClass = meta?.frameClass ?? "h-36 w-full";
  const objectClass = meta?.objectClass ?? "h-full w-full object-cover";

  async function onFile(file: File | null) {
    if (!file) return;
    if (!hasPhoto && !canAddPhoto) {
      setError(limitMessage || "Alcanzaste el límite de fotos de tu plan.");
      return;
    }
    setUploading(true);
    setError(null);
    const previousUrl = value;
    try {
      const compressed = await compressImage(file, kind);
      const supabase = createClient();
      const path = `${restaurantId}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from(folder)
        .upload(path, compressed, {
          upsert: true,
          contentType: "image/webp",
          cacheControl: "31536000",
        });

      if (uploadError) {
        setError(uploadError.message);
        setUploading(false);
        return;
      }

      const { data } = supabase.storage.from(folder).getPublicUrl(path);
      onChange(data.publicUrl);
      void deleteStoragePublicUrl(supabase, previousUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al comprimir");
    }
    setUploading(false);
  }

  function clearPhoto() {
    const previousUrl = value;
    onChange(null);
    void (async () => {
      const supabase = createClient();
      await deleteStoragePublicUrl(supabase, previousUrl);
    })();
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {meta ? <p className="text-xs text-muted">{meta.hint}</p> : null}
      {value ? (
        <div className={cn("overflow-hidden rounded-xl bg-black/[0.04]", frameClass)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className={objectClass} />
        </div>
      ) : (
        <div
          className={cn(
            "flex items-center justify-center rounded-xl border border-dashed border-black/15 bg-black/[0.02] text-sm text-muted",
            frameClass,
          )}
        >
          Sin foto
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={uploading || blockedNew}
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        variant="secondary"
        className="min-h-11 w-full"
        disabled={uploading || blockedNew}
        onClick={() => inputRef.current?.click()}
      >
        {uploading
          ? "Comprimiendo y subiendo…"
          : hasPhoto
            ? changeLabel
            : chooseLabel}
      </Button>
      {guide ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => downloadImageGuide(guide)}
        >
          Descargar guía {meta ? `${meta.width}×${meta.height}` : ""}
        </Button>
      ) : null}
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearPhoto}
          disabled={uploading}
        >
          Quitar foto
        </Button>
      ) : null}
      {blockedNew && limitMessage ? (
        <p className="text-xs text-amber-800">{limitMessage}</p>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
