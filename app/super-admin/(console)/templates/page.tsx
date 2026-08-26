"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BusinessType, PlanTemplate } from "@/lib/types";
import type { PlanType } from "@/lib/plans";
import { PLAN_LABELS } from "@/lib/plans";
import {
  BUSINESS_TYPE_LABELS,
  BUSINESS_TYPES,
} from "@/lib/business-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Emoji } from "@/components/ui-emoji";
import { formatMexicoCityDateTime } from "@/lib/dates";
import { UI_EMOJI } from "@/lib/ui-emoji";

const PLAN_TYPES = Object.keys(PLAN_LABELS) as PlanType[];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<PlanTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { name: string; syncSlug: string; busy: boolean }>
  >({});

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/super-admin/templates");
    const json = (await res.json()) as {
      templates?: PlanTemplate[];
      error?: string;
    };
    if (!res.ok) {
      setError(json.error ?? "No se pudieron cargar plantillas");
      return;
    }
    const list = json.templates ?? [];
    setTemplates(list);
    setDrafts((prev) => {
      const next = { ...prev };
      for (const t of list) {
        next[t.id] = {
          name: prev[t.id]?.name ?? t.name,
          syncSlug: prev[t.id]?.syncSlug ?? "",
          busy: false,
        };
      }
      return next;
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byKey = useMemo(() => {
    const map = new Map<string, PlanTemplate>();
    for (const t of templates) {
      map.set(`${t.business_type}:${t.plan_type}`, t);
    }
    return map;
  }, [templates]);

  async function patchTemplate(
    id: string,
    body: Record<string, unknown>,
  ): Promise<boolean> {
    setDrafts((d) => ({
      ...d,
      [id]: { ...d[id], busy: true },
    }));
    setError(null);
    setMessage(null);
    const res = await fetch("/api/super-admin/templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    const json = (await res.json()) as { error?: string };
    setDrafts((d) => ({
      ...d,
      [id]: { ...d[id], busy: false },
    }));
    if (!res.ok) {
      setError(json.error ?? "No se pudo actualizar la plantilla");
      return false;
    }
    return true;
  }

  async function saveName(t: PlanTemplate) {
    const name = drafts[t.id]?.name?.trim();
    if (!name) return;
    const ok = await patchTemplate(t.id, { name });
    if (ok) {
      setMessage("Nombre actualizado");
      await load();
    }
  }

  async function toggleActive(t: PlanTemplate, isActive: boolean) {
    const ok = await patchTemplate(t.id, { is_active: isActive });
    if (ok) await load();
  }

  async function syncFromSlug(t: PlanTemplate) {
    const slug = drafts[t.id]?.syncSlug?.trim();
    if (!slug) {
      setError("Indica un slug demo para sincronizar");
      return;
    }
    const ok = await patchTemplate(t.id, { sync_from_slug: slug });
    if (ok) {
      setMessage(`Plantilla sincronizada desde /${slug}`);
      setDrafts((d) => ({
        ...d,
        [t.id]: { ...d[t.id], syncSlug: "" },
      }));
      await load();
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">
          <Emoji char={UI_EMOJI.seeds} />
          Semillas demo
        </h1>
        <p className="text-sm text-muted">
          Contenido inicial por giro × plan. Al crear un admin se usa sola;
          aquí sincronizas o activas semillas.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-accent">{message}</p> : null}

      <div className="space-y-6">
        {BUSINESS_TYPES.map((bt: BusinessType) => (
          <section key={bt} className="space-y-3">
            <h2 className="text-sm font-semibold text-brand">
              {BUSINESS_TYPE_LABELS[bt]}
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              {PLAN_TYPES.map((plan) => {
                const t = byKey.get(`${bt}:${plan}`);
                if (!t) {
                  return (
                    <div
                      key={`${bt}-${plan}`}
                      className="rounded-2xl border border-dashed border-black/15 bg-surface/50 p-4 text-sm text-muted"
                    >
                      <p className="font-semibold text-foreground">
                        {PLAN_LABELS[plan]}
                      </p>
                      <p className="mt-1 text-xs">Sin plantilla en BD</p>
                    </div>
                  );
                }
                const draft = drafts[t.id] ?? {
                  name: t.name,
                  syncSlug: "",
                  busy: false,
                };
                return (
                  <div
                    key={t.id}
                    className="space-y-3 rounded-2xl border border-black/10 bg-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-muted">
                          {PLAN_LABELS[plan]}
                        </p>
                        <p className="font-mono text-[11px] text-muted">
                          {t.slug_key}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted">Activa</span>
                        <Switch
                          checked={t.is_active !== false}
                          disabled={draft.busy}
                          onCheckedChange={(on) => void toggleActive(t, on)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Nombre</Label>
                      <div className="flex gap-2">
                        <Input
                          value={draft.name}
                          onChange={(e) =>
                            setDrafts((d) => ({
                              ...d,
                              [t.id]: { ...draft, name: e.target.value },
                            }))
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={draft.busy || draft.name === t.name}
                          onClick={() => void saveName(t)}
                        >
                          {draft.busy ? "Guardando…" : (
                            <>
                              <Emoji char={UI_EMOJI.save} />
                              Guardar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Sincronizar desde slug</Label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={draft.syncSlug}
                          onChange={(e) =>
                            setDrafts((d) => ({
                              ...d,
                              [t.id]: {
                                ...draft,
                                syncSlug: e.target.value,
                              },
                            }))
                          }
                          placeholder="demo-restaurante"
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={draft.busy || !draft.syncSlug.trim()}
                          onClick={() => void syncFromSlug(t)}
                        >
                          <Emoji char={UI_EMOJI.clone} />
                          Sincronizar desde slug
                        </Button>
                      </div>
                    </div>

                    <p className="text-[11px] text-muted">
                      Actualizado:{" "}
                      {t.updated_at
                        ? formatMexicoCityDateTime(t.updated_at)
                        : "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
