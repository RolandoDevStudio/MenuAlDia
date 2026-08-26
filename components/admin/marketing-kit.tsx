"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { toPng, getFontEmbedCSS } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";
import { cn } from "@/lib/utils";
import { scanCtaFor, STICKER_CTA } from "@/lib/business-labels";
import type { BusinessType } from "@/lib/types";
import type { MarketingQrApi } from "@/components/admin/marketing-qr-canvas";
import {
  ACRYLIC_SIZE,
  MarketingPrintPreview,
  STICKER_SIZE,
  type PrintTemplateKind,
} from "@/components/admin/marketing-print-templates";

const MarketingQrCanvas = dynamic(
  () =>
    import("@/components/admin/marketing-qr-canvas").then(
      (m) => m.MarketingQrCanvas,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto h-[280px] w-[280px] animate-pulse rounded-xl bg-black/5" />
    ),
  },
);

const ACRYLIC_MAX = 48;
const STICKER_MAX = 32;

type Tab = "qr" | "print";

function canSharePngFile(): boolean {
  if (typeof navigator === "undefined" || !navigator.share || !navigator.canShare) {
    return false;
  }
  try {
    const file = new File([new Uint8Array([137, 80, 78, 71])], "t.png", {
      type: "image/png",
    });
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function blobToFile(blob: Blob, name: string) {
  return new File([blob], name, { type: blob.type || "image/png" });
}

export function MarketingKit({
  slug,
  businessName,
  menuUrl,
  logoUrl,
  primaryColor,
  businessType,
}: {
  slug: string;
  businessName: string;
  menuUrl: string;
  logoUrl: string | null;
  primaryColor: string;
  businessType: BusinessType | string | null;
}) {
  const [tab, setTab] = useState<Tab>("qr");
  const [dotColor, setDotColor] = useState(primaryColor || "#1c1410");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [showLogo, setShowLogo] = useState(Boolean(logoUrl));
  const [qrPngUrl, setQrPngUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const shareOk = useSyncExternalStore(
    () => () => {},
    canSharePngFile,
    () => false,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const scanDefault = scanCtaFor(businessType);
  const [kind, setKind] = useState<PrintTemplateKind>("acrylic");
  const [acrylicCta, setAcrylicCta] = useState(scanDefault);
  const [stickerCta, setStickerCta] = useState(STICKER_CTA);

  const qrApi = useRef<MarketingQrApi | null>(null);
  const lock = useRef(false);

  const fileBase = `qr-${slug}`;
  const cta = kind === "acrylic" ? acrylicCta : stickerCta;
  const ctaMax = kind === "acrylic" ? ACRYLIC_MAX : STICKER_MAX;

  function notify(text: string, error = false) {
    setMessage(text);
    setIsError(error);
  }

  async function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await fn();
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

  async function shareBlob(blob: Blob, name: string, title: string) {
    const file = await blobToFile(blob, name);
    const ok =
      typeof navigator !== "undefined" &&
      !!navigator.share &&
      !!navigator.canShare?.({ files: [file] });
    if (!ok) {
      throw new Error("Compartir no disponible aquí; usa Descargar");
    }
    await navigator.share({ files: [file], title });
    notify("Listo para WhatsApp");
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(menuUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      notify("No se pudo copiar el enlace", true);
    }
  }

  async function capturePrint(): Promise<string> {
    const node = document.getElementById("kit-print-node");
    if (!node) throw new Error("No se encontró la plantilla");
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
    const size = kind === "acrylic" ? ACRYLIC_SIZE : STICKER_SIZE;
    const fontEmbedCSS = await getFontEmbedCSS(node);
    return toPng(node, {
      cacheBust: true,
      pixelRatio: 3,
      backgroundColor: kind === "acrylic" ? "#faf6f1" : primaryColor,
      width: size.w,
      height: size.h,
      fontEmbedCSS,
      skipFonts: false,
    });
  }

  async function dataUrlToBlob(dataUrl: string) {
    return (await fetch(dataUrl)).blob();
  }

  const printName =
    kind === "acrylic" ? `acrilico-${slug}.png` : `sticker-${slug}.png`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">
          <Emoji char={UI_EMOJI.kit} />
          Kit
        </h1>
        <p className="text-sm text-muted">
          Código QR y material para imprimir o compartir. Todo se genera en tu
          teléfono, sin subir nada.
        </p>
      </div>

      <div className="flex gap-1 rounded-xl bg-black/[0.04] p-1">
        <button
          type="button"
          className={cn(
            "min-h-11 flex-1 rounded-lg px-3 text-sm font-medium",
            tab === "qr" ? "bg-surface text-foreground shadow-sm" : "text-muted",
          )}
          onClick={() => setTab("qr")}
        >
          Código QR
        </button>
        <button
          type="button"
          className={cn(
            "min-h-11 flex-1 rounded-lg px-3 text-sm font-medium",
            tab === "print"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted",
          )}
          onClick={() => setTab("print")}
        >
          Material gráfico
        </button>
      </div>

      <div
        hidden={tab !== "qr"}
        className="grid gap-6 lg:grid-cols-2 lg:items-start"
      >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qr-dot">Color de puntos</Label>
                <Input
                  id="qr-dot"
                  type="color"
                  className="h-11 cursor-pointer px-1"
                  value={dotColor}
                  onChange={(e) => setDotColor(e.target.value)}
                />
                <p className="text-[11px] text-muted">
                  Consejo: usa un color oscuro para que las cámaras lean el código
                  rápido.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qr-bg">Color de fondo</Label>
                <Input
                  id="qr-bg"
                  type="color"
                  className="h-11 cursor-pointer px-1"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-surface px-3 py-2">
              <div>
                <p className="text-sm font-medium">Mostrar logo</p>
                <p className="text-[11px] text-muted">
                  {logoUrl
                    ? "Al centro, máximo 25% del código"
                    : "Sube un logo en Ajustes para usarlo aquí"}
                </p>
              </div>
              <Switch
                checked={showLogo && Boolean(logoUrl)}
                disabled={!logoUrl}
                onCheckedChange={setShowLogo}
                aria-label="Mostrar logo en el QR"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="min-h-11 flex-1"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const api = qrApi.current;
                    if (!api) throw new Error("El QR aún no está listo");
                    await api.download("png");
                    notify("QR descargado");
                  })
                }
              >
                <Emoji char={UI_EMOJI.download} />
                {busy ? "…" : "PNG"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 flex-1"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const api = qrApi.current;
                    if (!api) throw new Error("El QR aún no está listo");
                    await api.download("svg");
                    notify("SVG descargado");
                  })
                }
              >
                <Emoji char={UI_EMOJI.download} />
                SVG
              </Button>
              {shareOk ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 flex-1"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const api = qrApi.current;
                      if (!api) throw new Error("El QR aún no está listo");
                      const blob = await api.getPngBlob();
                      await shareBlob(blob, `${fileBase}.png`, `Código QR — ${businessName}`);
                    })
                  }
                >
                  <Emoji char={UI_EMOJI.share} />
                  Compartir
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
            <MarketingQrCanvas
              url={menuUrl}
              fileBase={fileBase}
              dotColor={dotColor}
              bgColor={bgColor}
              logoUrl={logoUrl}
              showLogo={showLogo}
              onPngUrl={setQrPngUrl}
              onApi={(api) => {
                qrApi.current = api;
              }}
              onLogoBlocked={() => {
                setShowLogo(false);
                toast.error("No se pudo cargar el logo. El QR sigue sin logo.");
              }}
            />
            <div className="rounded-xl border border-black/5 bg-surface px-3 py-2.5">
              <p className="text-[11px] font-medium text-muted">Tu enlace público</p>
              <p className="mt-0.5 break-all font-mono text-xs">{menuUrl}</p>
              <p className="mt-1 text-[11px] text-muted">
                Pégalo en tu biografía de Instagram o Facebook.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2 min-h-11"
                onClick={() => void copyUrl()}
              >
                {copied ? (
                  <Emoji char={UI_EMOJI.save} />
                ) : (
                  <Emoji char={UI_EMOJI.copy} />
                )}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </div>
      </div>
      <div
        hidden={tab !== "print"}
        className="grid gap-6 lg:grid-cols-2 lg:items-start"
      >
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={kind === "acrylic" ? "default" : "secondary"}
                className="min-h-11 flex-1"
                onClick={() => setKind("acrylic")}
              >
                Acrílico
              </Button>
              <Button
                type="button"
                variant={kind === "sticker" ? "default" : "secondary"}
                className="min-h-11 flex-1"
                onClick={() => setKind("sticker")}
              >
                Sticker
              </Button>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="kit-cta">Texto</Label>
                <span className="text-[11px] text-muted">
                  {cta.length}/{ctaMax}
                </span>
              </div>
              <Input
                id="kit-cta"
                value={cta}
                maxLength={ctaMax}
                onChange={(e) => {
                  const v = e.target.value.slice(0, ctaMax);
                  if (kind === "acrylic") setAcrylicCta(v);
                  else setStickerCta(v);
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="min-h-11 flex-1"
                disabled={busy || !qrPngUrl}
                onClick={() =>
                  void run(async () => {
                    const dataUrl = await capturePrint();
                    const a = document.createElement("a");
                    a.download = printName;
                    a.href = dataUrl;
                    a.click();
                    notify("Imagen descargada");
                  })
                }
              >
                <Emoji char={UI_EMOJI.download} />
                {busy ? "…" : "Descargar PNG"}
              </Button>
              {shareOk ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 flex-1"
                  disabled={busy || !qrPngUrl}
                  onClick={() =>
                    void run(async () => {
                      const dataUrl = await capturePrint();
                      const blob = await dataUrlToBlob(dataUrl);
                      await shareBlob(
                        blob,
                        printName,
                        `${kind === "acrylic" ? "Acrílico" : "Sticker"} — ${businessName}`,
                      );
                    })
                  }
                >
                  <Emoji char={UI_EMOJI.share} />
                  Compartir
                </Button>
              ) : null}
            </div>
          </div>
          <div className="lg:sticky lg:top-24 lg:self-start">
            <MarketingPrintPreview
              kind={kind}
              businessName={businessName}
              cta={cta}
              qrPngUrl={qrPngUrl}
              logoUrl={logoUrl}
              primary={primaryColor}
              active={tab === "print"}
            />
          </div>
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
