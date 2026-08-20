"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  targetId?: string;
};

export function FlyerExportButton({ slug, targetId = "flyer-canvas" }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const lock = useRef(false);

  function notify(text: string, error = false) {
    setMessage(text);
    setIsError(error);
  }

  async function capture() {
    const node = document.getElementById(targetId);
    if (!node) throw new Error("No se encontró el flyer");
    await document.fonts.ready;
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
    return toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#f7e6c8",
    });
  }

  async function dataUrlToFile(dataUrl: string, filename: string) {
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], filename, { type: "image/png" });
  }

  async function download() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const dataUrl = await capture();
      const date = new Date().toISOString().slice(0, 10);
      const filename = `menu-del-dia-${slug}-${date}.png`;
      const file = await dataUrlToFile(dataUrl, filename);

      const canShare =
        typeof navigator !== "undefined" &&
        !!navigator.share &&
        !!navigator.canShare?.({ files: [file] });

      if (canShare) {
        await navigator.share({
          files: [file],
          title: "Especiales de hoy",
        });
        notify("Flyer listo para compartir");
      } else {
        const a = document.createElement("a");
        a.download = filename;
        a.href = dataUrl;
        a.click();
        notify("Flyer descargado");
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : "Error al exportar", true);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  async function copy() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const dataUrl = await capture();
      const blob = await (await fetch(dataUrl)).blob();
      if (!navigator.clipboard || !window.ClipboardItem) {
        notify("Copia no soportada; usa Descargar", true);
        return;
      }
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      notify("Flyer copiado al portapapeles");
    } catch {
      notify("No se pudo copiar (prueba Descargar en iOS)", true);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button className="flex-1" onClick={download} disabled={busy}>
          <Download className="h-4 w-4" />
          {busy ? "Generando…" : "Descargar / Compartir"}
        </Button>
        <Button
          className="flex-1"
          variant="secondary"
          onClick={copy}
          disabled={busy}
        >
          <Copy className="h-4 w-4" />
          Copiar
        </Button>
      </div>
      {message ? (
        <p
          className={cn(
            "text-xs",
            isError ? "text-red-600" : "text-accent",
          )}
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
