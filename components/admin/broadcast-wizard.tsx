"use client";

import { useMemo, useState } from "react";
import {
  ANNOUNCEMENT_LABELS,
  ANNOUNCEMENT_TYPES,
  MAX_BROADCAST_TEMPLATES,
  TONE_LABELS,
  TONES,
  type AnnouncementType,
  type BroadcastTone,
} from "@/lib/broadcast-ai-prompt";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Loader2, Trash2 } from "lucide-react";
import { AiCtaButton } from "@/components/admin/ai-cta-button";

export type BroadcastTemplateRow = {
  id: string;
  title: string;
  body: string;
  announcement_type: string;
  created_at?: string;
  updated_at?: string;
};

type DishOption = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessName: string;
  menuUrl: string;
  dailyLabel: string;
  dishes: DishOption[];
  packagePrice: number | null;
  shareCta?: string;
  templates: BroadcastTemplateRow[];
  templateLimit?: number;
  onApplyMessage: (message: string) => void;
  onTemplatesChange: (templates: BroadcastTemplateRow[]) => void;
};

type Step = 1 | 2 | 3 | 4;

export function BroadcastWizard({
  open,
  onOpenChange,
  businessName,
  menuUrl,
  dailyLabel,
  dishes,
  packagePrice,
  shareCta,
  templates,
  templateLimit = MAX_BROADCAST_TEMPLATES,
  onApplyMessage,
  onTemplatesChange,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [announcementType, setAnnouncementType] =
    useState<AnnouncementType>("menu_dia");
  const [selectedNames, setSelectedNames] = useState<string[]>(() =>
    dishes.slice(0, 6).map((d) => d.name),
  );
  const [includeEmojis, setIncludeEmojis] = useState(true);
  const [includeMenuLink, setIncludeMenuLink] = useState(true);
  const [includePrice, setIncludePrice] = useState(true);
  const [includeBoldMarkers, setIncludeBoldMarkers] = useState(true);
  const [adminNote, setAdminNote] = useState("");
  const [tone, setTone] = useState<BroadcastTone>("cercano");
  const [length, setLength] = useState<"corto" | "medio">("corto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variants, setVariants] = useState<string[]>([]);
  const [fallback, setFallback] = useState(false);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [saveTitle, setSaveTitle] = useState("");

  const atLimit = templates.length >= templateLimit;

  const dishNames = useMemo(() => dishes.map((d) => d.name), [dishes]);

  function resetFlow() {
    setStep(1);
    setError(null);
    setVariants([]);
    setFallback(false);
    setSavingIdx(null);
    setSaveTitle("");
  }

  function toggleDish(name: string) {
    setSelectedNames((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : [...prev, name],
    );
  }

  function selectAllDishes() {
    setSelectedNames(dishNames);
  }

  function clearDishSelection() {
    setSelectedNames([]);
  }

  const allSelected =
    dishNames.length > 0 && selectedNames.length === dishNames.length;

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai/generate-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          announcementType,
          tone,
          length,
          itemNames: selectedNames,
          packagePrice,
          includeEmojis,
          includeMenuLink,
          includePrice,
          includeBoldMarkers,
          adminNote: adminNote.trim() || undefined,
          menuUrl,
          dailyLabel,
          shareCta,
          variantCount: 3,
        }),
      });
      const data = (await res.json()) as {
        variants?: string[];
        fallback?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok && !data.variants?.length) {
        setError(data.message || "No se pudo generar.");
        return;
      }
      setVariants(data.variants ?? []);
      setFallback(Boolean(data.fallback));
      setStep(4);
    } catch {
      setError("Error de red al generar.");
    } finally {
      setLoading(false);
    }
  }

  async function saveVariant(idx: number, body: string) {
    if (atLimit) {
      setError(
        `Límite de ${templateLimit} plantillas. Elimina una para guardar otra.`,
      );
      return;
    }
    setSavingIdx(idx);
    setError(null);
    try {
      const res = await fetch("/api/admin/broadcast-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:
            saveTitle.trim() ||
            `${ANNOUNCEMENT_LABELS[announcementType]} · ${new Date().toLocaleDateString("es-MX")}`,
          body,
          announcementType,
        }),
      });
      const data = (await res.json()) as {
        template?: BroadcastTemplateRow;
        message?: string;
      };
      if (!res.ok || !data.template) {
        setError(data.message || "No se pudo guardar.");
        return;
      }
      onTemplatesChange([data.template, ...templates]);
      setSaveTitle("");
    } catch {
      setError("Error de red al guardar.");
    } finally {
      setSavingIdx(null);
    }
  }

  async function deleteTemplate(id: string) {
    try {
      const res = await fetch(`/api/admin/broadcast-templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      onTemplatesChange(templates.filter((t) => t.id !== id));
    } catch {
      /* ignore */
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetFlow();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Generar mensaje WhatsApp
          </DialogTitle>
          <DialogDescription>
            Paso {step} de 4 · {businessName}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">¿Qué quieres anunciar?</p>
            <div className="grid gap-2">
              {ANNOUNCEMENT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-sm transition",
                    announcementType === t
                      ? "border-brand bg-brand/5 font-medium"
                      : "border-black/10 hover:bg-black/5",
                  )}
                  onClick={() => setAnnouncementType(t)}
                >
                  {ANNOUNCEMENT_LABELS[t]}
                </button>
              ))}
            </div>
            <Button type="button" className="w-full" onClick={() => setStep(2)}>
              Siguiente
            </Button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted">
                Elige qué incluir ({dailyLabel})
              </p>
              {dishNames.length > 0 ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-brand underline-offset-2 hover:underline"
                  onClick={() =>
                    allSelected ? clearDishSelection() : selectAllDishes()
                  }
                >
                  {allSelected ? "Borrar selección" : "Seleccionar todos"}
                </button>
              ) : null}
            </div>
            {dishNames.length > 0 ? (
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-black/5 p-2">
                {dishNames.map((name) => {
                  const checked = selectedNames.includes(name);
                  return (
                    <label
                      key={name}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleDish(name)}
                      />
                      <span>{name}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted">
                No hay especiales de hoy cargados; el mensaje será genérico.
              </p>
            )}
            {dishNames.length > 0 ? (
              <p className="text-[11px] text-muted">
                {selectedNames.length} de {dishNames.length} seleccionados
              </p>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includeEmojis}
                onCheckedChange={(v) => setIncludeEmojis(v === true)}
              />
              Emojis
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includeMenuLink}
                onCheckedChange={(v) => setIncludeMenuLink(v === true)}
              />
              Enlace al menú
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includePrice}
                onCheckedChange={(v) => setIncludePrice(v === true)}
              />
              Precio del paquete
            </label>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={includeBoldMarkers}
                onCheckedChange={(v) => setIncludeBoldMarkers(v === true)}
              />
              <span>
                Negrita con *asteriscos* (WhatsApp)
                <span className="mt-0.5 block text-xs font-normal text-muted">
                  Desactívalo para Messenger u otras apps.
                </span>
              </span>
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="admin-note">Nota opcional</Label>
              <Textarea
                id="admin-note"
                className="min-h-16 text-sm"
                placeholder="Ej. solo hoy, envío gratis…"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                maxLength={400}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setStep(1)}
              >
                Atrás
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => setStep(3)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">Tono y longitud</p>
            <div className="grid grid-cols-2 gap-2">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm",
                    tone === t
                      ? "border-brand bg-brand/5 font-medium"
                      : "border-black/10 hover:bg-black/5",
                  )}
                  onClick={() => setTone(t)}
                >
                  {TONE_LABELS[t]}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["corto", "Corto"],
                  ["medio", "Medio"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm",
                    length === id
                      ? "border-brand bg-brand/5 font-medium"
                      : "border-black/10 hover:bg-black/5",
                  )}
                  onClick={() => setLength(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setStep(2)}
                disabled={loading}
              >
                Atrás
              </Button>
              <AiCtaButton
                className="flex-1"
                onClick={() => void generate()}
                disabled={loading}
                hideIcon={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Generando…
                  </>
                ) : (
                  "Generar 3 opciones"
                )}
              </AiCtaButton>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3">
            {fallback ? (
              <p className="text-xs text-amber-700">
                Usamos plantillas locales (IA no disponible o límite).
              </p>
            ) : null}
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="save-title">
                Título al guardar ({templates.length}/{templateLimit})
              </Label>
              <Input
                id="save-title"
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder="Ej. Promo viernes"
                maxLength={80}
              />
            </div>
            <div className="max-h-[40vh] space-y-3 overflow-y-auto">
              {variants.map((v, idx) => (
                <div
                  key={idx}
                  className="space-y-2 rounded-xl border border-black/5 p-3"
                >
                  <Textarea
                    className="min-h-28 text-sm"
                    value={v}
                    onChange={(e) => {
                      const next = [...variants];
                      next[idx] = e.target.value;
                      setVariants(next);
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        onApplyMessage(variants[idx] ?? v);
                        onOpenChange(false);
                        resetFlow();
                      }}
                    >
                      Usar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={atLimit || savingIdx === idx}
                      onClick={() => void saveVariant(idx, variants[idx] ?? v)}
                    >
                      {savingIdx === idx ? "Guardando…" : "Guardar"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {templates.length > 0 ? (
              <div className="space-y-2 border-t border-black/5 pt-3">
                <p className="text-xs font-medium text-muted">
                  Mis plantillas
                </p>
                <ul className="max-h-28 space-y-1 overflow-y-auto">
                  {templates.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left hover:underline"
                        onClick={() => {
                          onApplyMessage(t.body);
                          onOpenChange(false);
                          resetFlow();
                        }}
                      >
                        {t.title || "Sin título"}
                      </button>
                      <button
                        type="button"
                        className="rounded p-1.5 text-muted hover:bg-black/5 hover:text-red-600"
                        aria-label="Eliminar plantilla"
                        onClick={() => void deleteTemplate(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setStep(3)}
              >
                Atrás
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setVariants([]);
                  setStep(3);
                }}
              >
                Regenerar
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
