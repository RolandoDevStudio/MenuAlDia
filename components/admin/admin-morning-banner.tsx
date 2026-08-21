"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

function greetingForHour(hour: number): string {
  if (hour < 12) return "¡Buenos días";
  if (hour < 19) return "¡Buenas tardes";
  return "¡Buenas noches";
}

export function AdminMorningBanner({
  restaurantId,
  restaurantName,
  publicSlug,
  initialAcceptingOrders,
}: {
  restaurantId: string;
  restaurantName: string;
  publicSlug: string;
  initialAcceptingOrders: boolean;
}) {
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(initialAcceptingOrders);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const hourFmt = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "numeric",
    hour12: false,
  });
  const hour = Number(hourFmt.format(now));
  const dateLine = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  const timeLine = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(now);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    setOpen(next);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("restaurants")
      .update({ accepting_orders: next })
      .eq("id", restaurantId);
    if (dbError) {
      setOpen(!next);
      setError(dbError.message);
      setBusy(false);
      return;
    }
    await fetch("/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: publicSlug }),
    });
    setBusy(false);
  }

  return (
    <section
      className={cn(
        "rounded-2xl border px-4 py-4 text-white shadow-sm",
        open
          ? "border-emerald-700/20 bg-gradient-to-br from-emerald-700 to-teal-800"
          : "border-red-800/20 bg-gradient-to-br from-stone-700 to-stone-900",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-tight">
            {greetingForHour(Number.isFinite(hour) ? hour : 12)}, {restaurantName}!
          </p>
          <p className="mt-1 text-sm capitalize text-white/85">
            {dateLine} · {timeLine}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              open ? "bg-emerald-300" : "bg-red-300",
            )}
          />
          <span className="text-xs font-semibold">
            {open ? "Abierto" : "Cerrado"}
          </span>
          <Switch
            checked={open}
            disabled={busy}
            onCheckedChange={(v) => void toggle(v)}
            aria-label="Aceptando pedidos"
          />
        </div>
      </div>
      <p className="mt-2 text-[11px] text-white/75">
        {open
          ? "Aceptando pedidos por WhatsApp"
          : "Cerrado por hoy — el menú sigue visible"}
      </p>
      {error ? (
        <p className="mt-1 text-xs text-red-200" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
