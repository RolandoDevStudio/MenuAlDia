"use client";

import { useRef, useState } from "react";
import { toPng, getFontEmbedCSS } from "html-to-image";
import { Copy, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FLYER_ASPECT_SIZE, type FlyerAspect } from "@/lib/flyer-types";

export type FlyerExportAction = "download" | "share" | "copy";

type Props = {
  slug: string;
  restaurantId: string;
  aspect: FlyerAspect;
  targetId?: string;
  backgroundColor?: string;
  flyerId?: string | null;
  /** Fired after a successful local export (download/share/copy). */
  onAfterLocalExport?: (action: FlyerExportAction, dataUrl: string) => void;
};

export function FlyerExportButton({
  slug,
  restaurantId,
  aspect,
  targetId = "flyer-canvas",
  backgroundColor = "#f7e6c8",
  flyerId,
  onAfterLocalExport,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const lock = useRef(false);

  function notify(text: string, error = false) {
    setMessage(text);
    setIsError(error);
  }

  async function track(action: FlyerExportAction) {
    try {
      await fetch("/api/admin/flyer-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          action,
          flyer_id: flyerId || undefined,
        }),
      });
    } catch {
      /* ignore */
    }
  }

  async function capture(): Promise<string> {
    const node = document.getElementById(targetId);
    if (!node) throw new Error("No se encontró el flyer");
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    const imgs = Array.from(node.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }),
      ),
    );
    const size = FLYER_ASPECT_SIZE[aspect];
    const fontEmbedCSS = await getFontEmbedCSS(node);
    return toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor,
      width: size.w,
      height: size.h,
      fontEmbedCSS,
      skipFonts: false,
    });
  }

  async function dataUrlToFile(dataUrl: string, name: string) {
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], name, { type: "image/png" });
  }

  function filename() {
    const date = new Date().toISOString().slice(0, 10);
    return `especiales-${slug}-${date}.png`;
  }

  async function run(action: FlyerExportAction) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const dataUrl = await capture();
      const name = filename();

      if (action === "download") {
        const a = document.createElement("a");
        a.download = name;
        a.href = dataUrl;
        a.click();
        notify("Flyer descargado");
      } else if (action === "share") {
        const file = await dataUrlToFile(dataUrl, name);
        const canShare =
          typeof navigator !== "undefined" &&
          !!navigator.share &&
          !!navigator.canShare?.({ files: [file] });
        if (!canShare) {
          notify("Compartir no disponible aquí; usa Descargar o Copiar", true);
          return;
        }
        await navigator.share({
          files: [file],
          title: "Especiales de hoy",
        });
        notify("Listo para WhatsApp");
      } else {
        const blob = await (await fetch(dataUrl)).blob();
        if (!navigator.clipboard || !window.ClipboardItem) {
          notify("Copia no soportada; usa Descargar", true);
          return;
        }
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        notify("Copiado — pégalo en WhatsApp Web (Ctrl+V)");
      }

      void track(action);
      onAfterLocalExport?.(action, dataUrl);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        notify("Compartir cancelado");
      } else {
        notify(err instanceof Error ? err.message : "Error al exportar", true);
      }
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11 flex-1"
          onClick={() => void run("download")}
          disabled={busy}
        >
          <Download className="h-4 w-4" />
          {busy ? "…" : "Descargar"}
        </Button>
        <Button
          className="min-h-11 flex-1"
          variant="secondary"
          onClick={() => void run("share")}
          disabled={busy}
        >
          <Share2 className="h-4 w-4" />
          Compartir
        </Button>
        <Button
          className="min-h-11 flex-1"
          variant="secondary"
          onClick={() => void run("copy")}
          disabled={busy}
        >
          <Copy className="h-4 w-4" />
          Copiar
        </Button>
      </div>
      {message ? (
        <p
          className={cn("text-xs", isError ? "text-red-600" : "text-accent")}
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
