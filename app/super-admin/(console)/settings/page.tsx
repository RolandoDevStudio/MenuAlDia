"use client";

import { useEffect, useRef, useState } from "react";
import {
  FALLBACK_PLAN_PRICES,
  type PlanPricesMap,
  type PlanType,
} from "@/lib/plans";
import {
  COMPARISON_IMAGE_SLOTS,
  DEFAULT_COMPARISON_ROWS,
  DEFAULT_LANDING_CONTENT,
  DEFAULT_LANDING_FAQ,
  type ComparisonImageSlot,
  type LandingContent,
  type LandingFaqItem,
  type LandingTestimonial,
} from "@/lib/landing-content";
import type { CanonicalDemoId } from "@/lib/canonical-demos";
import { compressImage } from "@/lib/compress-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DEFAULT_SPEI_INFO, type SpeiInfo } from "@/lib/coupons";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp";
import { LandingMetrics } from "@/components/super-admin/landing-metrics";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";

const GIROS: { id: CanonicalDemoId; label: string }[] = [
  { id: "restaurante", label: "Restaurante" },
  { id: "servicios", label: "Servicios" },
  { id: "tienda", label: "Tienda" },
];

const COMPARE_LABELS: Record<ComparisonImageSlot, string> = {
  control_problem: "Control · problema",
  control_solution: "Control · solución",
  attraction_problem: "Atracción · problema",
  attraction_solution: "Atracción · solución",
  retention_problem: "Retención · problema",
  retention_solution: "Retención · solución",
  value_problem: "Valor · problema",
  value_solution: "Valor · solución",
};

function emptyTestimonial(): LandingTestimonial {
  return { quote: "", author: "", role: "", initial: "" };
}

function CmsFold({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded-2xl border border-black/5 bg-surface"
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
        {title}
      </summary>
      <div className="space-y-3 border-t border-black/5 px-4 pb-4 pt-3">
        {children}
      </div>
    </details>
  );
}

