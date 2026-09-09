"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  AiImageGenerator,
  fileToReferencePayload,
  probeImageAspectFromBase64,
  urlToReferencePayload,
  type FlyerCompositionPayload,
} from "@/components/admin/ai-image-generator";
import { FlyerDishPicker } from "@/components/admin/flyer-dish-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { labelsFor } from "@/lib/business-labels";
import {
  aspectRatioToFlyerAspect,
  defaultMarketingOpts,
  FLYER_COPY_ITEM_HARD_WARN,
  FLYER_COPY_ITEM_SOFT_MAX,
  layoutPresetLabel,
  layoutPresetsForBusinessType,
  mapAiLayoutToStudioLayout,
  nearestFlyerAspectRatio,
  similarityBand,
  similarityBandLabel,
  type FlyerAiAspectRatio,
  type FlyerLayoutPreset,
  type FlyerMarketingOpts,
  type ProductImageSource,
} from "@/lib/flyer-ai-prompt";
import type { FlyerEditorOptions } from "@/lib/flyer-types";
import { offersPublicDelivery } from "@/lib/fulfillment";
import {
  formatWhatsappDisplay,
  socialHandleFromUrl,
} from "@/lib/flyer-types";
import type { Dish } from "@/lib/types";
import { cn } from "@/lib/utils";

export type FlyerAiMode = "menu" | "business" | "free";

export type FlyerOverlayPatch = Partial<FlyerEditorOptions> & {
  selectedDishIds?: string[];
  layoutPreset?: FlyerLayoutPreset;
  productImageSource?: ProductImageSource;
};

type CategoryLite = { id: string; name: string; sort_order: number };

type LibraryMini = {
  id: string;
  title: string;
  headline?: string;
  png_path: string | null;
};

type CopyReviewItem = {
  id: string;
  name: string;
  price: number;
  photoUrl: string | null;
  category: string | null;
  isSide: boolean;
};

type Props = {
  restaurant: {
    id: string;
    slug: string;
    name: string;
    slogan?: string | null;
    business_type?: string | null;
    logo_url?: string | null;
    phone_whatsapp?: string | null;
    instagram_url?: string | null;
    facebook_url?: string | null;
    free_shipping?: boolean;
    shipping_cost?: number;
    offers_delivery?: boolean;
  };
  dishes: Dish[];
  categories: CategoryLite[];
  todayPreselectedIds?: string[];
  menuPublicUrl?: string;
  initialReferenceUrl?: string | null;
  aspectRatio?: FlyerAiAspectRatio;
  onAspectRatioChange?: (ratio: FlyerAiAspectRatio) => void;
  onApplyBackground?: (url: string) => void;
  onApplyOverlays?: (patch: FlyerOverlayPatch) => void;
  onQuotaChange?: (quota: { remaining: number; total: number }) => void;
};

const ASPECTS: { id: FlyerAiAspectRatio; label: string; hint: string }[] = [
  { id: "4:5", label: "Feed 4:5", hint: "WhatsApp / Instagram feed" },
  { id: "9:16", label: "Stories 9:16", hint: "Stories / Reels" },
  { id: "1:1", label: "Cuadrado 1:1", hint: "Feed cuadrado" },
];

const PRODUCT_SOURCES: {
  id: ProductImageSource;
  labelKey: "real" | "ai" | "none";
}[] = [
  { id: "real_catalog", labelKey: "real" },
  { id: "ai_generated", labelKey: "ai" },
  { id: "none_text_only", labelKey: "none" },
];

function productSourceLabel(
  key: "real" | "ai" | "none",
  giro: ReturnType<typeof labelsFor>,
): { label: string; hint: string } {
  if (key === "real") {
    return {
      label: `Fotos del ${giro.catalog.toLowerCase()}`,
      hint: `Integra photo_url reales en el flyer terminado`,
    };
  }
  if (key === "ai") {
    return {
      label: "Fotos generadas por IA",
      hint: `${giro.dishes} fotorrealistas pintados en el anuncio`,
    };
  }
  return {
    label: "Solo texto / gráficos",
    hint: "Flyer tipográfico sin fotos de producto",
  };
}

