"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Copy, Download, ExternalLink, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { getAppOrigin } from "@/lib/site-url";
import { buildWaMeUrl } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type FlyerRow = {
  id: string;
  title: string;
  png_path: string | null;
  source: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  items_json?: unknown[];
};

export function FlyersGallery({
  restaurantId,
  restaurantSlug,
  restaurantName,
  phoneWhatsapp,
}: {
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
  phoneWhatsapp: string;
}) {
  const [flyers, setFlyers] = useState<FlyerRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/flyers");
    const json = (await res.json()) as { flyers?: FlyerRow[]; error?: string };
    if (!res.ok) {
      setError(json.error ?? "Error al cargar");
      return;
    }
    setFlyers(json.flyers ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function smartUrl(id: string) {
    return `${getAppOrigin()}/${restaurantSlug}/p/${id}`;
  }

  async function uploadFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const compressed = await compressImage(file, "flyer");
      const path = `${restaurantId}/flyers/${crypto.randomUUID()}.webp`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("dish-photos")
        .upload(path, compressed, { contentType: "image/webp", upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = supabase.storage.from("dish-photos").getPublicUrl(path);
      const res = await fetch("/api/admin/flyers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: uploadTitle.trim() || file.name.replace(/\.[^.]+$/, ""),
          png_path: pub.publicUrl,
          source: "upload",
          is_active: true,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "No se pudo guardar");
      setUploadTitle("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch("/api/admin/flyers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setError(json.error ?? "Error");
      return;
    }
    await load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este flyer?")) return;
    await fetch(`/api/admin/flyers?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await load();
  }

  function shareWa(f: FlyerRow) {
    const url = smartUrl(f.id);
    const title = f.title || "Promoción";
    const text = `🔥 ${title}\n${restaurantName}\n\nMira la promo: ${url}`;
    window.open(buildWaMeUrl(phoneWhatsapp || "521", text), "_blank");
    void fetch("/api/admin/flyer-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "share" }),
    });
  }

  async function copyUrl(f: FlyerRow) {
    await navigator.clipboard.writeText(smartUrl(f.id));
    void fetch("/api/admin/flyer-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "copy" }),
    });
  }

  async function download(f: FlyerRow) {
    if (!f.png_path) return;
    const res = await fetch(f.png_path);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${f.title || "flyer"}.webp`;
    a.click();
    URL.revokeObjectURL(a.href);
    void fetch("/api/admin/flyer-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "download" }),
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Galería de flyers</h1>
          <p className="text-sm text-muted">
            Generados en el studio o subidos (Canva, fotos). Comparte el enlace
            inteligente para vista previa en WhatsApp.
          </p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/admin/flyer">Abrir studio</Link>
        </Button>
      </div>

      <section className="space-y-3 rounded-xl border border-black/5 bg-surface p-4">
        <h2 className="text-sm font-semibold">Subir imagen externa</h2>
        <p className="text-xs text-muted">
          Se comprime a WebP (~1080px) antes de guardar en Storage.
        </p>
        <div className="space-y-1.5">
          <Label>Título (opcional)</Label>
          <Input
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            placeholder="Promo fin de semana"
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          {busy ? "Subiendo…" : "Elegir imagen"}
        </Button>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <ul className="space-y-3">
        {flyers.map((f) => (
          <li
            key={f.id}
            className="rounded-xl border border-black/5 bg-surface p-3"
          >
            <div className="flex gap-3">
              {f.png_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.png_path}
                  alt=""
                  className="h-24 w-20 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-24 w-20 items-center justify-center rounded-lg bg-black/5 text-xs text-muted">
                  Sin img
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <Input
                  value={f.title}
                  onChange={(e) => {
                    setFlyers((prev) =>
                      prev.map((x) =>
                        x.id === f.id ? { ...x, title: e.target.value } : x,
                      ),
                    );
                  }}
                  onBlur={() => void patch(f.id, { title: f.title })}
                  placeholder="Título"
                />
                <p className="text-[11px] text-muted">
                  {f.source === "upload" ? "Subido" : "Studio"} ·{" "}
                  {new Date(f.created_at).toLocaleDateString("es-MX")}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Switch
                      checked={f.is_active}
                      onCheckedChange={(on) =>
                        void patch(f.id, { is_active: on })
                      }
                    />
                    Activo
                  </div>
                  <Input
                    type="date"
                    className="h-9 w-auto text-xs"
                    value={f.expires_at ? f.expires_at.slice(0, 10) : ""}
                    onChange={(e) =>
                      void patch(f.id, {
                        expires_at: e.target.value
                          ? `${e.target.value}T23:59:59.999-06:00`
                          : null,
                      })
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => shareWa(f)}
                  >
                    WhatsApp
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void copyUrl(f)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!f.png_path}
                    onClick={() => void download(f)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <a href={smartUrl(f.id)} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-red-700"
                    onClick={() => void remove(f.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {flyers.length === 0 ? (
        <p className="text-center text-sm text-muted">
          Aún no hay flyers. Genera uno en el studio o sube una imagen.
        </p>
      ) : null}
    </div>
  );
}
