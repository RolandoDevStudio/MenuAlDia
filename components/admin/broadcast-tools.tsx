"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import {
  buildBroadcastMessage,
  buildWaMeUrl,
} from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";

type Props = {
  businessName: string;
  menuUrl: string;
  dailyLabel: string;
  itemNames: string[];
  packagePrice: number | null;
  /** Owner WhatsApp — used for "probar mensaje" (send to self / open composer). */
  ownerPhone?: string | null;
};

export function BroadcastTools({
  businessName,
  menuUrl,
  dailyLabel,
  itemNames,
  packagePrice,
  ownerPhone,
}: Props) {
  const defaultMsg = useMemo(
    () =>
      buildBroadcastMessage({
        businessName,
        menuUrl,
        dailyLabel,
        itemNames,
        packagePrice,
      }),
    [businessName, menuUrl, dailyLabel, itemNames, packagePrice],
  );
  const [message, setMessage] = useState(defaultMsg);
  const [copied, setCopied] = useState(false);

  async function copyMsg() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  function openWa() {
    const phone = ownerPhone?.trim();
    if (phone) {
      window.open(buildWaMeUrl(phone, message), "_blank", "noopener,noreferrer");
      return;
    }
    // Without a destination number, open WhatsApp share via web with text only
    // (user picks chat / list).
    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-black/5 bg-surface p-4">
      <div>
        <h2 className="text-sm font-semibold">Difusión WhatsApp</h2>
        <p className="text-xs text-muted">
          Copia el texto a tu lista de difusión o ábrelo en WhatsApp.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="broadcast-msg">Mensaje</Label>
        <Textarea
          id="broadcast-msg"
          className="min-h-36 text-sm"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="min-h-11 flex-1" onClick={openWa}>
          <Emoji char={UI_EMOJI.whatsapp} />
          Abrir WhatsApp
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          onClick={() => void copyMsg()}
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
  );
}

export function QrPrintCard({
  businessName,
  menuUrl,
  slogan,
}: {
  businessName: string;
  menuUrl: string;
  slogan?: string | null;
}) {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=8&data=${encodeURIComponent(menuUrl)}`;

  function printSheet() {
    window.print();
  }

  return (
    <div className="space-y-3 rounded-2xl border border-black/5 bg-surface p-4 print:border-0 print:bg-white print:p-0">
      <div className="print:hidden">
        <h2 className="text-sm font-semibold">QR para imprimir / PDF</h2>
        <p className="text-xs text-muted">
          Imprime o guarda como PDF (Ctrl+P → Guardar como PDF). Ideal para mesa,
          escaparate o tarjeta.
        </p>
      </div>

      <div
        id="qr-print-sheet"
        className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-black/10 bg-white px-6 py-8 text-center print:max-w-none print:border-0 print:px-8 print:py-12"
      >
        <p className="font-[family-name:var(--font-display)] text-2xl text-brand-dark">
          {businessName}
        </p>
        {slogan ? (
          <p className="text-sm text-muted">{slogan}</p>
        ) : (
          <p className="text-sm text-muted">Escanea y pide por WhatsApp</p>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrSrc}
          alt={`Código QR de ${businessName}`}
          width={280}
          height={280}
          className="h-56 w-56 rounded-lg border border-black/5 bg-white p-2 sm:h-64 sm:w-64 print:h-72 print:w-72"
        />
        <p className="break-all text-xs text-muted">{menuUrl}</p>
        <p className="text-[10px] uppercase tracking-wide text-muted">
          Menú al Día
        </p>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button type="button" className="min-h-11 flex-1" onClick={printSheet}>
          <Printer className="h-4 w-4" />
          Imprimir / PDF
        </Button>
        <Button type="button" variant="secondary" className="min-h-11" asChild>
          <a href={qrSrc} download={`${businessName}-qr.png`} target="_blank" rel="noreferrer">
            Descargar PNG
          </a>
        </Button>
      </div>
    </div>
  );
}
