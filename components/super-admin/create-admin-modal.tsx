"use client";

import { useEffect, useMemo, useState } from "react";
import type { BusinessType, PlanTemplate } from "@/lib/types";
import type { PlanPricesMap, PlanType } from "@/lib/plans";
import { FALLBACK_PLAN_PRICES, PLAN_LABELS } from "@/lib/plans";
import {
  BUSINESS_TYPE_LABELS,
  BUSINESS_TYPES,
} from "@/lib/business-labels";
import { PRESET_LABELS, THEME_PRESETS } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  ACQUISITION_LABELS,
  ACQUISITION_SOURCES,
} from "@/lib/super-admin-crm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingSlugs: string[];
  onCreated: () => void;
};

const selectClass =
  "h-11 w-full rounded-lg border border-black/10 bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand";

export function CreateAdminModal({
  open,
  onOpenChange,
  existingSlugs,
  onCreated,
}: Props) {
  const [businessType, setBusinessType] =
    useState<BusinessType>("restaurante");
  const [planType, setPlanType] = useState<PlanType>("catalog");
  const [themePreset, setThemePreset] = useState("fonda_calida");
  const [planPrices, setPlanPrices] =
    useState<PlanPricesMap>(FALLBACK_PLAN_PRICES);
  const [templates, setTemplates] = useState<PlanTemplate[]>([]);
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [isFoundingPartner, setIsFoundingPartner] = useState(false);
  const [internalNotes, setInternalNotes] = useState("");
  const [acquisitionSource, setAcquisitionSource] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sourceSlug, setSourceSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successSlug, setSuccessSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccessSlug(null);
    void (async () => {
      const [templatesRes, pricesRes] = await Promise.all([
        fetch("/api/super-admin/templates"),
        fetch("/api/plan-prices"),
      ]);
      const templatesJson = (await templatesRes.json()) as {
        templates?: PlanTemplate[];
      };
      if (templatesRes.ok) setTemplates(templatesJson.templates ?? []);
      if (pricesRes.ok) {
        const prices = (await pricesRes.json()) as PlanPricesMap;
        setPlanPrices({
          catalog: prices.catalog ?? FALLBACK_PLAN_PRICES.catalog,
          daily: prices.daily ?? FALLBACK_PLAN_PRICES.daily,
          pro: prices.pro ?? FALLBACK_PLAN_PRICES.pro,
        });
      }
    })();
  }, [open]);

  const matchedTemplate = useMemo(() => {
    return templates.find(
      (t) =>
        t.business_type === businessType &&
        t.plan_type === planType &&
        t.is_active !== false,
    );
  }, [templates, businessType, planType]);

  function resetForm() {
    setBusinessType("restaurante");
    setPlanType("catalog");
    setThemePreset("fonda_calida");
    setNewSlug("");
    setNewName("");
    setOwnerName("");
    setPhone("");
    setOwnerEmail("");
    setOwnerPassword("");
    setIsFoundingPartner(false);
    setInternalNotes("");
    setAcquisitionSource("");
    setSourceSlug("");
    setShowAdvanced(false);
    setError(null);
    setSuccessSlug(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const body: Record<string, string | boolean> = {
      new_slug: newSlug,
      new_name: newName,
      owner_name: ownerName,
      phone_whatsapp: phone,
      owner_email: ownerEmail,
      owner_password: ownerPassword,
      business_type: businessType,
      plan_type: planType,
      theme_preset: themePreset,
      is_founding_partner: isFoundingPartner,
      internal_notes: internalNotes,
      acquisition_source: acquisitionSource,
    };
    if (showAdvanced && sourceSlug.trim()) {
      body.source_slug = sourceSlug.trim();
    } else if (matchedTemplate) {
      body.template_id = matchedTemplate.id;
    }

    const res = await fetch("/api/super-admin/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { error?: string; slug?: string };
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "No se pudo crear el admin");
      return;
    }
    setSuccessSlug(json.slug ?? newSlug);
    onCreated();
  }

  const canSubmit =
    !!newSlug &&
    !!newName &&
    !!ownerEmail &&
    ownerPassword.length >= 6 &&
    (!!matchedTemplate || !!(showAdvanced && sourceSlug.trim()));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <Emoji char={UI_EMOJI.create} />
            Crear Nuevo Admin
          </DialogTitle>
          <DialogDescription>
            Elige giro, plan y tema. El menú inicial se arma solo desde la
            semilla correspondiente.
          </DialogDescription>
        </DialogHeader>

        {successSlug ? (
          <div className="space-y-3">
            <p className="text-sm text-green-700">
              Cuenta creada. Menú público:{" "}
              <a
                className="font-semibold underline"
                href={`/${successSlug}`}
                target="_blank"
                rel="noreferrer"
              >
                /{successSlug}
              </a>
            </p>
            <p className="text-xs text-muted">
              Login: {ownerEmail} · Comparte la contraseña por un canal seguro.
            </p>
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Cerrar
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Giro</Label>
                <select
                  className={selectClass}
                  value={businessType}
                  onChange={(e) =>
                    setBusinessType(e.target.value as BusinessType)
                  }
                >
                  {BUSINESS_TYPES.map((bt) => (
                    <option key={bt} value={bt}>
                      {BUSINESS_TYPE_LABELS[bt]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <select
                  className={selectClass}
                  value={planType}
                  onChange={(e) => setPlanType(e.target.value as PlanType)}
                >
                  {(Object.keys(PLAN_LABELS) as PlanType[]).map((p) => (
                    <option key={p} value={p}>
                      {PLAN_LABELS[p]} (
                      {planPrices[p]?.monthly ??
                        FALLBACK_PLAN_PRICES[p].monthly}{" "}
                      MXN)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Color / tema de interfaz</Label>
              <select
                className={selectClass}
                value={themePreset}
                onChange={(e) => setThemePreset(e.target.value)}
              >
                {Object.keys(THEME_PRESETS).map((key) => (
                  <option key={key} value={key}>
                    {PRESET_LABELS[key] ?? key}
                  </option>
                ))}
              </select>
            </div>

            {!matchedTemplate && !showAdvanced ? (
              <p className="text-xs text-amber-800">
                No hay semilla activa para este giro/plan. Activa una en
                Plantillas o usa “Avanzado” con un slug de origen.
              </p>
            ) : matchedTemplate ? (
              <p className="text-xs text-muted">
                Semilla: {matchedTemplate.name}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nuevo slug</Label>
                <Input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="mi-restaurante"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nombre del negocio</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Mi Restaurante"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Nombre del dueño</Label>
              <Input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Juan Pérez"
              />
            </div>

            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="52155…"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Email de login</Label>
                <Input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="dueno@negocio.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contraseña</Label>
                <Input
                  type="password"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Origen</Label>
              <select
                className={selectClass}
                value={acquisitionSource}
                onChange={(e) => setAcquisitionSource(e.target.value)}
              >
                <option value="">Sin origen</option>
                {ACQUISITION_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {ACQUISITION_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-black/5 bg-background/50 px-3 py-2">
              <div>
                <Label>Socio fundador</Label>
                <p className="text-[11px] text-muted">
                  Marca al crear cuentas de prueba / early adopters
                </p>
              </div>
              <Switch
                checked={isFoundingPartner}
                onCheckedChange={setIsFoundingPartner}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-internal-notes">Notas internas</Label>
              <Textarea
                id="create-internal-notes"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Solo visible para superadmin"
                className="min-h-[72px]"
              />
            </div>

            <button
              type="button"
              className="text-xs font-semibold text-muted underline-offset-2 hover:underline"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? "Ocultar avanzado" : "Avanzado: clonar desde slug"}
            </button>
            {showAdvanced ? (
              <div className="space-y-1.5">
                <Label>Slug de origen</Label>
                <Input
                  list="create-admin-slugs"
                  value={sourceSlug}
                  onChange={(e) => setSourceSlug(e.target.value)}
                  placeholder="demo-restaurante"
                />
                <datalist id="create-admin-slugs">
                  {existingSlugs.map((slug) => (
                    <option key={slug} value={slug} />
                  ))}
                </datalist>
              </div>
            ) : null}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <Button
              type="button"
              className="w-full"
              disabled={busy || !canSubmit}
              onClick={() => void submit()}
            >
              {busy ? "Creando…" : (
                <>
                  <Emoji char={UI_EMOJI.create} />
                  Crear admin
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
