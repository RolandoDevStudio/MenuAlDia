import type { CSSProperties } from "react";

export type PhotoFrame =
  | "rounded_modern"
  | "rustic_ring"
  | "floating_shadow"
  | "circle_avatar";

export type ThemeFont = "display_bebas" | "sans_clean";

export interface ThemeColors {
  primary: string;
  bg: string;
  card: string;
  text: string;
}

export type BackgroundOverlay = "soft" | "medium" | "strong";

export interface ThemeConfig {
  preset: string;
  colors: ThemeColors;
  font: ThemeFont;
  photoFrame: PhotoFrame;
  bannerUrl?: string | null;
  /** Preview when sharing the public menu link (WhatsApp / social) */
  ogImageUrl?: string | null;
  backgroundImageUrl?: string | null;
  useBackgroundImage?: boolean;
  backgroundOverlay?: BackgroundOverlay;
  /** 0–100: which slice of the wallpaper shows on mobile (cover) */
  backgroundFocusX?: number;
  backgroundFocusY?: number;
  /** 0–100: which slice of the wallpaper shows on desktop (cover) */
  backgroundDesktopFocusX?: number;
  backgroundDesktopFocusY?: number;
}

export const DEFAULT_THEME: ThemeConfig = {
  preset: "fonda_calida",
  colors: {
    primary: "#c45c26",
    bg: "#faf6f1",
    card: "#ffffff",
    text: "#1c1410",
  },
  font: "display_bebas",
  photoFrame: "rounded_modern",
  bannerUrl: null,
  ogImageUrl: null,
  backgroundImageUrl: null,
  useBackgroundImage: false,
  backgroundOverlay: "medium",
  backgroundFocusX: 50,
  backgroundFocusY: 50,
  backgroundDesktopFocusX: 50,
  backgroundDesktopFocusY: 50,
};

export const THEME_PRESETS: Record<string, ThemeConfig> = {
  fonda_calida: {
    ...DEFAULT_THEME,
    preset: "fonda_calida",
    colors: {
      primary: "#c45c26",
      bg: "#faf6f1",
      card: "#ffffff",
      text: "#1c1410",
    },
    font: "display_bebas",
    photoFrame: "rounded_modern",
  },
  estetica_suave: {
    ...DEFAULT_THEME,
    preset: "estetica_suave",
    colors: {
      primary: "#8b5a6b",
      bg: "#faf7f8",
      card: "#ffffff",
      text: "#2a1f24",
    },
    font: "display_bebas",
    photoFrame: "circle_avatar",
  },
  moderno_verde: {
    ...DEFAULT_THEME,
    preset: "moderno_verde",
    colors: {
      primary: "#2f6b4f",
      bg: "#f4f7f5",
      card: "#ffffff",
      text: "#14201a",
    },
    font: "sans_clean",
    photoFrame: "floating_shadow",
  },
  rustico_cafe: {
    ...DEFAULT_THEME,
    preset: "rustico_cafe",
    colors: {
      primary: "#6b3e26",
      bg: "#f3ebe3",
      card: "#fff8f0",
      text: "#1c1410",
    },
    font: "display_bebas",
    photoFrame: "rustic_ring",
  },
};

export const PRESET_LABELS: Record<string, string> = {
  fonda_calida: "Restaurante cálido",
  estetica_suave: "Estética suave",
  moderno_verde: "Moderno verde",
  rustico_cafe: "Rústico café",
};

export const BACKGROUND_OVERLAY_LABELS: Record<BackgroundOverlay, string> = {
  soft: "Suave",
  medium: "Medio",
  strong: "Fuerte",
};

/** Theme-color veil over the photo (from% → to%). */
export const BACKGROUND_OVERLAY: Record<
  BackgroundOverlay,
  { from: number; to: number }
> = {
  soft: { from: 18, to: 34 },
  medium: { from: 35, to: 58 },
  strong: { from: 55, to: 78 },
};

export function parseBackgroundOverlay(raw: unknown): BackgroundOverlay {
  return raw === "soft" || raw === "strong" ? raw : "medium";
}

export function parseFocusPercent(raw: unknown, fallback = 50): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

export const FRAME_LABELS: Record<PhotoFrame, string> = {
  rounded_modern: "Redondeado moderno",
  rustic_ring: "Marco rústico",
  floating_shadow: "Sombra flotante",
  circle_avatar: "Circular",
};

export function parseThemeConfig(raw: unknown): ThemeConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_THEME };
  const o = raw as Partial<ThemeConfig>;
  const colors = {
    ...DEFAULT_THEME.colors,
    ...(o.colors ?? {}),
  };
  return {
    preset: o.preset ?? DEFAULT_THEME.preset,
    colors,
    font: (o.font as ThemeFont) ?? DEFAULT_THEME.font,
    photoFrame: (o.photoFrame as PhotoFrame) ?? DEFAULT_THEME.photoFrame,
    bannerUrl: o.bannerUrl ?? null,
    ogImageUrl: o.ogImageUrl ?? null,
    backgroundImageUrl: o.backgroundImageUrl ?? null,
    useBackgroundImage: Boolean(o.useBackgroundImage),
    backgroundOverlay: parseBackgroundOverlay(o.backgroundOverlay),
    backgroundFocusX: parseFocusPercent(o.backgroundFocusX),
    backgroundFocusY: parseFocusPercent(o.backgroundFocusY),
    backgroundDesktopFocusX: parseFocusPercent(o.backgroundDesktopFocusX),
    backgroundDesktopFocusY: parseFocusPercent(o.backgroundDesktopFocusY),
  };
}

export function themeToCssVars(theme: ThemeConfig): CSSProperties {
  return {
    ["--color-primary" as string]: theme.colors.primary,
    ["--color-bg" as string]: theme.colors.bg,
    ["--color-card" as string]: theme.colors.card,
    ["--color-text" as string]: theme.colors.text,
    ["--brand" as string]: theme.colors.primary,
    ["--brand-dark" as string]: `color-mix(in srgb, ${theme.colors.primary} 72%, black)`,
    ["--background" as string]: theme.colors.bg,
    ["--surface" as string]: theme.colors.card,
    ["--foreground" as string]: theme.colors.text,
    ["--ring" as string]: theme.colors.primary,
  } as CSSProperties;
}

/** Default wash when there is no photo. Photo uses a viewport-fixed layer. */
export function publicMenuBackgroundStyle(theme: ThemeConfig): CSSProperties {
  if (theme.useBackgroundImage && theme.backgroundImageUrl) {
    return { backgroundColor: theme.colors.bg };
  }
  return {
    background: `radial-gradient(ellipse 90% 50% at 10% 0%, color-mix(in srgb, ${theme.colors.primary} 28%, transparent) 0%, transparent 55%), radial-gradient(ellipse 70% 40% at 100% 10%, color-mix(in srgb, ${theme.colors.primary} 18%, transparent) 0%, transparent 50%), linear-gradient(180deg, var(--color-bg) 0%, color-mix(in srgb, var(--color-bg) 85%, ${theme.colors.primary}) 100%)`,
  };
}

export function photoFrameClass(frame: PhotoFrame): string {
  switch (frame) {
    case "rustic_ring":
      return "rounded-xl ring-4 ring-[#6b3e26]/40 object-cover";
    case "floating_shadow":
      return "rounded-2xl shadow-xl object-cover";
    case "circle_avatar":
      return "rounded-full object-cover aspect-square";
    case "rounded_modern":
    default:
      return "rounded-2xl object-cover";
  }
}
