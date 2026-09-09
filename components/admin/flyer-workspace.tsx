"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FlyerAiPanel,
  type FlyerOverlayPatch,
} from "@/components/admin/flyer-ai-panel";
import { FlyerLibraryPanel } from "@/components/admin/flyer-library-panel";
import { FlyerStudio } from "@/components/flyer/flyer-studio";
import { Button } from "@/components/ui/button";
import { publicMenuUrl } from "@/lib/site-url";
import type { FlyerAiAspectRatio } from "@/lib/flyer-ai-prompt";
import type { Dish, Restaurant } from "@/lib/types";
import { cn } from "@/lib/utils";

type CategoryLite = { id: string; name: string; sort_order: number };

type Props = {
  restaurant: Restaurant;
  dishes: Dish[];
  categories: CategoryLite[];
  packagePrice?: number;
  preselectedMainIds?: string[];
  preselectedSideIds?: string[];
  initialHeadline?: string;
  sidesTitle?: string;
  fromToday?: boolean;
  sourceLabel?: string;
  todayPreselectedIds?: string[];
  /** Flyer id from ?ref= to load as AI reference */
  initialRefId?: string | null;
};

function clientOrigin(): string | undefined {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || undefined;
}

export function FlyerWorkspace({
  restaurant,
  dishes,
  categories,
  packagePrice = 0,
  preselectedMainIds,
  preselectedSideIds,
  initialHeadline,
  sidesTitle,
  fromToday,
  sourceLabel,
  todayPreselectedIds,
  initialRefId,
}: Props) {
  const [aiBackgroundUrl, setAiBackgroundUrl] = useState<string | null>(null);
  const [overlayPatch, setOverlayPatch] = useState<FlyerOverlayPatch | null>(
    null,
  );
  const [aspectRatio, setAspectRatio] = useState<FlyerAiAspectRatio>("4:5");
  const [referenceFromLibrary, setReferenceFromLibrary] = useState<
    string | null
  >(null);
  const [classicOpen, setClassicOpen] = useState(false);
  const [classicForced, setClassicForced] = useState(false);
  const [aiRemaining, setAiRemaining] = useState<number | null>(null);

  const menuUrl = publicMenuUrl(restaurant.slug, clientOrigin());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/ai/generate-image");
        const json = (await res.json()) as {
          remaining?: number;
          total?: number;
        };
        if (!res.ok || cancelled) return;
        const remaining = json.remaining ?? 0;
        setAiRemaining(remaining);
        if (remaining === 0) {
          setClassicForced(true);
          setClassicOpen(true);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialRefId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/flyers");
        const json = (await res.json()) as {
          flyers?: { id: string; png_path: string | null }[];
        };
        if (!res.ok || cancelled) return;
        const hit = (json.flyers ?? []).find((f) => f.id === initialRefId);
        if (hit?.png_path) {
          setReferenceFromLibrary(hit.png_path);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialRefId]);

  const onQuotaChange = useCallback(
    (quota: { remaining: number; total: number }) => {
      setAiRemaining(quota.remaining);
      if (quota.remaining === 0) {
        setClassicForced(true);
        setClassicOpen(true);
      }
    },
    [],
  );

  const classicEnabled = classicOpen || classicForced || aiRemaining === 0;

  return (
    <>
      <FlyerAiPanel
        restaurant={{
          id: restaurant.id,
          slug: restaurant.slug,
          name: restaurant.name,
          slogan: restaurant.slogan,
          business_type: restaurant.business_type,
          logo_url: restaurant.logo_url,
          phone_whatsapp: restaurant.phone_whatsapp,
          instagram_url: restaurant.instagram_url,
          facebook_url: restaurant.facebook_url,
          free_shipping: restaurant.free_shipping,
          shipping_cost: restaurant.shipping_cost,
          offers_delivery: restaurant.offers_delivery,
        }}
        dishes={dishes}
        categories={categories}
        todayPreselectedIds={todayPreselectedIds}
        menuPublicUrl={menuUrl}
        initialReferenceUrl={referenceFromLibrary}
        aspectRatio={aspectRatio}
        onAspectRatioChange={setAspectRatio}
        onApplyBackground={setAiBackgroundUrl}
        onApplyOverlays={setOverlayPatch}
        onQuotaChange={onQuotaChange}
      />

      <FlyerLibraryPanel
        restaurantId={restaurant.id}
        onUseAsReference={(f) => {
          if (f.png_path) setReferenceFromLibrary(f.png_path);
        }}
      />

      <div
        className={cn(
          "mb-6 rounded-2xl border border-black/10 bg-surface",
          !classicEnabled && "opacity-70",
        )}
      >
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          onClick={() => {
            if (!classicOpen && !classicForced && aiRemaining !== 0) {
              setClassicOpen(true);
            } else {
              setClassicOpen((o) => !o);
            }
          }}
        >
          <div>
            <p className="text-sm font-semibold">Generar Flyer (clásico)</p>
            <p className="text-xs text-muted">
              {aiRemaining === 0
                ? "Sin cupo IA — estudio clásico disponible"
                : classicOpen
                  ? "Edición avanzada y export compuesto"
                  : "Plegado · ábrelo para editar overlays y exportar"}
            </p>
          </div>
          <span className="text-xs font-medium text-brand">
            {classicOpen ? "Ocultar" : "Abrir"}
          </span>
        </button>

        {classicOpen ? (
          <div className="border-t border-black/5 p-4">
            {!classicEnabled ? (
              <p className="mb-3 text-sm text-muted">
                El estudio clásico estaba deshabilitado. Ya está activo.
              </p>
            ) : null}
            <FlyerStudio
              restaurant={restaurant}
              dishes={dishes}
              categories={categories}
              packagePrice={packagePrice}
              preselectedMainIds={
                overlayPatch?.selectedDishIds?.length
                  ? overlayPatch.selectedDishIds
                  : preselectedMainIds
              }
              preselectedSideIds={preselectedSideIds}
              initialHeadline={
                overlayPatch?.headline ?? initialHeadline
              }
              sidesTitle={sidesTitle}
              fromToday={fromToday}
              sourceLabel={sourceLabel}
              aiBackgroundUrl={aiBackgroundUrl}
              onClearAiBackground={() => setAiBackgroundUrl(null)}
              menuPublicUrl={menuUrl}
              libraryExternal
              enabled
              externalAspect={aspectRatio}
              overlayPatch={overlayPatch}
              onOverlayPatchConsumed={() => setOverlayPatch(null)}
            />
          </div>
        ) : (
          <div className="border-t border-black/5 px-4 py-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setClassicOpen(true)}
            >
              Abrir estudio clásico
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