export function FlyerAiPanel({
  restaurant,
  dishes,
  categories,
  todayPreselectedIds,
  menuPublicUrl,
  initialReferenceUrl,
  aspectRatio: controlledAspect,
  onAspectRatioChange,
  onApplyBackground,
  onApplyOverlays,
  onQuotaChange,
}: Props) {
  const giro = labelsFor(restaurant.business_type);
  const initialIds = todayPreselectedIds ?? [];
  const phone = formatWhatsappDisplay(restaurant.phone_whatsapp);
  const hasWa = Boolean(phone);
  const hasIg = Boolean(socialHandleFromUrl(restaurant.instagram_url));
  const hasFb = Boolean(socialHandleFromUrl(restaurant.facebook_url));
  const hasLogo = Boolean(restaurant.logo_url);
  const hasSlogan = Boolean((restaurant.slogan ?? "").trim());
  const hasQr = Boolean(menuPublicUrl);
  const hasShip =
    offersPublicDelivery(restaurant) &&
    (Boolean(restaurant.free_shipping) ||
      Number(restaurant.shipping_cost) === 0);

  const modes = useMemo(
    () =>
      [
        {
          id: "menu" as const,
          label: giro.dailyMenu,
          hint: `Destaca ${giro.dishes.toLowerCase()} concretos`,
        },
        {
          id: "business" as const,
          label: giro.business,
          hint: "Identidad y atmósfera de marca",
        },
        {
          id: "free" as const,
          label: "Libre",
          hint: "Prompt abierto para redes",
        },
      ] as const,
    [giro],
  );

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<FlyerAiMode>(() =>
    initialIds.length > 0 ? "menu" : "business",
  );
  const [title, setTitle] = useState("Especial de hoy");
  const [prompt, setPrompt] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(() => initialIds);
  const [productImageSource, setProductImageSource] =
    useState<ProductImageSource>("real_catalog");
  const [internalAspect, setInternalAspect] =
    useState<FlyerAiAspectRatio>("4:5");
  const aspectRatio = controlledAspect ?? internalAspect;
  const setAspectRatio = (r: FlyerAiAspectRatio) => {
    setInternalAspect(r);
    onAspectRatioChange?.(r);
  };

  const orderedPresets = useMemo(
    () => layoutPresetsForBusinessType(restaurant.business_type),
    [restaurant.business_type],
  );
  const [layoutPreset, setLayoutPreset] = useState<FlyerLayoutPreset>(
    () => orderedPresets[0] ?? "hero_star_product",
  );
  const [followReferenceLayout, setFollowReferenceLayout] = useState(false);
  const [similarity, setSimilarity] = useState(40);
  const [generatingBusy, setGeneratingBusy] = useState(false);
  const [reviewName, setReviewName] = useState(restaurant.name);
  const [copyItems, setCopyItems] = useState<CopyReviewItem[]>([]);
  const [marketing, setMarketing] = useState<FlyerMarketingOpts>(() =>
    defaultMarketingOpts({
      includeLogo: hasLogo,
      includeSlogan: hasSlogan,
      includeWhatsapp: hasWa,
      includePhoneWhatsapp: hasWa,
      includeInstagram: false,
      includeFacebook: false,
      includeQr: false,
      includeFreeShipping: hasShip,
      includeIncludesTag: restaurant.business_type === "restaurante",
      includeUnitTag: restaurant.business_type === "productos",
    }),
  );

  const [library, setLibrary] = useState<LibraryMini[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [referenceLabel, setReferenceLabel] = useState<string | null>(null);
  const [referencePayload, setReferencePayload] = useState<{
    referenceBase64: string;
    referenceMime: string;
  } | null>(null);
  const [referencePreviewUrl, setReferencePreviewUrl] = useState<string | null>(
    null,
  );

  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [refBusy, setRefBusy] = useState(false);
  const prevSelectedCount = useRef(initialIds.length);
  const lastInitialRef = useRef<string | null>(null);

  const activeDishes = useMemo(
    () => dishes.filter((d) => selectedIds.includes(d.id)),
    [dishes, selectedIds],
  );

  const photoStats = useMemo(() => {
    const withPhoto = activeDishes.filter((d) => Boolean(d.photo_url));
    const without = activeDishes.filter((d) => !d.photo_url);
    return { withPhoto, without };
  }, [activeDishes]);

  const band = similarityBand(similarity);

  const todayIds = todayPreselectedIds ?? [];
  const todayCount = todayIds.length;

  const marketingToggleCount = useMemo(() => {
    const m = marketing;
    return [
      m.includeLogo,
      m.includeName,
      m.includeSlogan,
      m.includeWhatsapp,
      m.includeInstagram,
      m.includeFacebook,
      m.includeQr,
      m.includeDishNames,
      m.includeCategories,
      m.includePrices,
      m.includeEmojis,
      m.includeFreeShipping,
      m.includeIncludesTag,
      m.includeUnitTag,
      m.includeDayTag,
      m.includeDecorativeElements,
    ].filter(Boolean).length;
  }, [marketing]);

  const clarityAlerts = useMemo(() => {
    const alerts: string[] = [];
    const n = mode === "menu" ? selectedIds.length : 0;
    if (n > FLYER_COPY_ITEM_HARD_WARN) {
      alerts.push(
        `Con ${n} ${giro.dishes.toLowerCase()} la IA suele saturar y deformar texto. Prioriza protagonistas.`,
      );
    } else if (n > FLYER_COPY_ITEM_SOFT_MAX) {
      alerts.push(
        `Más de ${FLYER_COPY_ITEM_SOFT_MAX} ${giro.dishes.toLowerCase()} satura el flyer; elige los protagonistas.`,
      );
    }
    if (
      mode === "menu" &&
      productImageSource === "real_catalog" &&
      photoStats.without.length >= 2
    ) {
      alerts.push(
        `${photoStats.without.length} sin foto: la IA inventará esas imágenes.`,
      );
    }
    if (marketingToggleCount >= 8) {
      alerts.push(
        "Muchos elementos de crédito a la vez; apaga los menos importantes.",
      );
    }
    return alerts;
  }, [
    mode,
    selectedIds.length,
    giro.dishes,
    productImageSource,
    photoStats.without.length,
    marketingToggleCount,
  ]);

  useEffect(() => {
    setCopyItems(
      dishes
        .filter((d) => selectedIds.includes(d.id))
        .map((d) => {
          const category =
            categories.find((c) => c.id === d.category_id)?.name ?? null;
          const catLooksLikeSide =
            Boolean(category) &&
            category!.trim().toLowerCase() === giro.sides.toLowerCase();
          return {
            id: d.id,
            name: d.name,
            price: Number(d.price) || 0,
            photoUrl: d.photo_url,
            category,
            isSide: Boolean(d.is_side) || catLooksLikeSide,
          };
        }),
    );
  }, [dishes, selectedIds, categories, giro.sides]);

  async function applyAspectFromReferencePayload(payload: {
    referenceBase64: string;
    referenceMime: string;
  }) {
    const dims = await probeImageAspectFromBase64(
      payload.referenceBase64,
      payload.referenceMime,
    );
    if (!dims) return;
    const next = nearestFlyerAspectRatio(dims.width, dims.height);
    setAspectRatio(next);
    return next;
  }

  function enableFollowReference() {
    if (!referencePayload) {
      toast.error("Primero elige o sube una imagen de referencia");
      return;
    }
    setFollowReferenceLayout(true);
    setSimilarity(85);
    void applyAspectFromReferencePayload(referencePayload).then((ar) => {
      toast.success(
        ar
          ? `Estructura de referencia · formato ${ar}`
          : "Estructura de referencia activada",
      );
    });
  }

  function selectClassicLayout(p: FlyerLayoutPreset) {
    setFollowReferenceLayout(false);
    setLayoutPreset(p);
  }

  function useTodaySpecials() {
    if (todayCount === 0) {
      toast.message(`Sin ${giro.dailyMenu.toLowerCase()} definido`, {
        description: "Configúralo en la pestaña Hoy del admin.",
      });
      return;
    }
    setMode("menu");
    setSelectedIds([...todayIds]);
    if (!title.trim() || title === "Especial de hoy") {
      setTitle("Especial de hoy");
    }
    toast.success(
      `${todayCount} ${giro.dishes.toLowerCase()} de hoy cargados`,
    );
  }

  useEffect(() => {
    const prev = prevSelectedCount.current;
    prevSelectedCount.current = selectedIds.length;
    if (mode === "menu" && prev > 0 && selectedIds.length === 0) {
      setMode("business");
      toast.message(`Sin ${giro.dishes.toLowerCase()} seleccionados`, {
        description: `Cambié a modo ${giro.business}. Puedes volver cuando elijas ítems.`,
      });
    }
  }, [mode, selectedIds.length, giro.dishes, giro.business]);

  useEffect(() => {
    let cancelled = false;
    async function loadLib() {
      setLibLoading(true);
      try {
        const res = await fetch("/api/admin/flyers");
        const json = (await res.json()) as {
          flyers?: LibraryMini[];
        };
        if (!cancelled && res.ok) {
          setLibrary((json.flyers ?? []).filter((f) => f.png_path));
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLibLoading(false);
      }
    }
    void loadLib();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialReferenceUrl) return;
    if (lastInitialRef.current === initialReferenceUrl) return;
    lastInitialRef.current = initialReferenceUrl;
    void (async () => {
      setRefBusy(true);
      try {
        const payload = await urlToReferencePayload(initialReferenceUrl);
        if (!payload) return;
        setReferencePayload(payload);
        setReferenceLabel("Desde biblioteca");
        setReferencePreviewUrl(initialReferenceUrl);
        setStep(2);
        toast.success("Referencia cargada desde la biblioteca");
      } finally {
        setRefBusy(false);
      }
    })();
  }, [initialReferenceUrl]);

  function patchMarketing(partial: Partial<FlyerMarketingOpts>) {
    setMarketing((m) => ({ ...m, ...partial }));
  }

  function clearReference() {
    setReferencePayload(null);
    setReferenceLabel(null);
    setReferencePreviewUrl(null);
    setFollowReferenceLayout(false);
  }

  async function pickLibraryRef(f: LibraryMini) {
    if (!f.png_path) return;
    setRefBusy(true);
    try {
      const payload = await urlToReferencePayload(f.png_path);
      if (!payload) return;
      setReferencePayload(payload);
      setReferenceLabel(f.headline || f.title || "Biblioteca");
      setReferencePreviewUrl(f.png_path);
      if (followReferenceLayout) {
        setSimilarity(85);
        await applyAspectFromReferencePayload(payload);
      }
      toast.success("Referencia desde biblioteca");
    } finally {
      setRefBusy(false);
    }
  }

  async function onUploadReference(file: File | null) {
    if (!file) {
      clearReference();
      return;
    }
    setRefBusy(true);
    try {
      const payload = await fileToReferencePayload(file);
      if (!payload) return;
      const preview = URL.createObjectURL(file);
      setReferencePayload(payload);
      setReferenceLabel(file.name);
      setReferencePreviewUrl(preview);
      if (followReferenceLayout) {
        setSimilarity(85);
        await applyAspectFromReferencePayload(payload);
      }
      toast.success("Referencia lista");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo leer la imagen");
    } finally {
      setRefBusy(false);
    }
  }

  function buildOverlayPatch(): FlyerOverlayPatch {
    return {
      aspect: aspectRatioToFlyerAspect(aspectRatio),
      headline: title.trim() || "ESPECIALES DE HOY",
      subtitle: marketing.includeSlogan ? restaurant.slogan ?? "" : "",
      layout: mapAiLayoutToStudioLayout(layoutPreset, productImageSource),
      showWhatsapp: marketing.includeWhatsapp && hasWa,
      showInstagram: marketing.includeInstagram && hasIg,
      showFacebook: marketing.includeFacebook && hasFb,
      showMenuQr: marketing.includeQr && hasQr,
      showFreeShipping: marketing.includeFreeShipping && hasShip,
      logoScale: marketing.includeLogo && hasLogo ? "md" : "off",
      contrastScrim: true,
      selectedDishIds: selectedIds,
      layoutPreset,
      productImageSource,
    };
  }

  async function saveRawToGallery(url: string) {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("flyers").insert({
        restaurant_id: restaurant.id,
        title: title.trim() || "Flyer IA",
        subtitle: "",
        headline: title.trim() || "Flyer IA",
        weekday_label: "",
        aspect: aspectRatioToFlyerAspect(aspectRatio),
        price_mode: "package",
        package_price: null,
        png_path: url,
        source: "ai",
      });
      if (error) throw new Error(error.message);
      setLastUrl(url);
      toast.success("Flyer guardado en galería — listo para redes");
      void fetch("/api/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: restaurant.slug }),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  function applyAsStudioBackground(url: string) {
    onApplyOverlays?.(buildOverlayPatch());
    onApplyBackground?.(url);
    toast.success("Aplicado al estudio (avanzado)", {
      description:
        "Puedes añadir QR exacto u overlays y guardar el compuesto.",
    });
  }

  async function suggestPrompt() {
    setSuggesting(true);
    try {
      const res = await fetch("/api/admin/ai/suggest-flyer-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          dishNames: activeDishes.map((d) => d.name),
          restaurantName: restaurant.name,
          slogan: restaurant.slogan ?? "",
          businessType: restaurant.business_type ?? "restaurante",
          title: title.trim(),
          marketing,
          layoutPreset,
          productImageSource,
          similarity,
          aspectRatio,
          ...(referencePayload ?? {}),
        }),
      });
      const json = (await res.json()) as { prompt?: string; message?: string };
      if (!res.ok) {
        toast.error(json.message || "No se pudo sugerir");
        return;
      }
      if (!json.prompt?.trim()) {
        toast.error("Respuesta vacía");
        return;
      }
      setPrompt(json.prompt.trim());
      toast.success("Prompt sugerido");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al sugerir");
    } finally {
      setSuggesting(false);
    }
  }

  const composition: FlyerCompositionPayload = {
    mode,
    dishNames: copyItems.map((d) => d.name),
    items: copyItems.map((d) => ({
      name: d.name,
      price: d.price,
      category: d.category,
      photoUrl: d.photoUrl,
      isSide: d.isSide,
    })),
    title: title.trim(),
    restaurantName: reviewName.trim() || restaurant.name,
    slogan: restaurant.slogan ?? "",
    businessType: restaurant.business_type,
    marketing,
    layoutPreset,
    productImageSource,
    similarity: followReferenceLayout ? Math.max(similarity, 75) : similarity,
    aspectRatio,
    finishedAsset: true,
    followReferenceLayout,
  };

  function Toggle({
    label,
    checked,
    disabled,
    onChange,
    hint,
  }: {
    label: string;
    checked: boolean;
    disabled?: boolean;
    onChange: (v: boolean) => void;
    hint?: string;
  }) {
    return (
      <div className="flex min-h-10 items-center justify-between gap-3">
        <div className="min-w-0">
          <span className={cn("text-sm", disabled && "text-muted")}>{label}</span>
          {hint && disabled ? (
            <p className="text-[11px] text-muted">{hint}</p>
          ) : null}
        </div>
        <Switch
          checked={checked && !disabled}
          disabled={disabled}
          onCheckedChange={onChange}
        />
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-4 rounded-2xl border border-black/10 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Flyer con IA</h2>
          <p className="text-xs text-muted">
            Wizard en 3 pasos · genera un anuncio completo listo para WhatsApp /
            Instagram ({giro.business}).
          </p>
        </div>
        <div className="flex gap-1">
          {([1, 2, 3] as const).map((s) => (
            <button
              key={s}
              type="button"
              disabled={generatingBusy}
              onClick={() => setStep(s)}
              className={cn(
                "h-8 w-8 rounded-full text-xs font-semibold",
                step === s
                  ? "bg-brand text-white"
                  : "border border-black/10 bg-white text-muted",
                generatingBusy && "opacity-50",
              )}
              aria-label={`Paso ${s}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs font-medium text-brand-dark">
        {step === 1
          ? "Paso 1 · Qué anuncias y formato"
          : step === 2
            ? "Paso 2 · Estructura y referencia"
            : "Paso 3 · Contenido, matiz opcional y generar"}
      </p>

      {step === 1 ? (
        <div className="space-y-4">
          {clarityAlerts.length > 0 ? (
            <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-950">
              {clarityAlerts.map((a) => (
                <p key={a}>{a}</p>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={todayCount === 0}
              onClick={useTodaySpecials}
            >
              Usar {giro.dailyMenu.toLowerCase()} de hoy
              {todayCount > 0 ? ` (${todayCount})` : ""}
            </Button>
            {todayCount === 0 ? (
              <a
                href="/admin"
                className="text-[11px] font-semibold text-brand underline-offset-2 hover:underline"
              >
                Definir en Hoy
              </a>
            ) : (
              <span className="text-[11px] text-muted">
                Carga platillos y precios de la pestaña Hoy
              </span>
            )}
          </div>

          <div className="space-y-2">
            <Label>Modo</Label>
            <div className="flex flex-wrap gap-2">
              {modes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium",
                    mode === m.id
                      ? "bg-brand text-white"
                      : "border border-black/10 bg-white",
                  )}
                  title={m.hint}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">
              {modes.find((m) => m.id === mode)?.hint}
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="flyer-ai-title">Título</Label>
            <Input
              id="flyer-ai-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {mode === "menu" ? (
            <FlyerDishPicker
              dishes={dishes}
              categories={categories}
              selectedIds={selectedIds}
              onChange={setSelectedIds}
              businessType={restaurant.business_type}
              label={`${giro.dishes} a destacar`}
            />
          ) : null}

          {mode === "menu" && productImageSource === "real_catalog" ? (
            <div className="space-y-1.5">
              <p className="text-xs text-muted">
                {photoStats.withPhoto.length} con foto real ·{" "}
                {photoStats.without.length} por IA / placeholder
              </p>
              {photoStats.without.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {photoStats.without.map((d) => (
                    <span
                      key={d.id}
                      className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-900"
                    >
                      Sin foto: {d.name} → IA
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Fotos de producto</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {PRODUCT_SOURCES.map((s) => {
                const meta = productSourceLabel(s.labelKey, giro);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setProductImageSource(s.id)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-left transition-colors",
                      productImageSource === s.id
                        ? "border-brand bg-brand/10"
                        : "border-black/10 bg-white",
                    )}
                  >
                    <span className="block text-sm font-semibold">
                      {meta.label}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {meta.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Formato</Label>
            {followReferenceLayout ? (
              <p className="text-[11px] text-muted">
                Bloqueado a {aspectRatio} por la imagen de referencia (layout
                “Como la referencia”).
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {ASPECTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={followReferenceLayout}
                  onClick={() => setAspectRatio(a.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium",
                    aspectRatio === a.id
                      ? "bg-brand text-white"
                      : "border border-black/10 bg-white",
                    followReferenceLayout && "opacity-60",
                  )}
                  title={a.hint}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              disabled={generatingBusy}
              onClick={() => setStep(2)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Referencia (biblioteca o subir)</Label>
            {libLoading ? (
              <p className="text-xs text-muted">Cargando biblioteca…</p>
            ) : library.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {library.slice(0, 12).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    disabled={refBusy || !f.png_path}
                    onClick={() => void pickLibraryRef(f)}
                    className={cn(
                      "overflow-hidden rounded-lg border aspect-[4/5]",
                      referencePreviewUrl === f.png_path
                        ? "border-brand ring-2 ring-brand/40"
                        : "border-black/10",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.png_path!}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">
                Aún no hay flyers en biblioteca. Puedes subir una referencia.
              </p>
            )}
            <Input
              type="file"
              accept="image/*"
              disabled={refBusy}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                void onUploadReference(f);
                e.target.value = "";
              }}
            />
            {referenceLabel ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                {referencePreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={referencePreviewUrl}
                    alt=""
                    className="h-12 w-10 rounded object-cover"
                  />
                ) : null}
                <span>Referencia: {referenceLabel}</span>
                <button
                  type="button"
                  className="font-semibold text-brand"
                  onClick={clearReference}
                >
                  Quitar
                </button>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Layout</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={!referencePayload}
                onClick={enableFollowReference}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left sm:col-span-2",
                  followReferenceLayout
                    ? "border-brand bg-brand/10"
                    : "border-black/10 bg-white",
                  !referencePayload && "opacity-60",
                )}
              >
                <span className="block text-sm font-semibold">
                  Como la referencia
                </span>
                <span className="block text-[11px] text-muted">
                  {referencePayload
                    ? "Misma estructura/plantilla; el formato se iguala a la imagen"
                    : "Sube o elige una referencia para activar esta opción"}
                </span>
              </button>
              {orderedPresets.map((p) => {
                const meta = layoutPresetLabel(p, restaurant.business_type);
                const selected = !followReferenceLayout && layoutPreset === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => selectClassicLayout(p)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-left",
                      selected
                        ? "border-brand bg-brand/10"
                        : "border-black/10 bg-white",
                    )}
                  >
                    <span className="block text-sm font-semibold">
                      {meta.title}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {meta.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="flyer-sim">Similitud a la referencia</Label>
              <span className="text-xs font-medium text-brand-dark">
                {similarity} · {similarityBandLabel(band)}
              </span>
            </div>
            <input
              id="flyer-sim"
              type="range"
              min={followReferenceLayout ? 71 : 0}
              max={100}
              value={similarity}
              onChange={(e) => setSimilarity(Number(e.target.value))}
              className="w-full accent-[var(--brand,#c45c26)]"
              disabled={!referencePayload || followReferenceLayout}
            />
            <div className="flex justify-between text-[11px] text-muted">
              <span>Inspiración</span>
              <span>Estructura</span>
              <span>Plantilla</span>
            </div>
            {followReferenceLayout ? (
              <p className="text-[11px] text-muted">
                Anclada a plantilla (~85) mientras uses “Como la referencia”.
              </p>
            ) : !referencePayload ? (
              <p className="text-[11px] text-muted">
                Elige o sube una referencia para usar el semáforo de similitud.
              </p>
            ) : null}
          </div>

          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={generatingBusy}
              onClick={() => setStep(1)}
            >
              Atrás
            </Button>
            <Button
              type="button"
              disabled={generatingBusy}
              onClick={() => setStep(3)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          {clarityAlerts.length > 0 ? (
            <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-950">
              {clarityAlerts.map((a) => (
                <p key={a}>{a}</p>
              ))}
            </div>
          ) : null}

          <div className="space-y-3 rounded-xl border border-black/10 bg-white/80 p-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Revisar texto
              </p>
              <p className="text-[11px] text-muted">
                Así se pedirá el copy a la IA. Revisa ortografía; el modelo a
                veces deforma letras al pintarlas. No modifica tu catálogo.
              </p>
            </div>
            {marketing.includeName ? (
              <div className="space-y-1">
                <Label htmlFor="review-name">Nombre del negocio</Label>
                <Input
                  id="review-name"
                  value={reviewName}
                  disabled={generatingBusy}
                  onChange={(e) => setReviewName(e.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="review-title">Título / headline</Label>
              <Input
                id="review-title"
                value={title}
                disabled={generatingBusy}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            {mode === "menu" && copyItems.length > 0 ? (
              <div className="space-y-3">
                {(() => {
                  const mains = copyItems.filter((it) => !it.isSide);
                  const sides = copyItems.filter((it) => it.isSide);
                  const renderRow = (it: CopyReviewItem, showPrice: boolean) => (
                    <div
                      key={it.id}
                      className="grid grid-cols-[1fr_5.5rem] gap-2"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <Input
                          value={it.name}
                          disabled={generatingBusy}
                          onChange={(e) =>
                            setCopyItems((rows) =>
                              rows.map((r) =>
                                r.id === it.id
                                  ? { ...r, name: e.target.value }
                                  : r,
                              ),
                            )
                          }
                        />
                        {it.category ? (
                          <p className="truncate text-[10px] text-muted">
                            {it.category}
                          </p>
                        ) : null}
                      </div>
                      {showPrice ? (
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={Number.isFinite(it.price) ? it.price : ""}
                          disabled={
                            generatingBusy || !marketing.includePrices
                          }
                          onChange={(e) =>
                            setCopyItems((rows) =>
                              rows.map((r) =>
                                r.id === it.id
                                  ? {
                                      ...r,
                                      price: Number(e.target.value) || 0,
                                    }
                                  : r,
                              ),
                            )
                          }
                        />
                      ) : (
                        <span className="flex items-center justify-end text-[11px] text-muted">
                          Incluye
                        </span>
                      )}
                    </div>
                  );
                  return (
                    <>
                      {mains.length > 0 ? (
                        <div className="space-y-2">
                          <Label>
                            {giro.dishes}
                            {marketing.includePrices ? " y precios" : ""}
                          </Label>
                          {mains.map((it) => renderRow(it, true))}
                        </div>
                      ) : null}
                      {sides.length > 0 ? (
                        <div className="space-y-2">
                          <Label>{giro.sides}</Label>
                          <p className="text-[11px] text-muted">
                            Se pedirán en sección aparte (no como platillos
                            principales).
                          </p>
                          {sides.map((it) => renderRow(it, false))}
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            ) : null}
            <div className="space-y-0.5 text-[11px] text-muted">
              {marketing.includeWhatsapp && hasWa ? (
                <p>WhatsApp: {phone}</p>
              ) : null}
              {marketing.includeInstagram && hasIg ? (
                <p>Instagram: {socialHandleFromUrl(restaurant.instagram_url)}</p>
              ) : null}
              {marketing.includeFacebook && hasFb ? (
                <p>Facebook: {socialHandleFromUrl(restaurant.facebook_url)}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-black/5 bg-white/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Contenido del anuncio
            </p>
            <Toggle
              label="Logo"
              checked={marketing.includeLogo}
              disabled={!hasLogo}
              hint="Sube logo en Ajustes"
              onChange={(v) => patchMarketing({ includeLogo: v })}
            />
            <Toggle
              label="Nombre del negocio"
              checked={marketing.includeName}
              onChange={(v) => patchMarketing({ includeName: v })}
            />
            <Toggle
              label="Slogan"
              checked={marketing.includeSlogan}
              disabled={!hasSlogan}
              hint="Agrega slogan en Ajustes"
              onChange={(v) => patchMarketing({ includeSlogan: v })}
            />
            <Toggle
              label="WhatsApp / teléfono"
              checked={marketing.includeWhatsapp}
              disabled={!hasWa}
              hint="Configura WA en Ajustes"
              onChange={(v) =>
                patchMarketing({
                  includeWhatsapp: v,
                  includePhoneWhatsapp: v,
                })
              }
            />
            <Toggle
              label="Instagram"
              checked={marketing.includeInstagram}
              disabled={!hasIg}
              hint="Agrega IG en Ajustes"
              onChange={(v) => patchMarketing({ includeInstagram: v })}
            />
            <Toggle
              label="Facebook"
              checked={marketing.includeFacebook}
              disabled={!hasFb}
              hint="Agrega FB en Ajustes"
              onChange={(v) => patchMarketing({ includeFacebook: v })}
            />
            <Toggle
              label="QR al menú"
              checked={marketing.includeQr}
              disabled={!hasQr}
              onChange={(v) => patchMarketing({ includeQr: v })}
            />
            <Toggle
              label={`Nombres de ${giro.dishes.toLowerCase()}`}
              checked={marketing.includeDishNames}
              onChange={(v) => patchMarketing({ includeDishNames: v })}
            />
            <Toggle
              label={giro.categories}
              checked={marketing.includeCategories}
              onChange={(v) => patchMarketing({ includeCategories: v })}
            />
            <Toggle
              label="Precios"
              checked={marketing.includePrices}
              onChange={(v) =>
                patchMarketing({
                  includePrices: v,
                  includePriceBadges: v,
                })
              }
            />
            <Toggle
              label="Emojis"
              checked={marketing.includeEmojis}
              onChange={(v) => patchMarketing({ includeEmojis: v })}
            />
            <Toggle
              label="Envío gratis"
              checked={marketing.includeFreeShipping}
              disabled={!hasShip}
              hint="Activa envío gratis en Ajustes"
              onChange={(v) => patchMarketing({ includeFreeShipping: v })}
            />
            {restaurant.business_type === "restaurante" ||
            !restaurant.business_type ? (
              <Toggle
                label="Incluye (tortillas, etc.)"
                checked={marketing.includeIncludesTag}
                onChange={(v) => patchMarketing({ includeIncludesTag: v })}
              />
            ) : null}
            {restaurant.business_type === "productos" ? (
              <Toggle
                label="Por pieza / Kg"
                checked={marketing.includeUnitTag}
                onChange={(v) => patchMarketing({ includeUnitTag: v })}
              />
            ) : null}
            <Toggle
              label="Etiqueta del día"
              checked={marketing.includeDayTag}
              onChange={(v) => patchMarketing({ includeDayTag: v })}
            />
            <Toggle
              label="Elementos decorativos"
              checked={marketing.includeDecorativeElements}
              onChange={(v) =>
                patchMarketing({ includeDecorativeElements: v })
              }
            />
          </div>

          <AiImageGenerator
            restaurantId={restaurant.id}
            imageKind="flyer"
            defaultPreset="flyer"
            slim
            composition={composition}
            externalReference={referencePayload}
            prompt={prompt}
            onPromptChange={setPrompt}
            applyLabel={saving ? "Guardando…" : "Guardar en galería"}
            downloadLabel="Descargar flyer"
            onApplied={(url) => void saveRawToGallery(url)}
            onApplyBackground={applyAsStudioBackground}
            applyBackgroundLabel="Usar como fondo del estudio (+ QR exacto)"
            advancedStudioCollapsed
            onQuotaChange={onQuotaChange}
            onBusyChange={setGeneratingBusy}
            extraActions={
              <Button
                type="button"
                variant="outline"
                disabled={suggesting || generatingBusy}
                onClick={() => void suggestPrompt()}
              >
                {suggesting ? "Sugiriendo…" : "Sugerir dirección creativa"}
              </Button>
            }
          />

          {lastUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href="/admin/flyers">Ver galería</a>
            </Button>
          ) : null}

          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={generatingBusy}
              onClick={() => setStep(2)}
            >
              Atrás
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
