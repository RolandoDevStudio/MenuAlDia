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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/admin/login");
      return;
    }
    const { data: membership, error: memError } = await supabase
      .from("restaurant_members")
      .select("restaurant_id")
      .eq("user_id", user.id)
      .neq("role", "super_admin")
      .limit(1)
      .maybeSingle();

    let restaurantId = membership?.restaurant_id;
    if (!restaurantId) {
      const { data: anyMem } = await supabase
        .from("restaurant_members")
        .select("restaurant_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      restaurantId = anyMem?.restaurant_id;
    }

    if (memError || !restaurantId) {
      setLoadError(
        memError?.message ??
          "Tu usuario no está vinculado a un restaurante.",
      );
      setLoading(false);
      return;
    }
    const { data, error: restError } = await supabase
      .from("restaurants")
      .select("*")
      .eq("id", restaurantId)
      .single();
    if (restError || !data) {
      setLoadError(restError?.message ?? "No se pudo cargar el restaurante");
      setLoading(false);
      return;
    }
    const r = data as Restaurant;
    setRestaurant(r);
    setFreeShipping(r.free_shipping);
    setOffersDelivery(r.offers_delivery !== false);
    setTheme(parseThemeConfig(r.theme_config));
    setLogoUrl(r.logo_url);
    setCity(r.city ?? "");
    setStateCode(normalizeLegacyState(r.state) || r.state || "");
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

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
    const parsed = restaurantSettingsSchema.safeParse({
      name: fd.get("name"),
      slogan: fd.get("slogan"),
      phone_whatsapp: fd.get("phone_whatsapp"),
      address: fd.get("address") || "",
      maps_url: fd.get("maps_url") || "",
      city,
      state: stateCode,
      schedule_text: fd.get("schedule_text"),
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
      })
      .eq("id", restaurant.id);
    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    await fetch("/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: restaurant.slug }),
    });
    setMessage("Ajustes guardados");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Ajustes</h1>
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

      <PlanRequestPanel currentPlan={restaurant.plan_type || "catalog"} />

      <SubscriptionPanel
        planType={(restaurant.plan_type as PlanType) || "catalog"}
      />

      <AdminFaqsPanel businessType={restaurant.business_type} />

      <ThemeEditor
        value={theme}
        onChange={setTheme}
        restaurantId={restaurant.id}
      />

      {normalizeBusinessType(restaurant.business_type) === "servicios" ? (
        <div className="rounded-xl border border-black/5 bg-surface px-3 py-3 text-sm">
          <p className="font-semibold">Citas por WhatsApp</p>
          <p className="mt-1 text-xs text-muted">
            Las solicitudes de cita del menú público llegan a tu WhatsApp
            (nombre, teléfono y horario). En el catálogo marca cada servicio
            como Agendar y/o Compra. La agenda visual completa llega en Pro
            más adelante.
          </p>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
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
            ["schedule_text", "Horario", restaurant.schedule_text],
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
          {fieldErrors.address ? (
            <p className="text-xs text-red-600">{fieldErrors.address}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="maps_url">Link de Google Maps (opcional)</Label>
          <Input
            id="maps_url"
            name="maps_url"
            type="url"
            defaultValue={restaurant.maps_url ?? ""}
            placeholder="https://maps.app.goo.gl/…"
            aria-invalid={!!fieldErrors.maps_url}
          />
          <p className="text-[11px] text-muted">
            En Maps: Compartir → Copiar enlace. Aparece como “Cómo llegar”.
          </p>
          {fieldErrors.maps_url ? (
            <p className="text-xs text-red-600">{fieldErrors.maps_url}</p>
          ) : null}
        </div>

        <div className="space-y-3 rounded-xl border border-black/5 bg-surface p-3">
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
              {fieldErrors[id] ? (
                <p className="text-xs text-red-600">{fieldErrors[id]}</p>
              ) : null}
            </div>
          ))}
        </div>

        <div className="flex min-h-14 items-center justify-between rounded-xl border border-black/5 bg-surface px-3 py-3">
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

        <div className="flex min-h-14 items-center justify-between rounded-xl border border-black/5 bg-surface px-3 py-3">
          <Label htmlFor="free_shipping">Envío gratis</Label>
          <Switch
            id="free_shipping"
            checked={freeShipping}
            onCheckedChange={setFreeShipping}
            disabled={!offersDelivery}
          />
        </div>

        <div className="space-y-2 rounded-xl border border-black/5 bg-surface p-4">
          <h2 className="text-sm font-semibold">Legal</h2>
          {restaurant.terms_version_accepted &&
          restaurant.terms_accepted_at ? (
            <p className="text-sm text-muted">
              Términos y Condiciones: Aceptados v
              {restaurant.terms_version_accepted} el{" "}
              {new Date(restaurant.terms_accepted_at).toLocaleString("es-MX", {
                dateStyle: "long",
                timeStyle: "short",
              })}
              .
            </p>
          ) : (
            <p className="text-sm text-muted">
              Términos y Condiciones: Pendiente de aceptación.
            </p>
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
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </form>
    </div>
  );
}
