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

export interface ThemeConfig {
  preset: string;
  colors: ThemeColors;
  font: ThemeFont;
  photoFrame: PhotoFrame;
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
};

export const THEME_PRESETS: Record<string, ThemeConfig> = {
  fonda_calida: {
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
  fonda_calida: "Fonda cálida",
  estetica_suave: "Estética suave",
  moderno_verde: "Moderno verde",
  rustico_cafe: "Rústico café",
};

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
