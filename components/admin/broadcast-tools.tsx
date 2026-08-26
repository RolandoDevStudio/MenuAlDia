"use client";

import { useMemo, useState } from "react";
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
  shareCta?: string;
};

export function BroadcastTools({
  businessName,
  menuUrl,
  dailyLabel,
  itemNames,
  packagePrice,
  ownerPhone,
  shareCta,
}: Props) {
  const defaultMsg = useMemo(
    () =>
      buildBroadcastMessage({
        businessName,
        menuUrl,
        dailyLabel,
        itemNames,
        packagePrice,
        shareCta,
      }),
    [businessName, menuUrl, dailyLabel, itemNames, packagePrice, shareCta],
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
