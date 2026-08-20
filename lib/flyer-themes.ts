/**
 * Flyer visual theme packs (C3).
 * Skins the Fórmula Fonda layout via tokens — not extra freeform controls.
 */

export type FlyerThemePackId = "fonda_tradicional" | "urbano_pizarra";

export type FlyerThemePack = {
  id: FlyerThemePackId;
  label: string;
  description: string;
  /** Solid fallback for html-to-image backgroundColor */
  exportBg: string;
  outerGradient: string;
  /** Optional SVG/CSS texture overlay (opacity applied separately) */
  textureSvg: string;
  textureOpacity: number;
  panelBg: string;
  panelBorder: string;
  panelRadius: number;
  text: string;
  muted: string;
  accent: string;
  accentDeep: string;
  sealBg: string;
  sealText: string;
  cardBg: string;
  cardBorder: string;
  placeholderBg: string;
  priceBg: string;
  priceShadow: string;
  waBg: string;
  waText: string;
  titleStyle: "ribbon" | "chalk";
  ribbonBg: string;
  ribbonText: string;
  photoFilter: string;
  displayFont: string;
  bodyFont: string;
  weekdayPill: "filled" | "outline_chalk";
};

const PAPER_GRAIN = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">
    <filter id="n">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#n)" opacity="0.55"/>
  </svg>`,
);

const CHALK_GRAIN = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
    <filter id="n">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#n)" opacity="0.7"/>
  </svg>`,
);

export const FLYER_THEME_PACKS: Record<FlyerThemePackId, FlyerThemePack> = {
  fonda_tradicional: {
    id: "fonda_tradicional",
    label: "Fonda tradicional",
    description: "Papel cálido, listón y sellos de mercado",
    exportBg: "#f0c48a",
    outerGradient:
      "linear-gradient(165deg, #f7e6c8 0%, #f0c48a 38%, #e8a05a 70%, #c45c26 100%)",
    textureSvg: `url("data:image/svg+xml,${PAPER_GRAIN}")`,
    textureOpacity: 0.22,
    panelBg: "rgba(255,248,235,0.94)",
    panelBorder: "rgba(139,58,20,0.4)",
    panelRadius: 40,
    text: "#1c1410",
    muted: "#8b3a14",
    accent: "#c45c26",
    accentDeep: "#8b3a14",
    sealBg: "#2f6b4f",
    sealText: "#ffffff",
    cardBg: "#ffffff",
    cardBorder: "rgba(139,58,20,0.28)",
    placeholderBg: "#f3e0c4",
    priceBg: "#c45c26",
    priceShadow: "#8b3a14",
    waBg: "rgba(37,211,102,0.15)",
    waText: "#128C7E",
    titleStyle: "ribbon",
    ribbonBg: "#c45c26",
    ribbonText: "#fff8eb",
    photoFilter: "saturate(1.08) contrast(1.04)",
    displayFont: "var(--font-display), sans-serif",
    bodyFont: "var(--font-sans), system-ui, sans-serif",
    weekdayPill: "filled",
  },
  urbano_pizarra: {
    id: "urbano_pizarra",
    label: "Urbano / pizarra",
    description: "Tiza sobre negro, look street-food",
    exportBg: "#1a1a1a",
    outerGradient:
      "linear-gradient(160deg, #2a2a2a 0%, #1a1a1a 45%, #0f0f0f 100%)",
    textureSvg: `url("data:image/svg+xml,${CHALK_GRAIN}")`,
    textureOpacity: 0.35,
    panelBg: "rgba(28,28,28,0.88)",
    panelBorder: "rgba(245,240,230,0.35)",
    panelRadius: 24,
    text: "#f5f0e6",
    muted: "#d4cbb8",
    accent: "#f0c14a",
    accentDeep: "#e8a020",
    sealBg: "#f0c14a",
    sealText: "#1a1a1a",
    cardBg: "rgba(255,255,255,0.06)",
    cardBorder: "rgba(245,240,230,0.45)",
    placeholderBg: "#2e2e2e",
    priceBg: "#f0c14a",
    priceShadow: "#a07820",
    waBg: "rgba(37,211,102,0.18)",
    waText: "#6dffb0",
    titleStyle: "chalk",
    ribbonBg: "transparent",
    ribbonText: "#f5f0e6",
    photoFilter: "contrast(1.12) saturate(0.92) brightness(0.95)",
    displayFont: "var(--font-display), sans-serif",
    bodyFont: "var(--font-sans), system-ui, sans-serif",
    weekdayPill: "outline_chalk",
  },
};

export const FLYER_THEME_LIST = Object.values(FLYER_THEME_PACKS);

export function getFlyerTheme(id: FlyerThemePackId | string | undefined): FlyerThemePack {
  if (id && id in FLYER_THEME_PACKS) {
    return FLYER_THEME_PACKS[id as FlyerThemePackId];
  }
  return FLYER_THEME_PACKS.fonda_tradicional;
}
