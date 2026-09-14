"use client";

import { useState } from "react";
import {
  WHATSAPP_BOT_GUIDE_SECTIONS,
  WHATSAPP_BOT_GUIDE_VERSION,
} from "@/lib/whatsapp-bot-guide";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, require checkbox before Continuar and call onAcknowledge. */
  requireAck: boolean;
  onAcknowledge?: () => Promise<void> | void;
};

export function WhatsappBotGuideDialog({
  open,
  onOpenChange,
  requireAck,
  onAcknowledge,
}: Props) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  async function continueAction() {
    if (requireAck) {
      if (!checked) return;
      setBusy(true);
      try {
        await onAcknowledge?.();
        onOpenChange(false);
        setChecked(false);
      } finally {
        setBusy(false);
      }
      return;
    }
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setChecked(false);
        onOpenChange(o);
      }}
    >
      <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-black/5 px-5 py-4">
          <DialogTitle>
            Guía: conectar WhatsApp al asistente virtual
          </DialogTitle>
          <DialogDescription>
            Requisitos, precauciones y cómo funciona el bot (versión{" "}
            {WHATSAPP_BOT_GUIDE_VERSION}).
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
          {WHATSAPP_BOT_GUIDE_SECTIONS.map((s) => (
            <section key={s.title} className="space-y-2">
              <h3 className="font-semibold text-brand-dark">{s.title}</h3>
              {s.paragraphs?.map((p) => (
                <p key={p.slice(0, 40)} className="text-muted leading-relaxed">
                  {p}
                </p>
              ))}
              {s.bullets ? (
                <ul className="list-disc space-y-1.5 pl-5 text-muted leading-relaxed">
                  {s.bullets.map((b) => (
                    <li key={b.slice(0, 48)}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
        <DialogFooter className="shrink-0 flex-col gap-3 border-t border-black/5 px-5 py-4 sm:flex-col">
          {requireAck ? (
            <label className="flex w-full cursor-pointer items-start gap-2 text-left text-sm">
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => setChecked(v === true)}
                className="mt-0.5"
              />
              <span>
                He leído y entiendo los requisitos, el uso de Meta Cloud API y
                que los cargos de mensajería Marketing (si activo difusión) los
                cobra Meta a la tarjeta de mi negocio.
              </span>
            </label>
          ) : null}
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </Button>
            <Button
              type="button"
              disabled={requireAck && (!checked || busy)}
              onClick={() => void continueAction()}
            >
              {requireAck ? "Continuar" : "Entendido"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
