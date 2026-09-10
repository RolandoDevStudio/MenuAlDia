"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Restaurant } from "@/lib/types";
import {
  fieldErrorsFromZod,
  restaurantSettingsSchema,
} from "@/lib/validations";
import { normalizeLegacyState } from "@/lib/mx-locations";
import { PRESET_LABELS, parseThemeConfig, type ThemeConfig } from "@/lib/theme";
import { ThemeEditor } from "@/components/admin/theme-editor";
import {
  SettingsAccordionItem,
  scrollSettingsSectionIntoView,
} from "@/components/admin/settings-accordion";
import {
  joinSpanish,
  unsavedLeaveMessage,
  useUnsavedChangesGuard,
} from "@/components/admin/use-unsaved-changes-guard";
import { DishPhotoUpload } from "@/components/admin/dish-photo-upload";
import { MxLocationFields } from "@/components/location/mx-location-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PLAN_LABELS } from "@/lib/plans";
import {
  deliveryModeLabel,
  normalizeBusinessType,
  pickupModeLabel,
  shippingCostLabel,
  supportsDineIn,
  supportsShippingQuote,
} from "@/lib/business-labels";
import { PlanRequestPanel } from "@/components/admin/plan-request-panel";
import { SubscriptionPanel } from "@/components/admin/subscription-panel";
import { AiUsagePanel } from "@/components/admin/ai-usage-panel";
import { AdminFaqsPanel } from "@/components/admin/admin-faqs-panel";
import { DailyMenuVisibilitySwitch } from "@/components/admin/daily-menu-visibility-switch";
import { toast } from "sonner";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";
import { useAdminDockSave } from "@/components/admin/admin-dock";
import {
  StoreHoursEditor,
  scheduleHoursFromRestaurant,
} from "@/components/admin/store-hours-editor";
import {
  effectiveAcceptingOrders,
  formatScheduleText,
  hasConfiguredHours,
  type ScheduleHours,
} from "@/lib/store-hours";
import { can, type PlanType } from "@/lib/plans";

const SETTINGS_SECTIONS = [
  "negocio",
  "horario",
  "pedidos",
  "apariencia",
  "faqs",
  "ia",
  "plan",
] as const;

type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number];

const SETTINGS_NAV: { id: SettingsSectionId; label: string }[] = [
  { id: "negocio", label: "Negocio" },
  { id: "horario", label: "Horario" },
  { id: "pedidos", label: "Pedidos y entrega" },
  { id: "apariencia", label: "Apariencia" },
  { id: "faqs", label: "FAQs" },
  { id: "ia", label: "Uso de IA" },
  { id: "plan", label: "Plan y suscripción" },
];

const SAVABLE_SECTIONS = [
  "negocio",
  "horario",
  "pedidos",
  "apariencia",
] as const;

type SavableSectionId = (typeof SAVABLE_SECTIONS)[number];

const SAVABLE_SECTION_LABELS: Record<SavableSectionId, string> = {
  negocio: "Negocio",
  horario: "Horario",
  pedidos: "Pedidos y entrega",
  apariencia: "Apariencia",
};

type SettingsDraft = {
  negocio: {
    name: string;
    slogan: string;
    phone_whatsapp: string;
    address: string;
    maps_url: string;
    instagram_url: string;
    facebook_url: string;
    tiktok_url: string;
    city: string;
    state: string;
    logoUrl: string;
  };
  horario: {
    scheduleHours: unknown;
    scheduleAuto: boolean;
    closedMessage: string;
  };
  pedidos: {
    deliveryMode: "quote" | "included" | "fixed";
    shipping_cost: string;
    offersDelivery: boolean;
    offersPickup: boolean;
    offersDineIn: boolean;
    ordersViaWa: boolean;
    ordersViaCrm: boolean;
    showTransferDetails: boolean;
    bankHolder: string;
    bankName: string;
    bankClabe: string;
  };
  apariencia: {
    theme: ThemeConfig;
  };
};

function inputValue(id: string, fallback: string) {
  const el = document.getElementById(id);
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    return el.value.trim();
  }
  return fallback.trim();
}

function snapTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return value.trim();
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function normalizeScheduleHours(hours: ScheduleHours) {
  return Object.fromEntries(
    Object.entries(hours).map(([key, day]) => [
      key,
      day
        ? {
            closed: Boolean(day.closed),
            slots: (day.slots ?? []).map((slot) => ({
              open: snapTime(slot.open),
              close: snapTime(slot.close),
            })),
          }
        : { closed: true, slots: [] },
    ]),
  );
}

