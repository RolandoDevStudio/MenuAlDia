"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type FlyerPreview = {
  id: string;
  title: string;
  png_path: string | null;
};

/** Soft promo strip when landing from /{slug}/p/{flyerId} → ?flyer= */
export function FlyerPromoBanner({
  restaurantId,
}: {
  restaurantId: string;
}) {
  const search = useSearchParams();
  const router = useRouter();
  const flyerId = search.get("flyer");
  const [flyer, setFlyer] = useState<FlyerPreview | null>(null);
  const [open, setOpen] = useState(Boolean(flyerId));

  useEffect(() => {
    if (!flyerId) {
      setFlyer(null);
      setOpen(false);
      return;
    }
    setOpen(true);
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("flyers")
        .select("id, title, png_path, is_active, expires_at, restaurant_id")
        .eq("id", flyerId)
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      if (
        !data?.png_path ||
        !data.is_active ||
        (data.expires_at && new Date(data.expires_at).getTime() < Date.now())
      ) {
        setFlyer(null);
        return;
      }
      setFlyer({
        id: data.id,
        title: data.title,
        png_path: data.png_path,
      });
      void fetch("/api/public/flyer-landing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          flyer_id: data.id,
        }),
        keepalive: true,
      }).catch(() => {});
    })();
  }, [flyerId, restaurantId]);

  if (!open || !flyer?.png_path) return null;

  function dismiss() {
    setOpen(false);
    const params = new URLSearchParams(search.toString());
    params.delete("flyer");
    const q = params.toString();
    router.replace(q ? `?${q}` : "?", { scroll: false });
  }

  return (
    <div className="sticky top-0 z-30 border-b border-black/10 bg-surface/95 px-3 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={flyer.png_path}
          alt=""
          className="h-14 w-12 shrink-0 rounded object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {flyer.title || "Promoción"}
          </p>
          <p className="text-[11px] text-muted">
            Explora el menú y agrega lo que te guste
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-11 min-w-11"
          onClick={dismiss}
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
