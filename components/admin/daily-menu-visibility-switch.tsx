"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { labelsFor } from "@/lib/business-labels";
import { can } from "@/lib/plans";
import type { PlanType } from "@/lib/plans";
import type { BusinessType } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function DailyMenuVisibilitySwitch({
  restaurantId,
  publicSlug,
  planType,
  businessType,
}: {
  restaurantId: string;
  publicSlug: string;
  planType: PlanType | string;
  businessType?: BusinessType | string | null;
}) {
  const allowed = can(planType, "daily_menu");
  const labels = labelsFor(businessType);
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!allowed) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("daily_menu_selections")
      .select("id, is_active")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (data) {
      setEnabled(data.is_active !== false);
    } else {
      await supabase.from("daily_menu_selections").insert({
        restaurant_id: restaurantId,
        package_price: 100,
        max_sides: 2,
        is_active: true,
        pricing_mode: "package",
      });
      setEnabled(true);
    }
    setReady(true);
  }, [allowed, restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed) return null;

  async function onToggle(on: boolean) {
    setBusy(true);
    setError(null);
    setEnabled(on);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("daily_menu_selections")
      .update({ is_active: on })
      .eq("restaurant_id", restaurantId);
    if (dbError) {
      setEnabled(!on);
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
    <div
      id="daily-menu"
      className="space-y-2 rounded-xl border border-black/5 bg-surface p-4"
    >
      <div className="flex min-h-14 items-center justify-between gap-3">
        <div>
          <Label htmlFor="daily_menu_active">
            Mostrar {labels.dailyMenu} en el menú público
          </Label>
          <p className="text-xs text-muted">
            Si lo desactivas, la sección desaparece por completo del menú del
            cliente.
          </p>
        </div>
        <Switch
          id="daily_menu_active"
          checked={enabled}
          disabled={!ready || busy}
          onCheckedChange={(on) => void onToggle(on)}
        />
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