function normCost(raw: string) {
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return raw.trim();
  return String(n);
}

function dirtySectionIds(current: SettingsDraft, baseline: SettingsDraft) {
  return SAVABLE_SECTIONS.filter(
    (id) => JSON.stringify(current[id]) !== JSON.stringify(baseline[id]),
  );
}

function isSettingsSection(value: string): value is SettingsSectionId {
  return (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

const FIELD_SECTION: Record<string, SettingsSectionId> = {
  name: "negocio",
  slogan: "negocio",
  phone_whatsapp: "negocio",
  address: "negocio",
  maps_url: "negocio",
  city: "negocio",
  state: "negocio",
  instagram_url: "negocio",
  facebook_url: "negocio",
  tiktok_url: "negocio",
  shipping_cost: "pedidos",
};

export default function SettingsPage() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [freeShipping, setFreeShipping] = useState(false);
  const [shippingOnQuote, setShippingOnQuote] = useState(false);
  const [offersDelivery, setOffersDelivery] = useState(true);
  const [offersPickup, setOffersPickup] = useState(true);
  const [offersDineIn, setOffersDineIn] = useState(false);
  const [ordersViaWa, setOrdersViaWa] = useState(true);
  const [ordersViaCrm, setOrdersViaCrm] = useState(false);
  const [showTransferDetails, setShowTransferDetails] = useState(false);
  const [bankHolder, setBankHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankClabe, setBankClabe] = useState("");
  const [theme, setTheme] = useState<ThemeConfig | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [scheduleHours, setScheduleHours] = useState<ScheduleHours>({});
  const [scheduleAuto, setScheduleAuto] = useState(false);
  const [closedMessage, setClosedMessage] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openSection, setOpenSection] = useState<SettingsSectionId | null>(
    "negocio",
  );
  const [dirtySections, setDirtySections] = useState<SavableSectionId[]>([]);
  const prevOpenSection = useRef<SettingsSectionId | null | undefined>(
    undefined,
  );
  const baselineRef = useRef<SettingsDraft | null>(null);
  const restaurantRef = useRef(restaurant);
  restaurantRef.current = restaurant;
  const openSectionRef = useRef(openSection);
  openSectionRef.current = openSection;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const sessionRes = await fetch("/api/admin/session");
    if (sessionRes.status === 401) {
      router.push("/admin/login");
      return;
    }
    const sessionJson = (await sessionRes.json()) as {
      restaurant?: Restaurant;
      error?: string;
    };
    if (!sessionRes.ok || !sessionJson.restaurant) {
      setLoadError(
        sessionJson.error ?? "Tu usuario no está vinculado a un restaurante.",
      );
      setLoading(false);
      return;
    }
    const r = sessionJson.restaurant;
    setRestaurant(r);
    setFreeShipping(r.free_shipping);
    setShippingOnQuote(r.shipping_on_quote === true);
    setOffersDelivery(r.offers_delivery !== false);
    setOffersPickup(r.offers_pickup !== false);
    setOffersDineIn(
      supportsDineIn(r.business_type) && r.offers_dine_in === true,
    );
    setOrdersViaWa(r.orders_via_wa !== false);
    setOrdersViaCrm(r.orders_via_crm === true && can(r.plan_type, "crm"));
    setShowTransferDetails(r.show_transfer_details === true);
    setBankHolder(r.bank_account_holder ?? "");
    setBankName(r.bank_name ?? "");
    setBankClabe(r.bank_clabe ?? "");
    setTheme(parseThemeConfig(r.theme_config));
    setLogoUrl(r.logo_url);
    setCity(r.city ?? "");
    setStateCode(normalizeLegacyState(r.state) || r.state || "");
    setScheduleHours(scheduleHoursFromRestaurant(r.schedule_hours));
    setScheduleAuto(Boolean(r.schedule_auto));
    setClosedMessage(r.closed_message ?? "");
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const collectDraft = useCallback((): SettingsDraft => {
    const r = restaurantRef.current;
    const deliveryMode = shippingOnQuote
      ? "quote"
      : freeShipping
        ? "included"
        : "fixed";
    return {
      negocio: {
        name: inputValue("name", r?.name ?? ""),
        slogan: inputValue("slogan", r?.slogan ?? ""),
        phone_whatsapp: inputValue("phone_whatsapp", r?.phone_whatsapp ?? ""),
        address: inputValue("address", r?.address ?? ""),
        maps_url: inputValue("maps_url", r?.maps_url ?? ""),
        instagram_url: inputValue("instagram_url", r?.instagram_url ?? ""),
        facebook_url: inputValue("facebook_url", r?.facebook_url ?? ""),
        tiktok_url: inputValue("tiktok_url", r?.tiktok_url ?? ""),
        city: city.trim(),
        state: stateCode.trim(),
        logoUrl: logoUrl ?? "",
      },
      horario: {
        scheduleHours: normalizeScheduleHours(scheduleHours),
        scheduleAuto,
        closedMessage: closedMessage.trim(),
      },
      pedidos: {
        deliveryMode,
        shipping_cost:
          deliveryMode === "fixed"
            ? normCost(inputValue("shipping_cost", String(r?.shipping_cost ?? "")))
            : "",
        offersDelivery,
        offersPickup,
        offersDineIn,
        ordersViaWa,
        ordersViaCrm,
        showTransferDetails,
        bankHolder: bankHolder.trim(),
        bankName: bankName.trim(),
        bankClabe: bankClabe.replace(/\D/g, ""),
      },
      apariencia: {
        theme: parseThemeConfig(theme),
      },
    };
  }, [
    bankClabe,
    bankHolder,
    bankName,
    city,
    closedMessage,
    freeShipping,
    logoUrl,
    offersDelivery,
    offersDineIn,
    offersPickup,
    ordersViaCrm,
    ordersViaWa,
    scheduleAuto,
    scheduleHours,
    shippingOnQuote,
    showTransferDetails,
    stateCode,
    theme,
  ]);
  const collectDraftRef = useRef(collectDraft);
  collectDraftRef.current = collectDraft;

  const syncDirty = useCallback(() => {
    const baseline = baselineRef.current;
    if (!baseline) return;
    setDirtySections(dirtySectionIds(collectDraftRef.current(), baseline));
  }, []);

  const markBaseline = useCallback(() => {
    baselineRef.current = collectDraftRef.current();
    setDirtySections([]);
  }, []);

  const dirtyLabels = dirtySections.map((id) => SAVABLE_SECTION_LABELS[id]);
  const dirtySet = new Set<string>(dirtySections);
  useUnsavedChangesGuard(
    dirtySections.length > 0,
    unsavedLeaveMessage(dirtyLabels),
  );

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (!isSettingsSection(hash)) return;
      if (hash === openSectionRef.current) return;
      setOpenSection(hash);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  useEffect(() => {
    const desired = openSection ? `#${openSection}` : "";
    if (window.location.hash === desired) return;
    const url = `${window.location.pathname}${window.location.search}${desired}`;
    window.history.replaceState(null, "", url);
  }, [openSection]);

  useEffect(() => {
    const prev = prevOpenSection.current;
    prevOpenSection.current = openSection;
    if (prev === undefined) return;
    if (!openSection || openSection === prev) return;
    let cancelled = false;
    const frames: number[] = [];
    const run = () => {
      if (!cancelled) scrollSettingsSectionIntoView(openSection);
    };
    frames.push(
      window.requestAnimationFrame(() => {
        frames.push(window.requestAnimationFrame(run));
      }),
    );
    const timer = window.setTimeout(run, 120);
    return () => {
      cancelled = true;
      for (const id of frames) window.cancelAnimationFrame(id);
      window.clearTimeout(timer);
    };
  }, [openSection]);

  useEffect(() => {
    if (loading) {
      baselineRef.current = null;
      setDirtySections([]);
      return;
    }
    let cancelled = false;
    const capture = () => {
      if (cancelled) return;
      if (!document.getElementById("settings-form")) {
        timer = window.setTimeout(capture, 50);
        return;
      }
      markBaseline();
    };
    let timer = window.setTimeout(capture, 50);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loading, markBaseline, restaurant?.id]);

  useEffect(() => {
    syncDirty();
  }, [collectDraft, syncDirty]);

  function selectSection(id: SettingsSectionId) {
    setOpenSection(id);
  }

  function toggleSection(id: SettingsSectionId) {
    setOpenSection((cur) => (cur === id ? null : id));
  }

  useAdminDockSave(
    !loading && restaurant && theme
      ? {
          formId: "settings-form",
          label: "Guardar cambios",
          disabled: saving,
          pending: saving,
        }
      : null,
  );

  if (loading) {
    return <p className="text-sm text-muted">Cargando ajustes…</p>;
  }

  if (loadError || !restaurant || !theme) {
    return (
      <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">
          {loadError ?? "No se encontraron ajustes"}
        </p>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Reintentar
        </Button>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!restaurant || !theme) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    setFieldErrors({});
    const fd = new FormData(e.currentTarget);
    const scheduleText = formatScheduleText(scheduleHours);
    const giro = normalizeBusinessType(restaurant.business_type);
    const allowDineIn = supportsDineIn(giro);
    const allowQuote = supportsShippingQuote(giro);
    const quote = allowQuote && shippingOnQuote;
    const parsed = restaurantSettingsSchema.safeParse({
      name: fd.get("name"),
      slogan: fd.get("slogan"),
      phone_whatsapp: fd.get("phone_whatsapp"),
      address: fd.get("address") || "",
      maps_url: fd.get("maps_url") || "",
      city,
      state: stateCode,
      schedule_text: scheduleText,
      shipping_cost: quote ? 0 : fd.get("shipping_cost"),
      free_shipping: quote ? false : freeShipping,
      shipping_on_quote: quote,
      offers_delivery: offersDelivery,
      offers_pickup: offersPickup,
      offers_dine_in: allowDineIn ? offersDineIn : false,
      orders_via_wa: ordersViaWa,
      orders_via_crm: ordersViaCrm,
      show_transfer_details: showTransferDetails,
      bank_account_holder: bankHolder,
      bank_name: bankName,
      bank_clabe: bankClabe,
      logo_url: logoUrl || "",
      instagram_url: fd.get("instagram_url") || "",
      facebook_url: fd.get("facebook_url") || "",
      tiktok_url: fd.get("tiktok_url") || "",
    });
    if (!parsed.success) {
      const errors = fieldErrorsFromZod(parsed.error);
      setFieldErrors(errors);
      const firstKey = Object.keys(errors)[0];
      if (firstKey) {
        const section = FIELD_SECTION[firstKey];
        if (section) selectSection(section);
        window.setTimeout(() => {
          document.getElementById(firstKey)?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          document.getElementById(firstKey)?.focus();
        }, 50);
      }
      setSaving(false);
      return;
    }
    const accepting = effectiveAcceptingOrders({
      accepting_orders: restaurant.accepting_orders,
      schedule_auto: scheduleAuto,
      schedule_hours: scheduleHours,
      orders_override: scheduleAuto ? restaurant.orders_override ?? null : null,
    });
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("restaurants")
      .update({
        ...parsed.data,
        maps_url: parsed.data.maps_url || null,
        logo_url: parsed.data.logo_url || null,
        instagram_url: parsed.data.instagram_url || null,
        facebook_url: parsed.data.facebook_url || null,
        tiktok_url: parsed.data.tiktok_url || null,
        theme_config: theme,
        schedule_hours: scheduleHours,
        schedule_auto: scheduleAuto,
        closed_message: closedMessage.trim().slice(0, 160),
        accepting_orders: accepting,
        orders_override: scheduleAuto
          ? restaurant.orders_override ?? null
          : null,
      })
      .eq("id", restaurant.id);
    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      toast.error(dbError.message);
      return;
    }
    await fetch("/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: restaurant.slug }),
    });
    await fetch("/api/admin/support-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary: "Soporte actualizó ajustes" }),
    });
    setMessage("Ajustes guardados");
    toast.success("Ajustes guardados");
    markBaseline();
    router.refresh();
  }

  const giro = restaurant
    ? normalizeBusinessType(restaurant.business_type)
    : "restaurante";
  const allowDineIn = supportsDineIn(giro);
  const allowQuote = supportsShippingQuote(giro);
  const orderHint = [
    offersPickup ? (giro === "servicios" ? "En el local" : "Recoger") : null,
    offersDelivery ? deliveryModeLabel(giro) : null,
    allowDineIn && offersDineIn ? "Comedor" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">
          <Emoji char={UI_EMOJI.settings} />
          Ajustes
        </h1>
        <p className="text-sm text-muted">
          <a
            href={`/${restaurant.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand underline-offset-2 hover:underline"
          >
            /{restaurant.slug}
          </a>{" "}
          · Plan {PLAN_LABELS[restaurant.plan_type || "catalog"]}
        </p>
        <p className="mt-1 text-xs text-muted">
          Abre una sección a la vez. Los cambios de negocio, horario, pedidos y
          apariencia se guardan juntos.
        </p>
        {dirtyLabels.length > 0 ? (
          <p className="mt-1 text-xs font-medium text-amber-800">
            Hay cambios sin guardar en {joinSpanish(dirtyLabels)}.
          </p>
        ) : null}
      </div>

      <div className="md:grid md:grid-cols-[11rem_minmax(0,1fr)] md:gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="mb-2 hidden md:block">
          <nav className="sticky top-[calc(var(--admin-header-h,4.5rem)+0.5rem)] z-10 max-h-[calc(100dvh-var(--admin-header-h,4.5rem)-8.5rem)] overflow-y-auto bg-background">
            <ul className="space-y-1 text-sm">
              {SETTINGS_NAV.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    aria-current={openSection === item.id ? "true" : undefined}
                    className={`block rounded-lg px-2 py-2 ${
                      openSection === item.id
                        ? "bg-brand/10 font-medium text-brand-dark"
                        : "text-muted hover:bg-black/4 hover:text-foreground"
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      selectSection(item.id);
                    }}
                  >
                    <span className="flex items-center justify-between gap-2">
                      {item.label}
                      {dirtySet.has(item.id) ? (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600"
                          title="Cambios sin guardar"
                          aria-label="Cambios sin guardar"
                        />
                      ) : null}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="min-w-0 space-y-2">
          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-accent">
              {message}
            </p>
          ) : null}

          <form
            id="settings-form"
            onSubmit={onSubmit}
            onInput={syncDirty}
            onChange={syncDirty}
            className="space-y-2"
          >
            <SettingsAccordionItem
              id="negocio"
              title="Negocio"
              hint={restaurant.name}
              open={openSection === "negocio"}
              onToggle={() => toggleSection("negocio")}
              unsaved={dirtySections.includes("negocio")}
            >
              <div className="space-y-4">
                <DailyMenuVisibilitySwitch
                  restaurantId={restaurant.id}
                  publicSlug={restaurant.slug}
                  planType={restaurant.plan_type || "catalog"}
                  businessType={restaurant.business_type}
                />
                {normalizeBusinessType(restaurant.business_type) ===
                "servicios" ? (
                  <div className="rounded-xl border border-black/5 bg-background/60 px-3 py-3 text-sm">
                    <p className="font-semibold">Citas por WhatsApp</p>
                    <p className="mt-1 text-xs text-muted">
                      Las solicitudes de cita del menú público llegan a tu
                      WhatsApp.
                    </p>
                  </div>
                ) : null}
                <DishPhotoUpload
                  restaurantId={restaurant.id}
                  value={logoUrl}
                  onChange={setLogoUrl}
                  label="Logo del negocio"
                  kind="product"
                  guide="logo"
                />

                {(
                  [
                    ["name", "Nombre", restaurant.name],
                    ["slogan", "Eslogan", restaurant.slogan],
                    [
                      "phone_whatsapp",
                      "WhatsApp (521…)",
                      restaurant.phone_whatsapp,
                    ],
                  ] as const
                ).map(([id, fieldLabel, value]) => (
                  <div key={id} className="space-y-1.5">
                    <Label htmlFor={id}>{fieldLabel}</Label>
                    <Input
                      id={id}
                      name={id}
                      defaultValue={value}
                      aria-invalid={!!fieldErrors[id]}
                    />
                    {fieldErrors[id] ? (
                      <p className="text-xs text-red-600">{fieldErrors[id]}</p>
                    ) : null}
                  </div>
                ))}

                <MxLocationFields
                  state={stateCode}
                  city={city}
                  onStateChange={setStateCode}
                  onCityChange={setCity}
                  stateError={fieldErrors.state}
                  cityError={fieldErrors.city}
                />

                <div className="space-y-1.5">
                  <Label htmlFor="address">Dirección (opcional)</Label>
                  <Input
                    id="address"
                    name="address"
                    defaultValue={restaurant.address}
                    aria-invalid={!!fieldErrors.address}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="maps_url">Link de Google Maps (opcional)</Label>
                  <Input
                    id="maps_url"
                    name="maps_url"
                    type="url"
                    defaultValue={restaurant.maps_url ?? ""}
                    placeholder="https://maps.app.goo.gl/…"
                  />
                </div>

                <div className="space-y-3 rounded-xl border border-black/5 bg-background/60 p-3">
                  <p className="text-sm font-semibold">Redes sociales</p>
                  {(
                    [
                      ["instagram_url", "Instagram", restaurant.instagram_url],
                      ["facebook_url", "Facebook", restaurant.facebook_url],
                      ["tiktok_url", "TikTok", restaurant.tiktok_url],
                    ] as const
                  ).map(([id, fieldLabel, value]) => (
                    <div key={id} className="space-y-1.5">
                      <Label htmlFor={id}>{fieldLabel}</Label>
                      <Input
                        id={id}
                        name={id}
                        type="url"
                        defaultValue={value ?? ""}
                        placeholder="https://…"
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-2 rounded-xl border border-black/5 bg-background/60 p-4">
                  <p className="text-sm font-semibold">Legal</p>
                  {restaurant.terms_version_accepted &&
                  restaurant.terms_accepted_at ? (
                    <p className="text-sm text-muted">
                      Términos: Aceptados v{restaurant.terms_version_accepted}.
                    </p>
                  ) : (
                    <p className="text-sm text-muted">Términos: Pendiente.</p>
                  )}
                  <p className="text-sm">
                    <a
                      href="/terminos"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-brand underline-offset-2 hover:underline"
                    >
                      Ver Términos
                    </a>
                    {" · "}
                    <a
                      href="/privacidad"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-brand underline-offset-2 hover:underline"
                    >
                      Ver Privacidad
                    </a>
                  </p>
                </div>
              </div>
            </SettingsAccordionItem>

            <SettingsAccordionItem
              id="horario"
              title="Horario"
              hint={
                hasConfiguredHours(scheduleHours)
                  ? formatScheduleText(scheduleHours)
                  : "Sin horario configurado"
              }
              open={openSection === "horario"}
              onToggle={() => toggleSection("horario")}
              unsaved={dirtySections.includes("horario")}
            >
              <StoreHoursEditor
                value={scheduleHours}
                onChange={setScheduleHours}
                scheduleAuto={scheduleAuto}
                onScheduleAutoChange={setScheduleAuto}
                closedMessage={closedMessage}
                onClosedMessageChange={setClosedMessage}
              />
            </SettingsAccordionItem>

            <SettingsAccordionItem
              id="pedidos"
              title="Pedidos y entrega"
              hint={orderHint || "Elige al menos un modo"}
              open={openSection === "pedidos"}
              onToggle={() => toggleSection("pedidos")}
              unsaved={dirtySections.includes("pedidos")}
            >
              <div className="space-y-4">
                <div className="space-y-2 rounded-xl border border-black/5 bg-background/60 p-3">
                  <p className="text-sm font-semibold">Modos de pedido</p>
                  <p className="text-xs text-muted">
                    {allowDineIn
                      ? "Activa uno, dos o los tres. El menú solo muestra los que dejes encendidos."
                      : "Activa recoger y/o a domicilio. El menú solo muestra los que dejes encendidos."}
                  </p>
                  <div className="flex min-h-14 items-center justify-between">
                    <Label htmlFor="offers_pickup">
                      {pickupModeLabel(giro)}
                    </Label>
                    <Switch
                      id="offers_pickup"
                      checked={offersPickup}
                      onCheckedChange={(v) => {
                        if (
                          !v &&
                          !offersDelivery &&
                          !(allowDineIn && offersDineIn)
                        )
                          return;
                        setOffersPickup(v);
                      }}
                    />
                  </div>
                  <div className="flex min-h-14 items-center justify-between">
                    <Label htmlFor="offers_delivery">
                      {giro === "servicios"
                        ? "A domicilio (visita / envío)"
                        : "Envío a domicilio"}
                    </Label>
                    <Switch
                      id="offers_delivery"
                      checked={offersDelivery}
                      onCheckedChange={(v) => {
                        if (
                          !v &&
                          !offersPickup &&
                          !(allowDineIn && offersDineIn)
                        )
                          return;
                        setOffersDelivery(v);
                      }}
                    />
                  </div>
                  {allowDineIn ? (
                    <div className="flex min-h-14 items-center justify-between">
                      <Label htmlFor="offers_dine_in">Comedor</Label>
                      <Switch
                        id="offers_dine_in"
                        checked={offersDineIn}
                        onCheckedChange={(v) => {
                          if (!v && !offersPickup && !offersDelivery) return;
                          setOffersDineIn(v);
                        }}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2 rounded-xl border border-black/5 bg-background/60 p-3">
                  <p className="text-sm font-semibold">
                    ¿Dónde recibes los pedidos?
                  </p>
                  <p className="text-xs text-muted">
                    {can(restaurant.plan_type, "crm")
                      ? "Deja al menos uno encendido. Puedes usar los dos a la vez."
                      : "Tu plan recibe los pedidos por WhatsApp. El tablero de Pedidos está en el plan Pro."}
                  </p>
                  <div className="flex min-h-14 items-center justify-between">
                    <Label htmlFor="orders_via_wa">En mi WhatsApp</Label>
                    <Switch
                      id="orders_via_wa"
                      checked={ordersViaWa}
                      disabled={!can(restaurant.plan_type, "crm")}
                      onCheckedChange={(v) => {
                        if (!v && !ordersViaCrm) return;
                        setOrdersViaWa(v);
                      }}
                    />
                  </div>
                  <div className="flex min-h-14 items-center justify-between">
                    <Label htmlFor="orders_via_crm">
                      En el tablero de Pedidos
                    </Label>
                    <Switch
                      id="orders_via_crm"
                      checked={ordersViaCrm}
                      disabled={!can(restaurant.plan_type, "crm")}
                      onCheckedChange={(v) => {
                        if (!v && !ordersViaWa) return;
                        setOrdersViaCrm(v);
                      }}
                    />
                  </div>
                  {can(restaurant.plan_type, "crm") &&
                  ordersViaCrm &&
                  !ordersViaWa ? (
                    <p className="text-xs text-muted">
                      El cliente ya no abrirá WhatsApp: verá su pedido
                      confirmado con folio y un comprobante con enlace. Ahí
                      ve el estado y el total (también si cotizas envío o
                      traslado). Revisa el tablero de Pedidos para atenderlos.
                    </p>
                  ) : null}
                  {can(restaurant.plan_type, "crm") &&
                  ordersViaCrm &&
                  ordersViaWa ? (
                    <p className="text-xs text-muted">
                      Los pedidos llegan al chat y al tablero. En Pedidos
                      puedes abrir o copiar el comprobante del cliente y, si
                      cotizas, enviárselo por WhatsApp.
                    </p>
                  ) : null}
                </div>

                {allowQuote ? (
                  <div className="space-y-2 rounded-xl border border-black/5 bg-background/60 p-3">
                    <p className="text-sm font-semibold">
                      {shippingCostLabel(giro)}
                    </p>
                    <p className="text-xs text-muted">
                      Aplica cuando atiendes a domicilio: visita, taller o
                      envío de productos. El costo (envío o traslado) lo cargas
                      después en el pedido si eliges «Por cotizar». Si no pones
                      monto, queda incluido.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {(
                        [
                          { id: "included", label: "Incluido" },
                          { id: "fixed", label: "Precio fijo" },
                          { id: "quote", label: "Por cotizar" },
                        ] as const
                      ).map((opt) => {
                        const active =
                          opt.id === "quote"
                            ? shippingOnQuote
                            : opt.id === "included"
                              ? !shippingOnQuote && freeShipping
                              : !shippingOnQuote && !freeShipping;
                        return (
                          <Button
                            key={opt.id}
                            type="button"
                            size="sm"
                            variant={active ? "default" : "secondary"}
                            className="min-h-11"
                            disabled={!offersDelivery}
                            onClick={() => {
                              if (opt.id === "quote") {
                                setShippingOnQuote(true);
                                setFreeShipping(false);
                              } else if (opt.id === "included") {
                                setShippingOnQuote(false);
                                setFreeShipping(true);
                              } else {
                                setShippingOnQuote(false);
                                setFreeShipping(false);
                              }
                            }}
                          >
                            {opt.label}
                          </Button>
                        );
                      })}
                    </div>
                    {!shippingOnQuote && !freeShipping ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="shipping_cost">Monto (MXN)</Label>
                        <Input
                          id="shipping_cost"
                          name="shipping_cost"
                          defaultValue={String(restaurant.shipping_cost)}
                          inputMode="decimal"
                          disabled={!offersDelivery}
                        />
                      </div>
                    ) : (
                      <input type="hidden" name="shipping_cost" value="0" />
                    )}
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="shipping_cost">Costo de envío</Label>
                      <Input
                        id="shipping_cost"
                        name="shipping_cost"
                        defaultValue={String(restaurant.shipping_cost)}
                        inputMode="decimal"
                        disabled={!offersDelivery}
                      />
                    </div>

                    <div className="flex min-h-14 items-center justify-between rounded-xl border border-black/5 bg-background/60 px-3 py-3">
                      <Label htmlFor="free_shipping">Envío gratis</Label>
                      <Switch
                        id="free_shipping"
                        checked={freeShipping}
                        onCheckedChange={setFreeShipping}
                        disabled={!offersDelivery}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2 rounded-xl border border-black/5 bg-background/60 p-3">
                  <p className="text-sm font-semibold">Datos para transferir</p>
                  <p className="text-xs text-muted">
                    Si los activas, el cliente los ve al elegir transferencia y
                    van en el WhatsApp. No son los de tu suscripción a Menú al
                    Día.
                  </p>
                  <div className="flex min-h-14 items-center justify-between">
                    <Label htmlFor="show_transfer_details">
                      Mostrar datos para transferir
                    </Label>
                    <Switch
                      id="show_transfer_details"
                      checked={showTransferDetails}
                      onCheckedChange={setShowTransferDetails}
                    />
                  </div>
                  {showTransferDetails ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="bank_account_holder">Titular</Label>
                        <Input
                          id="bank_account_holder"
                          value={bankHolder}
                          onChange={(e) => setBankHolder(e.target.value)}
                          placeholder="Nombre del titular"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="bank_name">Banco</Label>
                        <Input
                          id="bank_name"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          placeholder="Ej. BBVA"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="bank_clabe">CLABE (18 dígitos)</Label>
                        <Input
                          id="bank_clabe"
                          value={bankClabe}
                          onChange={(e) => setBankClabe(e.target.value)}
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="18 dígitos"
                        />
                      </div>
                      {bankClabe.replace(/\D/g, "").length !== 18 ? (
                        <p className="text-xs text-amber-800">
                          Falta una CLABE de 18 dígitos para mostrarlos en el
                          menú y en WhatsApp.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </SettingsAccordionItem>

            <SettingsAccordionItem
              id="apariencia"
              title="Apariencia"
              hint={PRESET_LABELS[theme.preset] ?? theme.preset}
              open={openSection === "apariencia"}
              onToggle={() => toggleSection("apariencia")}
              keepMounted={false}
              unsaved={dirtySections.includes("apariencia")}
            >
              <ThemeEditor
                value={theme}
                onChange={setTheme}
                restaurantId={restaurant.id}
                logoUrl={logoUrl}
                businessType={restaurant.business_type}
              />
            </SettingsAccordionItem>
          </form>

          <SettingsAccordionItem
            id="faqs"
            title="Preguntas frecuentes"
            hint="Se muestran al final del menú"
            open={openSection === "faqs"}
            onToggle={() => toggleSection("faqs")}
            keepMounted={false}
          >
            <AdminFaqsPanel businessType={restaurant.business_type} />
          </SettingsAccordionItem>

          <SettingsAccordionItem
            id="ia"
            title="Uso de IA"
            hint="Cupos y packs extra"
            open={openSection === "ia"}
            onToggle={() => toggleSection("ia")}
            keepMounted={false}
          >
            <AiUsagePanel />
          </SettingsAccordionItem>

          <SettingsAccordionItem
            id="plan"
            title="Plan y suscripción"
            hint={PLAN_LABELS[restaurant.plan_type || "catalog"]}
            open={openSection === "plan"}
            onToggle={() => toggleSection("plan")}
            keepMounted={false}
          >
            <div className="space-y-4">
              <PlanRequestPanel
                currentPlan={restaurant.plan_type || "catalog"}
                subscriptionEndDate={restaurant.subscription_end_date}
                isActive={restaurant.is_active}
                graceEndsAt={restaurant.grace_ends_at}
                purgeScheduledAt={restaurant.purge_scheduled_at}
              />
              <SubscriptionPanel
                planType={(restaurant.plan_type as PlanType) || "catalog"}
              />
            </div>
          </SettingsAccordionItem>
        </div>
      </div>
    </div>
  );
}
