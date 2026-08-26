"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Restaurant } from "@/lib/types";
import {
  fieldErrorsFromZod,
  restaurantSettingsSchema,
} from "@/lib/validations";
import { normalizeLegacyState } from "@/lib/mx-locations";
import { parseThemeConfig, type ThemeConfig } from "@/lib/theme";
import { ThemeEditor } from "@/components/admin/theme-editor";
import { DishPhotoUpload } from "@/components/admin/dish-photo-upload";
import { MxLocationFields } from "@/components/location/mx-location-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PLAN_LABELS } from "@/lib/plans";
import { normalizeBusinessType } from "@/lib/business-labels";
import { PlanRequestPanel } from "@/components/admin/plan-request-panel";
import { SubscriptionPanel } from "@/components/admin/subscription-panel";
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
  type ScheduleHours,
} from "@/lib/store-hours";
import type { PlanType } from "@/lib/plans";

export default function SettingsPage() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [freeShipping, setFreeShipping] = useState(false);
  const [offersDelivery, setOffersDelivery] = useState(true);
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
    setOffersDelivery(r.offers_delivery !== false);
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
    const parsed = restaurantSettingsSchema.safeParse({
      name: fd.get("name"),
      slogan: fd.get("slogan"),
      phone_whatsapp: fd.get("phone_whatsapp"),
      address: fd.get("address") || "",
      maps_url: fd.get("maps_url") || "",
      city,
      state: stateCode,
      schedule_text: scheduleText,
      shipping_cost: fd.get("shipping_cost"),
      free_shipping: freeShipping,
      offers_delivery: offersDelivery,
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
        document.getElementById(firstKey)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        document.getElementById(firstKey)?.focus();
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
    router.refresh();
  }

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
      </div>

      <div className="md:grid md:grid-cols-[11rem_minmax(0,1fr)] md:gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav className="mb-2 hidden md:sticky md:top-16 md:block md:self-start">
          <ul className="space-y-1 text-sm">
            {(
              [
                ["#negocio", "Negocio"],
                ["#horario", "Horario"],
                ["#apariencia", "Apariencia"],
                ["#faqs", "FAQs"],
                ["#plan", "Plan y suscripción"],
              ] as const
            ).map(([href, lab]) => (
              <li key={href}>
                <a
                  href={href}
                  className="block rounded-lg px-2 py-2 text-muted hover:bg-black/[0.04] hover:text-foreground"
                >
                  {lab}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-3">
          <details open className="rounded-xl border border-black/5 bg-surface">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
              Negocio
            </summary>
            <div className="space-y-4 border-t border-black/5 px-4 pb-4 pt-3" id="negocio">
              <DailyMenuVisibilitySwitch
                restaurantId={restaurant.id}
                publicSlug={restaurant.slug}
                planType={restaurant.plan_type || "catalog"}
                businessType={restaurant.business_type}
              />
              {normalizeBusinessType(restaurant.business_type) === "servicios" ? (
                <div className="rounded-xl border border-black/5 bg-background/60 px-3 py-3 text-sm">
                  <p className="font-semibold">Citas por WhatsApp</p>
                  <p className="mt-1 text-xs text-muted">
                    Las solicitudes de cita del menú público llegan a tu WhatsApp.
                  </p>
                </div>
              ) : null}
              <form id="settings-form" onSubmit={onSubmit} className="space-y-4">
                <DishPhotoUpload
                  restaurantId={restaurant.id}
                  value={logoUrl}
                  onChange={setLogoUrl}
                  label="Logo del negocio"
                  kind="product"
                />

                {(
                  [
                    ["name", "Nombre", restaurant.name],
                    ["slogan", "Eslogan", restaurant.slogan],
                    ["phone_whatsapp", "WhatsApp (521…)", restaurant.phone_whatsapp],
                  ] as const
                ).map(([id, label, value]) => (
                  <div key={id} className="space-y-1.5">
                    <Label htmlFor={id}>{label}</Label>
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

                <StoreHoursEditor
                  value={scheduleHours}
                  onChange={setScheduleHours}
                  scheduleAuto={scheduleAuto}
                  onScheduleAutoChange={setScheduleAuto}
                  closedMessage={closedMessage}
                  onClosedMessageChange={setClosedMessage}
                />

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
                  ).map(([id, label, value]) => (
                    <div key={id} className="space-y-1.5">
                      <Label htmlFor={id}>{label}</Label>
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

                <div className="flex min-h-14 items-center justify-between rounded-xl border border-black/5 bg-background/60 px-3 py-3">
                  <Label htmlFor="offers_delivery">Acepto pedidos a domicilio</Label>
                  <Switch
                    id="offers_delivery"
                    checked={offersDelivery}
                    onCheckedChange={setOffersDelivery}
                  />
                </div>

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

                <div className="space-y-2 rounded-xl border border-black/5 bg-background/60 p-4">
                  <h2 className="text-sm font-semibold">Legal</h2>
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

                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                {message ? <p className="text-sm text-accent">{message}</p> : null}
              </form>
            </div>
          </details>

          <details className="rounded-xl border border-black/5 bg-surface" id="apariencia">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
              Apariencia
            </summary>
            <div className="border-t border-black/5 px-4 pb-4 pt-3">
              <ThemeEditor
                value={theme}
                onChange={setTheme}
                restaurantId={restaurant.id}
                logoUrl={logoUrl}
                businessType={restaurant.business_type}
              />
            </div>
          </details>

          <details className="rounded-xl border border-black/5 bg-surface" id="faqs">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
              Preguntas frecuentes
            </summary>
            <div className="border-t border-black/5 px-4 pb-4 pt-3">
              <AdminFaqsPanel businessType={restaurant.business_type} />
            </div>
          </details>

          <details className="rounded-xl border border-black/5 bg-surface" id="plan">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
              Plan y suscripción
            </summary>
            <div className="space-y-4 border-t border-black/5 px-4 pb-4 pt-3">
              <PlanRequestPanel currentPlan={restaurant.plan_type || "catalog"} />
              <SubscriptionPanel
                planType={(restaurant.plan_type as PlanType) || "catalog"}
              />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
