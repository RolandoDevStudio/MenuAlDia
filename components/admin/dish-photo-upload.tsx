"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage, type CompressKind } from "@/lib/compress-image";
import { deleteStoragePublicUrl } from "@/lib/storage-cleanup";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = {
  restaurantId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  kind?: CompressKind;
  folder?: string;
};

export function DishPhotoUpload({
  restaurantId,
  value,
  onChange,
  label = "Foto",
  kind = "product",
  folder = "dish-photos",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
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
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="h-36 w-full rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-black/15 bg-black/[0.02] text-sm text-muted">
          Sin foto
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={uploading}
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        variant="secondary"
        className="min-h-11 w-full"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? "Comprimiendo y subiendo…" : "Elegir foto"}
      </Button>
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
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
