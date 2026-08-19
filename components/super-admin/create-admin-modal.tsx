"use client";

import { useEffect, useMemo, useState } from "react";
import type { BusinessType, PlanTemplate } from "@/lib/types";
import type { PlanType } from "@/lib/plans";
import { PLAN_LABELS, PLAN_PRICES_MXN } from "@/lib/plans";
import {
  BUSINESS_TYPE_LABELS,
  BUSINESS_TYPES,
} from "@/lib/business-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [templates, setTemplates] = useState<PlanTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [sourceSlug, setSourceSlug] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    void (async () => {
      const res = await fetch("/api/super-admin/templates");
      const json = (await res.json()) as {
        templates?: PlanTemplate[];
        error?: string;
      };
      if (res.ok) setTemplates(json.templates ?? []);
    })();
  }, [open]);

  const filteredTemplates = useMemo(() => {
    return templates.filter(
      (t) =>
        t.business_type === businessType &&
        t.plan_type === planType &&
        t.is_active !== false,
    );
  }, [templates, businessType, planType]);

  useEffect(() => {
    if (
      templateId &&
      !filteredTemplates.some((t) => t.id === templateId)
    ) {
      setTemplateId("");
    }
  }, [filteredTemplates, templateId]);

  function resetForm() {
    setBusinessType("restaurante");
    setPlanType("catalog");
    setTemplateId("");
    setSourceSlug("");
    setNewSlug("");
    setNewName("");
    setOwnerName("");
    setPhone("");
    setOwnerEmail("");
    setOwnerPassword("");
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const body: Record<string, string> = {
      new_slug: newSlug,
      new_name: newName,
      owner_name: ownerName,
      phone_whatsapp: phone,
      owner_email: ownerEmail,
      owner_password: ownerPassword,
      business_type: businessType,
      plan_type: planType,
    };
    if (templateId) body.template_id = templateId;
    else body.source_slug = sourceSlug;

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
    resetForm();
    onOpenChange(false);
    onCreated();
  }

  const canSubmit =
    !!newSlug &&
    !!newName &&
    !!ownerEmail &&
    !!ownerPassword &&
    (!!templateId || !!sourceSlug);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Admin</DialogTitle>
          <DialogDescription>
            Clona una plantilla o un slug existente y crea el acceso del dueño.
          </DialogDescription>
        </DialogHeader>

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
                    {PLAN_LABELS[p]} ({PLAN_PRICES_MXN[p]} MXN)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Plantilla</Label>
            <select
              className={selectClass}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">— Usar slug de origen —</option>
              {filteredTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.slug_key})
                </option>
              ))}
            </select>
            {filteredTemplates.length === 0 ? (
              <p className="text-xs text-muted">
                No hay plantillas activas para este giro/plan.
              </p>
            ) : null}
          </div>

          {!templateId ? (
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

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button
            type="button"
            className="w-full"
            disabled={busy || !canSubmit}
            onClick={() => void submit()}
          >
            {busy ? "Creando…" : "Crear admin"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
