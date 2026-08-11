"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Restaurant } from "@/lib/types";
import {
  fieldErrorsFromZod,
  restaurantSettingsSchema,
} from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [freeShipping, setFreeShipping] = useState(false);
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
      .limit(1)
      .maybeSingle();
    if (memError || !membership) {
      setLoadError(
        memError?.message ??
          "Tu usuario no está vinculado a un restaurante. Agrega un registro en restaurant_members.",
      );
      setLoading(false);
      return;
    }
    const { data, error: restError } = await supabase
      .from("restaurants")
      .select("*")
      .eq("id", membership.restaurant_id)
      .single();
    if (restError || !data) {
      setLoadError(restError?.message ?? "No se pudo cargar el restaurante");
      setLoading(false);
      return;
    }
    const r = data as Restaurant;
    setRestaurant(r);
    setFreeShipping(r.free_shipping);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-muted">Cargando ajustes…</p>;
  }

  if (loadError || !restaurant) {
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
    if (!restaurant) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    setFieldErrors({});
    const fd = new FormData(e.currentTarget);
    const parsed = restaurantSettingsSchema.safeParse({
      name: fd.get("name"),
      slogan: fd.get("slogan"),
      phone_whatsapp: fd.get("phone_whatsapp"),
      address: fd.get("address"),
      maps_url: fd.get("maps_url") || "",
      schedule_text: fd.get("schedule_text"),
      shipping_cost: fd.get("shipping_cost"),
      free_shipping: freeShipping,
      logo_url: restaurant.logo_url || "",
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

  const fields = [
    ["name", "Nombre", restaurant.name],
    ["slogan", "Eslogan", restaurant.slogan],
    ["phone_whatsapp", "WhatsApp (521…)", restaurant.phone_whatsapp],
    ["address", "Dirección", restaurant.address],
    ["maps_url", "Google Maps URL", restaurant.maps_url ?? ""],
    ["schedule_text", "Horario", restaurant.schedule_text],
    ["shipping_cost", "Costo de envío", String(restaurant.shipping_cost)],
  ] as const;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Ajustes</h1>
        <p className="text-sm text-muted">Slug público: /{restaurant.slug}</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        {fields.map(([id, label, value]) => (
          <div key={id} className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Input
              id={id}
              name={id}
              defaultValue={value}
              inputMode={id === "shipping_cost" ? "decimal" : undefined}
              aria-invalid={!!fieldErrors[id]}
            />
            {fieldErrors[id] ? (
              <p className="text-xs text-red-600">{fieldErrors[id]}</p>
            ) : null}
          </div>
        ))}
        <div className="flex min-h-14 items-center justify-between rounded-xl border border-black/5 bg-surface px-3 py-3">
          <Label htmlFor="free_shipping">Envío gratis</Label>
          <Switch
            id="free_shipping"
            checked={freeShipping}
            onCheckedChange={setFreeShipping}
          />
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
