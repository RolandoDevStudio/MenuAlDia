"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@/lib/constants/legal";

type Props = {
  restaurantId: string;
  open: boolean;
  onAccepted: (acceptedAt: string) => void;
};

export function TermsAcceptanceModal({
  restaurantId,
  open,
  onAccepted,
}: Props) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    if (!checked || saving) return;
    setSaving(true);
    setError(null);
    const acceptedAt = new Date().toISOString();
    const supabase = createClient();
    const { error: upErr } = await supabase
      .from("restaurants")
      .update({
        terms_version_accepted: CURRENT_TERMS_VERSION,
        terms_accepted_at: acceptedAt,
      })
      .eq("id", restaurantId);

    if (upErr) {
      setError(upErr.message);
      setSaving(false);
      return;
    }
    onAccepted(acceptedAt);
    setSaving(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        /* blocking: ignore dismiss */
      }}
    >
      <DialogContent
        className="menu-dialog-in [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Aceptación de términos legales</DialogTitle>
          <DialogDescription>
            Para continuar usando el panel de Menú al Día debes aceptar los
            documentos legales vigentes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p>
            Revisa y acepta:{" "}
            <Link
              href="/terminos"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand underline-offset-2 hover:underline"
            >
              Términos y Condiciones (v{CURRENT_TERMS_VERSION})
            </Link>{" "}
            y{" "}
            <Link
              href="/privacidad"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand underline-offset-2 hover:underline"
            >
              Aviso de Privacidad (v{CURRENT_PRIVACY_VERSION})
            </Link>
            .
          </p>

          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-black/10 bg-background/60 px-3 py-3">
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm leading-snug">
              He leído y acepto los Términos y Condiciones (v
              {CURRENT_TERMS_VERSION}) y el Aviso de Privacidad.
            </span>
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button
            type="button"
            className="min-h-11 w-full"
            disabled={!checked || saving}
            onClick={() => void accept()}
          >
            {saving ? "Guardando…" : "Aceptar y Continuar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
