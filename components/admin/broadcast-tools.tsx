"use client";

import { useMemo, useState } from "react";
import { buildBroadcastMessage } from "@/lib/whatsapp";
import {
  MAX_BROADCAST_TEMPLATES,
  ANNOUNCEMENT_LABELS,
  stripWhatsAppBoldMarkers,
  type AnnouncementType,
} from "@/lib/broadcast-ai-prompt";
import {
  BroadcastWizard,
  type BroadcastTemplateRow,
} from "@/components/admin/broadcast-wizard";
import { AiCtaButton } from "@/components/admin/ai-cta-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";
import { Share2, Trash2 } from "lucide-react";

type DishOption = { id: string; name: string };

type Props = {
  businessName: string;
  menuUrl: string;
  dailyLabel: string;
  itemNames: string[];
  dishes?: DishOption[];
  packagePrice: number | null;
  ownerPhone?: string | null;
  shareCta?: string;
  initialTemplates?: BroadcastTemplateRow[];
};

export function BroadcastTools({
  businessName,
  menuUrl,
  dailyLabel,
  itemNames,
  dishes,
  packagePrice,
  shareCta,
  initialTemplates = [],
}: Props) {
  const dishOptions = useMemo(() => {
    if (dishes && dishes.length > 0) return dishes;
    return itemNames.map((name, i) => ({ id: `name-${i}`, name }));
  }, [dishes, itemNames]);

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
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [templates, setTemplates] =
    useState<BroadcastTemplateRow[]>(initialTemplates);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [keepBoldMarkers, setKeepBoldMarkers] = useState(true);

  async function copyMsg() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function shareMsg() {
    setShareHint(null);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text: message });
        return;
      }
      await navigator.clipboard.writeText(message);
      setShareHint("Copiado — pégalo en la app que quieras.");
      window.setTimeout(() => setShareHint(null), 2800);
    } catch (err) {
      // User cancelled share sheet — ignore AbortError
      if (err instanceof DOMException && err.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(message);
        setShareHint("Copiado — pégalo en la app que quieras.");
        window.setTimeout(() => setShareHint(null), 2800);
      } catch {
        setShareHint("No se pudo compartir. Usa Copiar.");
      }
    }
  }

  function toggleBoldMarkers(next: boolean) {
    setKeepBoldMarkers(next);
    if (!next) {
      setMessage((prev) => stripWhatsAppBoldMarkers(prev));
    }
  }

  async function deleteTemplate(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/broadcast-templates/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      }
    } catch {
      /* ignore */
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-black/5 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Difusión WhatsApp</h2>
          <p className="text-xs text-muted">
            Genera, edita y comparte el mensaje en WhatsApp, Messenger u otra
            app.
          </p>
        </div>
        <AiCtaButton
          className="shrink-0"
          onClick={() => setWizardOpen(true)}
        >
          Generar con IA
        </AiCtaButton>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="broadcast-msg">Mensaje</Label>
        <Textarea
          id="broadcast-msg"
          className="min-h-36 text-sm"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <label className="flex items-start gap-2 text-xs text-muted">
          <Checkbox
            className="mt-0.5"
            checked={keepBoldMarkers}
            onCheckedChange={(v) => toggleBoldMarkers(v === true)}
          />
          <span>
            Mantener *asteriscos* de negrita (WhatsApp). Desactiva para texto
            plano (Messenger, etc.).
          </span>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="min-h-11 flex-1"
          onClick={() => void shareMsg()}
        >
          <Share2 className="h-4 w-4" aria-hidden />
          Compartir
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
      {shareHint ? (
        <p className="text-xs text-muted" role="status">
          {shareHint}
        </p>
      ) : null}

      {templates.length > 0 ? (
        <div className="space-y-2 border-t border-black/5 pt-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold">Mis plantillas</h3>
            <span className="text-xs text-muted">
              {templates.length}/{MAX_BROADCAST_TEMPLATES}
            </span>
          </div>
          <ul className="space-y-1.5">
            {templates.map((t) => {
              const typeLabel =
                ANNOUNCEMENT_LABELS[t.announcement_type as AnnouncementType] ??
                t.announcement_type;
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-2 rounded-xl border border-black/5 px-2.5 py-2"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setMessage(t.body)}
                  >
                    <span className="block truncate text-sm font-medium">
                      {t.title || "Sin título"}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {typeLabel}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setMessage(t.body)}
                  >
                    Usar
                  </Button>
                  <button
                    type="button"
                    className="rounded p-2 text-muted hover:bg-black/5 hover:text-red-600 disabled:opacity-50"
                    aria-label="Eliminar plantilla"
                    disabled={deletingId === t.id}
                    onClick={() => void deleteTemplate(t.id)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted">
          Aún no tienes plantillas guardadas ({MAX_BROADCAST_TEMPLATES} máx.).
          Genera con IA y elige Guardar.
        </p>
      )}

      <BroadcastWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        businessName={businessName}
        menuUrl={menuUrl}
        dailyLabel={dailyLabel}
        dishes={dishOptions}
        packagePrice={packagePrice}
        shareCta={shareCta}
        templates={templates}
        onApplyMessage={(msg) => {
          setMessage(
            keepBoldMarkers ? msg : stripWhatsAppBoldMarkers(msg),
          );
        }}
        onTemplatesChange={setTemplates}
      />
    </div>
  );
}
