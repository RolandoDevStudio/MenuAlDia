import type { Dish } from "@/lib/types";
import type { FlyerThemePackId } from "@/lib/flyer-themes";

export type { FlyerThemePackId };

export type FlyerAspect = "story_9_16" | "feed_4_5" | "square_1_1" | "landscape_16_9";

export type FlyerLayoutPreset = "hero_list" | "grid_2x2" | "text_only";

export type FlyerPriceMode = "package" | "per_item";

export type FlyerTextScale = "sm" | "md" | "lg";

export type FlyerLogoScale = "off" | "sm" | "md" | "lg";

export type FlyerBullet = "check" | "star";

export type FlyerPriceBadge = "circle" | "ribbon";

export type FlyerFrameStyle = "rect" | "polaroid";

export type FlyerObjectFit = "cover" | "contain";

export type FlyerEditorOptions = {
  aspect: FlyerAspect;
  layout: FlyerLayoutPreset;
  priceMode: FlyerPriceMode;
  textScale: FlyerTextScale;
  logoScale: FlyerLogoScale;
  bullet: FlyerBullet;
  priceBadge: FlyerPriceBadge;
  frameStyle: FlyerFrameStyle;
  objectFit: FlyerObjectFit;
  themePack: FlyerThemePackId;
  showSides: boolean;
  showFreeShipping: boolean;
  showWhatsapp: boolean;
  weekdayLabel: string;
  headline: string;
  subtitle: string;
};

export const FLYER_ASPECT_SIZE: Record<FlyerAspect, { w: number; h: number }> = {
  story_9_16: { w: 1080, h: 1920 },
  feed_4_5: { w: 1080, h: 1350 },
  square_1_1: { w: 1080, h: 1080 },
  landscape_16_9: { w: 1920, h: 1080 },
};

export const WEEKDAYS_ES = [
  "DOMINGO",
  "LUNES",
  "MARTES",
  "MIÉRCOLES",
  "JUEVES",
  "VIERNES",
  "SÁBADO",
] as const;

export function todayWeekdayEs(date = new Date()): string {
  return WEEKDAYS_ES[date.getDay()];
}

export function defaultFlyerOptions(partial?: Partial<FlyerEditorOptions>): FlyerEditorOptions {
  return {
    aspect: "feed_4_5",
    layout: "grid_2x2",
    priceMode: "package",
    textScale: "md",
    logoScale: "md",
    bullet: "check",
    priceBadge: "circle",
    frameStyle: "rect",
    objectFit: "cover",
    themePack: "fonda_tradicional",
    showSides: true,
    showFreeShipping: true,
    showWhatsapp: true,
    weekdayLabel: todayWeekdayEs(),
    headline: "ESPECIALES DE HOY",
    subtitle: "",
    ...partial,
  };
}

export type FlyerDishSnap = {
  id: string;
  name: string;
  photo_url: string | null;
  price: number;
  is_side: boolean;
};

export function dishToSnap(d: Dish): FlyerDishSnap {
  return {
    id: d.id,
    name: d.name,
    photo_url: d.photo_url,
    price: Number(d.price),
    is_side: Boolean(d.is_side),
  };
}

export function formatWhatsappDisplay(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return phone?.trim() || "";
  const local = digits.slice(-10);
  return `${local.slice(0, 2)} ${local.slice(2, 6)} ${local.slice(6)}`;
}