export default function SuperAdminSettingsPage() {
  const [prices, setPrices] = useState<PlanPricesMap>(FALLBACK_PLAN_PRICES);
  const [landing, setLanding] = useState<LandingContent>({
    ...DEFAULT_LANDING_CONTENT,
    faq: DEFAULT_LANDING_FAQ.map((f) => ({ ...f })),
    testimonials: [],
    demoPosters: {},
    comparisonImages: {},
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingGiro, setUploadingGiro] = useState<CanonicalDemoId | null>(
    null,
  );
  const [uploadingSlot, setUploadingSlot] = useState<ComparisonImageSlot | null>(
    null,
  );
  const [spei, setSpei] = useState<SpeiInfo>({ ...DEFAULT_SPEI_INFO });
  const fileRefs = useRef<Partial<Record<CanonicalDemoId, HTMLInputElement | null>>>(
    {},
  );
  const compareFileRefs = useRef<
    Partial<Record<ComparisonImageSlot, HTMLInputElement | null>>
  >({});

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/super-admin/settings");
      if (!res.ok) return;
      const data = (await res.json()) as Record<string, unknown>;
      if (data.plan_prices && typeof data.plan_prices === "object") {
        setPrices({
          ...FALLBACK_PLAN_PRICES,
          ...(data.plan_prices as PlanPricesMap),
        });
      }
      if (data.landing_content) {
        const raw = data.landing_content as Partial<LandingContent>;
        setLanding({
          heroTitle: raw.heroTitle ?? DEFAULT_LANDING_CONTENT.heroTitle,
          heroSubtitle:
            raw.heroSubtitle ?? DEFAULT_LANDING_CONTENT.heroSubtitle,
          contactBlurb:
            raw.contactBlurb ?? DEFAULT_LANDING_CONTENT.contactBlurb,
          socialProofLine:
            raw.socialProofLine ?? DEFAULT_LANDING_CONTENT.socialProofLine,
          salesWhatsApp:
            raw.salesWhatsApp?.trim() ||
            DEFAULT_LANDING_CONTENT.salesWhatsApp,
          testimonials: Array.isArray(raw.testimonials)
            ? raw.testimonials.slice(0, 3)
            : [],
          faq:
            Array.isArray(raw.faq) && raw.faq.length > 0
              ? raw.faq
              : DEFAULT_LANDING_FAQ.map((f) => ({ ...f })),
          demoPosters: raw.demoPosters ?? {},
          comparisonImages: raw.comparisonImages ?? {},
        });
      }
      if (data.spei_info && typeof data.spei_info === "object") {
        setSpei({
          ...DEFAULT_SPEI_INFO,
          ...(data.spei_info as SpeiInfo),
        });
      }
    })();
  }, []);

  function buildLandingPayload(source: LandingContent): LandingContent | null {
    const cleanedTestimonials = source.testimonials
      .map((t) => ({
        quote: t.quote.trim(),
        author: t.author.trim(),
        role: t.role?.trim() || undefined,
        initial: t.initial?.trim() || undefined,
      }))
      .filter((t) => t.quote && t.author)
      .slice(0, 3);

    const cleanedFaq = source.faq
      .map((f) => ({ q: f.q.trim(), a: f.a.trim() }))
      .filter((f) => f.q && f.a);

    const salesDigits = normalizeWhatsAppPhone(source.salesWhatsApp);
    if (salesDigits.length < 10) {
      setError("WhatsApp de ventas: indica un número válido (mín. 10 dígitos).");
      return null;
    }

    return {
      heroTitle: source.heroTitle.trim(),
      heroSubtitle: source.heroSubtitle.trim(),
      contactBlurb: source.contactBlurb.trim(),
      socialProofLine: source.socialProofLine.trim(),
      salesWhatsApp: salesDigits,
      testimonials: cleanedTestimonials,
      faq: cleanedFaq.length > 0 ? cleanedFaq : DEFAULT_LANDING_FAQ,
      demoPosters: {
        restaurante: source.demoPosters.restaurante?.trim() || undefined,
        servicios: source.demoPosters.servicios?.trim() || undefined,
        tienda: source.demoPosters.tienda?.trim() || undefined,
      },
      comparisonImages: Object.fromEntries(
        COMPARISON_IMAGE_SLOTS.map((slot) => {
          const url = source.comparisonImages[slot]?.trim();
          return url ? [slot, url] : null;
        }).filter(Boolean) as [ComparisonImageSlot, string][],
      ),
    };
  }

  async function persistLandingContent(
    source: LandingContent,
  ): Promise<LandingContent | null> {
    const payload = buildLandingPayload(source);
    if (!payload) return null;
    const res = await fetch("/api/super-admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "landing_content",
        value: payload,
      }),
    });
    if (!res.ok) {
      setError("No se pudo guardar el CMS (¿migración 004 aplicada?)");
      return null;
    }
    setLanding(payload);
    return payload;
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);

    const payload = buildLandingPayload(landing);
    if (!payload) {
      setSaving(false);
      return;
    }

    const r1 = await fetch("/api/super-admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "plan_prices", value: prices }),
    });
    const r2 = await fetch("/api/super-admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "landing_content",
        value: payload,
      }),
    });
    const r3 = await fetch("/api/super-admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "spei_info",
        value: {
          bank: spei.bank.trim(),
          beneficiary: spei.beneficiary.trim(),
          clabe: spei.clabe.trim(),
          concept_hint: spei.concept_hint.trim(),
        },
      }),
    });
    setSaving(false);
    if (!r1.ok || !r2.ok || !r3.ok) {
      setError("No se pudo guardar (¿migración 004 aplicada?)");
      return;
    }
    setLanding(payload);
    setMessage("CMS, precios y SPEI guardados");
  }

  function setMonthly(plan: PlanType, monthly: number) {
    setPrices((p) => ({
      ...p,
      [plan]: { monthly, annual: monthly * 10 },
    }));
  }

  function updateTestimonial(
    index: number,
    patch: Partial<LandingTestimonial>,
  ) {
    setLanding((prev) => ({
      ...prev,
      testimonials: prev.testimonials.map((t, i) =>
        i === index ? { ...t, ...patch } : t,
      ),
    }));
  }

  function updateFaq(index: number, patch: Partial<LandingFaqItem>) {
    setLanding((prev) => ({
      ...prev,
      faq: prev.faq.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    }));
  }

  async function uploadPoster(giro: CanonicalDemoId, file: File | null) {
    if (!file) return;
    setUploadingGiro(giro);
    setError(null);
    try {
      const compressed = await compressImage(file, "banner");
      const previousUrl = landing.demoPosters[giro] ?? "";
      const form = new FormData();
      form.set("giro", giro);
      form.set("file", compressed);
      if (previousUrl) form.set("previousUrl", previousUrl);
      const res = await fetch("/api/super-admin/marketing-upload", {
        method: "POST",
        body: form,
      });
      setUploadingGiro(null);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "No se pudo subir la captura");
        return;
      }
      const data = (await res.json()) as { url: string };
      const next: LandingContent = {
        ...landing,
        demoPosters: { ...landing.demoPosters, [giro]: data.url },
      };
      setLanding(next);
      const saved = await persistLandingContent(next);
      setMessage(
        saved
          ? `Captura ${giro} subida y guardada`
          : `Captura ${giro} subida — pulsa Guardar`,
      );
    } catch (e) {
      setUploadingGiro(null);
      setError(e instanceof Error ? e.message : "Error al comprimir");
    }
  }

  async function clearPoster(giro: CanonicalDemoId) {
    const previousUrl = landing.demoPosters[giro];
    const next: LandingContent = {
      ...landing,
      demoPosters: { ...landing.demoPosters, [giro]: "" },
    };
    setLanding(next);
    if (previousUrl) {
      void fetch("/api/super-admin/marketing-upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: previousUrl }),
      });
    }
    const saved = await persistLandingContent(next);
    setMessage(
      saved
        ? `Captura ${giro} quitada y guardada`
        : `Captura ${giro} quitada — pulsa Guardar`,
    );
  }

  async function uploadCompare(slot: ComparisonImageSlot, file: File | null) {
    if (!file) return;
    setUploadingSlot(slot);
    setError(null);
    try {
      const compressed = await compressImage(file, "banner");
      const previousUrl = landing.comparisonImages[slot] ?? "";
      const form = new FormData();
      form.set("slot", slot);
      form.set("file", compressed);
      if (previousUrl) form.set("previousUrl", previousUrl);
      const res = await fetch("/api/super-admin/marketing-upload", {
        method: "POST",
        body: form,
      });
      setUploadingSlot(null);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "No se pudo subir la ilustración");
        return;
      }
      const data = (await res.json()) as { url: string };
      const next: LandingContent = {
        ...landing,
        comparisonImages: { ...landing.comparisonImages, [slot]: data.url },
      };
      setLanding(next);
      const saved = await persistLandingContent(next);
      setMessage(
        saved
          ? `${COMPARE_LABELS[slot]} subida y guardada`
          : `${COMPARE_LABELS[slot]} subida — pulsa Guardar`,
      );
    } catch (e) {
      setUploadingSlot(null);
      setError(e instanceof Error ? e.message : "Error al comprimir");
    }
  }

  async function clearCompare(slot: ComparisonImageSlot) {
    const previousUrl = landing.comparisonImages[slot];
    const nextImages = { ...landing.comparisonImages };
    delete nextImages[slot];
    const next: LandingContent = { ...landing, comparisonImages: nextImages };
    setLanding(next);
    if (previousUrl) {
      void fetch("/api/super-admin/marketing-upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: previousUrl }),
      });
    }
    const saved = await persistLandingContent(next);
    setMessage(
      saved
        ? `${COMPARE_LABELS[slot]} quitada y guardada`
        : `${COMPARE_LABELS[slot]} quitada — pulsa Guardar`,
    );
  }

  function renderSave() {
    return (
      <Button
        type="button"
        className="min-h-11 w-full"
        disabled={saving}
        onClick={() => void save()}
      >
        {saving ? (
          "Guardando…"
        ) : (
          <>
            <Emoji char={UI_EMOJI.save} />
            Guardar
          </>
        )}
      </Button>
    );
  }

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <div>
        <h1 className="text-xl font-semibold">
          <Emoji char={UI_EMOJI.cms} />
          CMS Landing y precios
        </h1>
        <p className="text-sm text-muted">
          Edita copy, testimonios, FAQ, capturas y precios sin redeploy.
        </p>
      </div>

      <LandingMetrics />

      <div className="mx-auto max-w-2xl space-y-3">
      <CmsFold title="Hero / contacto" defaultOpen>
        <div className="space-y-1.5">
          <Label htmlFor="sales-whatsapp">WhatsApp de ventas (landing)</Label>
          <Input
            id="sales-whatsapp"
            className="min-h-11"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+52 81 3094 7324"
            value={landing.salesWhatsApp}
            onChange={(e) =>
              setLanding((p) => ({ ...p, salesWhatsApp: e.target.value }))
            }
          />
          <p className="text-xs text-muted">
            Todos los CTAs de la landing (nav, FAB, precios, contacto) abren
            este número. Puedes pegar con +52; se guardan solo dígitos.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Título hero</Label>
          <Textarea
            className="min-h-[4.5rem]"
            value={landing.heroTitle}
            onChange={(e) =>
              setLanding((p) => ({ ...p, heroTitle: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Subtítulo</Label>
          <Textarea
            className="min-h-[4rem]"
            value={landing.heroSubtitle}
            onChange={(e) =>
              setLanding((p) => ({ ...p, heroSubtitle: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Línea de prueba social</Label>
          <Input
            className="min-h-11"
            value={landing.socialProofLine}
            onChange={(e) =>
              setLanding((p) => ({ ...p, socialProofLine: e.target.value }))
            }
            placeholder="Activamos negocios en Monterrey y CDMX"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Blurb contacto</Label>
          <Input
            className="min-h-11"
            value={landing.contactBlurb}
            onChange={(e) =>
              setLanding((p) => ({ ...p, contactBlurb: e.target.value }))
            }
          />
        </div>
      </CmsFold>

      <CmsFold title="Testimonios (0–3)">
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11"
            disabled={landing.testimonials.length >= 3}
            onClick={() =>
              setLanding((p) => ({
                ...p,
                testimonials: [...p.testimonials, emptyTestimonial()],
              }))
            }
          >
            Añadir
          </Button>
        </div>
        <p className="text-xs text-muted">
          Vacío → la landing muestra franja neutra sin cita inventada.
        </p>
        {landing.testimonials.length === 0 ? (
          <p className="text-sm text-muted">Sin testimonios todavía.</p>
        ) : null}
        {landing.testimonials.map((t, i) => (
          <div
            key={i}
            className="space-y-2 rounded-xl border border-black/5 bg-white/80 p-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted">
                Testimonio {i + 1}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setLanding((p) => ({
                    ...p,
                    testimonials: p.testimonials.filter((_, j) => j !== i),
                  }))
                }
              >
                Quitar
              </Button>
            </div>
            <Textarea
              placeholder="Cita"
              value={t.quote}
              onChange={(e) => updateTestimonial(i, { quote: e.target.value })}
            />
            <Input
              className="min-h-11"
              placeholder="Autor"
              value={t.author}
              onChange={(e) => updateTestimonial(i, { author: e.target.value })}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                className="min-h-11"
                placeholder="Rol / ciudad"
                value={t.role ?? ""}
                onChange={(e) => updateTestimonial(i, { role: e.target.value })}
              />
              <Input
                className="min-h-11"
                placeholder="Inicial avatar (L)"
                maxLength={1}
                value={t.initial ?? ""}
                onChange={(e) =>
                  updateTestimonial(i, { initial: e.target.value })
                }
              />
            </div>
          </div>
        ))}
      </CmsFold>

      <CmsFold title="FAQ">
        {landing.faq.map((f, i) => (
          <div
            key={i}
            className="space-y-2 rounded-xl border border-black/5 bg-white/80 p-3"
          >
            <Input
              className="min-h-11"
              placeholder="Pregunta"
              value={f.q}
              onChange={(e) => updateFaq(i, { q: e.target.value })}
            />
            <Textarea
              placeholder="Respuesta"
              value={f.a}
              onChange={(e) => updateFaq(i, { a: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setLanding((p) => ({
                  ...p,
                  faq: p.faq.filter((_, j) => j !== i),
                }))
              }
            >
              Quitar
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 w-full"
          onClick={() =>
            setLanding((p) => ({
              ...p,
              faq: [...p.faq, { q: "", a: "" }],
            }))
          }
        >
          Añadir pregunta
        </Button>
      </CmsFold>

      <CmsFold title="Comparación (ilustraciones)">
        <p className="text-xs text-muted">
          Opcional. Si no hay URL, la landing usa los SVG por defecto. Sube
          recortes WebP de tu arte (problema / solución por fila).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {COMPARISON_IMAGE_SLOTS.map((slot) => {
            const url = landing.comparisonImages[slot];
            const row = DEFAULT_COMPARISON_ROWS.find((r) =>
              slot.startsWith(r.id),
            );
            const fallback = slot.endsWith("problem")
              ? row?.defaultProblemArt
              : row?.defaultSolutionArt;
            return (
              <div
                key={slot}
                className="space-y-2 rounded-xl border border-black/5 bg-white/80 p-3"
              >
                <Label>{COMPARE_LABELS[slot]}</Label>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url || fallback}
                  alt=""
                  className="h-24 w-full rounded-lg object-cover"
                />
                <Input
                  className="min-h-11"
                  placeholder="https://…webp"
                  value={url ?? ""}
                  onChange={(e) =>
                    setLanding((p) => ({
                      ...p,
                      comparisonImages: {
                        ...p.comparisonImages,
                        [slot]: e.target.value,
                      },
                    }))
                  }
                />
                <input
                  ref={(el) => {
                    compareFileRefs.current[slot] = el;
                  }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) =>
                    void uploadCompare(slot, e.target.files?.[0] ?? null)
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11"
                    disabled={uploadingSlot === slot}
                    onClick={() => compareFileRefs.current[slot]?.click()}
                  >
                    {uploadingSlot === slot ? "Subiendo…" : "Subir"}
                  </Button>
                  {url ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11"
                      onClick={() => clearCompare(slot)}
                    >
                      Quitar
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </CmsFold>

      <CmsFold title="Capturas por giro">
        <p className="text-xs text-muted">
          Opcional. Al subir o quitar, se guarda solo en el CMS (sin pulsar
          Guardar). Si hay URL, el Product Stage de la landing la usa.
        </p>
        {GIROS.map(({ id, label }) => (
          <div
            key={id}
            className="space-y-2 rounded-xl border border-black/5 bg-white/80 p-3"
          >
            <Label>{label}</Label>
            {landing.demoPosters[id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={landing.demoPosters[id]}
                alt=""
                className="h-28 w-full rounded-lg object-cover"
              />
            ) : null}
            <Input
              className="min-h-11"
              placeholder="https://…webp"
              value={landing.demoPosters[id] ?? ""}
              onChange={(e) =>
                setLanding((p) => ({
                  ...p,
                  demoPosters: {
                    ...p.demoPosters,
                    [id]: e.target.value,
                  },
                }))
              }
            />
            <input
              ref={(el) => {
                fileRefs.current[id] = el;
              }}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) =>
                void uploadPoster(id, e.target.files?.[0] ?? null)
              }
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="min-h-11"
                disabled={uploadingGiro === id}
                onClick={() => fileRefs.current[id]?.click()}
              >
                {uploadingGiro === id ? "Subiendo…" : "Subir captura"}
              </Button>
              {landing.demoPosters[id] ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11"
                  onClick={() => clearPoster(id)}
                >
                  Quitar
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </CmsFold>

      <CmsFold title="Datos SPEI (suscripción)">
        <p className="text-xs text-muted">
          Se muestran a tenants en Ajustes → Suscripción.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Banco</Label>
            <Input
              value={spei.bank}
              onChange={(e) => setSpei((s) => ({ ...s, bank: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Beneficiario</Label>
            <Input
              value={spei.beneficiary}
              onChange={(e) =>
                setSpei((s) => ({ ...s, beneficiary: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>CLABE</Label>
            <Input
              value={spei.clabe}
              onChange={(e) => setSpei((s) => ({ ...s, clabe: e.target.value }))}
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Hint de concepto</Label>
            <Input
              value={spei.concept_hint}
              onChange={(e) =>
                setSpei((s) => ({ ...s, concept_hint: e.target.value }))
              }
            />
          </div>
        </div>
      </CmsFold>

      <CmsFold title="Precios mensuales (MXN)">
        {(["catalog", "daily", "pro"] as PlanType[]).map((plan) => (
          <div key={plan} className="flex items-center gap-3">
            <Label className="w-24 capitalize">{plan}</Label>
            <Input
              className="min-h-11"
              inputMode="numeric"
              value={String(prices[plan].monthly)}
              onChange={(e) => setMonthly(plan, Number(e.target.value) || 0)}
            />
          </div>
        ))}
      </CmsFold>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      <div className="hidden md:block">{renderSave()}</div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        {renderSave()}
      </div>
    </div>
  );
}
