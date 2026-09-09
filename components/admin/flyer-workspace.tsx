"use client";

import { useState } from "react";
import { FlyerAiPanel } from "@/components/admin/flyer-ai-panel";
import { FlyerStudio } from "@/components/flyer/flyer-studio";
import { publicMenuUrl } from "@/lib/site-url";
import type { Dish, Restaurant } from "@/lib/types";

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
}: Props) {
  const [aiBackgroundUrl, setAiBackgroundUrl] = useState<string | null>(null);
  const menuUrl = publicMenuUrl(restaurant.slug, clientOrigin());

  return (
    <>
      <FlyerAiPanel
        restaurant={{
          id: restaurant.id,
          slug: restaurant.slug,
          name: restaurant.name,
          slogan: restaurant.slogan,
          business_type: restaurant.business_type,
        }}
        dishes={dishes}
        categories={categories}
        todayPreselectedIds={todayPreselectedIds}
        onApplyBackground={setAiBackgroundUrl}
      />
      <FlyerStudio
        restaurant={restaurant}
        dishes={dishes}
        categories={categories}
        packagePrice={packagePrice}
        preselectedMainIds={preselectedMainIds}
        preselectedSideIds={preselectedSideIds}
        initialHeadline={initialHeadline}
        sidesTitle={sidesTitle}
        fromToday={fromToday}
        sourceLabel={sourceLabel}
        aiBackgroundUrl={aiBackgroundUrl}
        onClearAiBackground={() => setAiBackgroundUrl(null)}
        menuPublicUrl={menuUrl}
      />
    </>
  );
}
