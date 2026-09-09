"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatMexicoCityDate, ymdInMexicoCity } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type LibraryFlyerRow = {
  id: string;
  title: string;
  subtitle?: string;
  headline?: string;
  weekday_label?: string;
  aspect?: string;
  png_path: string | null;
  created_at: string;
  source?: string;
};

type Props = {
  restaurantId?: string;
  className?: string;
  /** Called when admin picks a flyer as AI reference */
  onUseAsReference?: (flyer: LibraryFlyerRow) => void;
  /** If no callback, link to flyer page with ?ref= */
  referenceHref?: (id: string) => string;
  title?: string;
  compact?: boolean;
};

export function FlyerLibraryPanel({
  restaurantId,
  className,
  onUseAsReference,
  referenceHref = (id) => `/admin/flyer?ref=${encodeURIComponent(id)}`,
  title = "Biblioteca",
  compact = false,
}: Props) {
  const [flyers, setFlyers] = useState<LibraryFlyerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/flyers");
      const json = (await res.json()) as {
        flyers?: LibraryFlyerRow[];
        error?: string;
      };
      if (!res.ok) {
        setMsg(json.error ?? "No se pudo cargar la biblioteca");
        return;
      }
      setFlyers(json.flyers ?? []);
      setMsg(null);
    } catch {
      setMsg("No se pudo cargar la biblioteca");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm("¿Eliminar este flyer de la biblioteca?")) return;
    const res = await fetch(`/api/admin/flyers?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      toast.error(json.error ?? "No se pudo eliminar");
      return;
    }
    setFlyers((list) => list.filter((f) => f.id !== id));
    toast.success("Eliminado");
  }

  async function download(f: LibraryFlyerRow) {
    if (!f.png_path) {
      toast.error("Este flyer no tiene imagen guardada");
      return;
    }
    try {
      const res = await fetch(f.png_path, { mode: "cors" });
      if (!res.ok) throw new Error("No se pudo obtener la imagen");
      const blob = await res.blob();
      const ext = blob.type.includes("webp")
        ? "webp"
        : blob.type.includes("jpeg")
          ? "jpg"
          : "png";
      const date = ymdInMexicoCity(f.created_at) || f.created_at.slice(0, 10);
      const base = (f.headline || f.title || "flyer")
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúñü]+/gi, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${base || "flyer"}-${date}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      void fetch("/api/admin/flyer-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          action: "download",
          flyer_id: f.id,
        }),
      });
    } catch {
      toast.error("No se pudo descargar");
    }
  }

  function useAsRef(f: LibraryFlyerRow) {
    if (!f.png_path) {
      toast.error("Sin imagen");
      return;
    }
    if (onUseAsReference) {
      onUseAsReference(f);
      toast.success("Usar como referencia");
      return;
    }
    window.location.href = referenceHref(f.id);
  }

  return (
    <section
      className={cn(
        "mb-6 space-y-3 rounded-2xl border border-black/10 bg-surface p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">
            {title} ({flyers.length}/20)
          </h2>
          <p className="text-xs text-muted">
            Flyers compuestos o fondos guardados. Úsalos como referencia IA.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          Actualizar
        </Button>
      </div>

      {loading && flyers.length === 0 ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : flyers.length === 0 ? (
        <p className="text-sm text-muted">
          Aún no hay flyers. Genera uno con IA o en el estudio clásico.
        </p>
      ) : (
        <ul
          className={cn(
            "grid gap-3",
            compact
              ? "grid-cols-2 sm:grid-cols-3"
              : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
          )}
        >
          {flyers.map((f) => (
            <li
              key={f.id}
              className="overflow-hidden rounded-xl border border-black/5 bg-white"
            >
              <div className="relative aspect-[4/5] bg-black/5">
                {f.png_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.png_path}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted">
                    Sin img
                  </div>
                )}
              </div>
              <div className="space-y-1.5 p-2">
                <p className="truncate text-sm font-medium">
                  {f.headline || f.title || "Flyer"}
                </p>
                <p className="text-[11px] text-muted">
                  {formatMexicoCityDate(f.created_at)}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 px-2 text-[11px]"
                    disabled={!f.png_path}
                    onClick={() => useAsRef(f)}
                    title="Usar como referencia"
                  >
                    <ImagePlus className="mr-1 h-3.5 w-3.5" />
                    Referencia
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 px-2"
                    disabled={!f.png_path}
                    onClick={() => void download(f)}
                    aria-label="Descargar"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-red-600"
                    onClick={() => void remove(f.id)}
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {msg ? (
        <p className="text-xs text-muted" role="status">
          {msg}
        </p>
      ) : null}
    </section>
  );
}
