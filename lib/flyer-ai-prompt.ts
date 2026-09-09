import { labelsFor, normalizeBusinessType } from "@/lib/business-labels";
import type { FlyerAspect } from "@/lib/flyer-types";
import type { AiImagePreset } from "@/lib/ai-schemas";
import type { BusinessType } from "@/lib/types";

export type ProductImageSource =
  | "real_catalog"
  | "ai_generated"
  | "none_text_only";

/** AI wizard layout presets (distinct from classic studio FlyerLayoutPreset). */
export type FlyerLayoutPreset =
  | "fonda_menu_dia"
  | "combo_matrix_promos"
  | "hero_star_product"
  | "marisqueria_event_promo"
  | "services_grid"
  | "lifestyle_clean";

export type FlyerAiAspectRatio = "4:5" | "9:16" | "1:1";

export type FlyerMarketingOpts = {
  includeLogo: boolean;
  includeName: boolean;
  includeSlogan: boolean;
  includeWhatsapp: boolean;
  includeInstagram: boolean;
  includeFacebook: boolean;
  includeQr: boolean;
  includeDishNames: boolean;
  includeCategories: boolean;
  includePrices: boolean;
  includeEmojis: boolean;
  includeFreeShipping: boolean;
  includeIncludesTag: boolean;
  includeUnitTag: boolean;
  includeDayTag: boolean;
  includeDecorativeElements: boolean;
  includePriceBadges: boolean;
  includePhoneWhatsapp: boolean;
};

export type SimilarityBand = "inspiration" | "structure" | "template";

export type LayoutSlotKind = "hero" | "thumb" | "grid" | "card" | "wide";

export type LayoutPresetSlots = {
  description: string;
  slots: { kind: LayoutSlotKind; count: number; note?: string }[];
  geometryHint: string;
  negativeSpaceHint: string;
};

export const ANTI_GHOST_TEXT =
  "Do not render fake text, logos, phone numbers, prices, or gibberish lettering. Generate only textures, clean banners/shapes, and empty negative space for typography overlays.";

export const LAYOUT_PRESET_SLOTS: Record<FlyerLayoutPreset, LayoutPresetSlots> =
  {
    fonda_menu_dia: {
      description: "Columna derecha con thumbs; izquierda lista / tipografía",
      slots: [
        { kind: "thumb", count: 3, note: "Columna derecha apilada" },
      ],
      geometryHint:
        "Right column: 2–3 stacked photo slots. Left/center: clean empty band for text list overlays.",
      negativeSpaceHint:
        "Leave a clear vertical text column on the left (~40% width) and top/bottom margins for logo and contact.",
    },
    combo_matrix_promos: {
      description: "Grilla 2×2 hasta 2×4 de thumbs + badges de precio",
      slots: [{ kind: "grid", count: 4, note: "Matriz de productos" }],
      geometryHint:
        "Even grid of product photo slots (2×2 up to 2×4). Leave corner/edge room for price badges.",
      negativeSpaceHint:
        "Keep top banner strip and bottom footer bar empty for overlays; small gaps between grid cells.",
    },
    hero_star_product: {
      description: "1 foto grande del primer ítem; resto opcional pequeño",
      slots: [
        { kind: "hero", count: 1 },
        { kind: "thumb", count: 2, note: "Opcional" },
      ],
      geometryHint:
        "One large hero product photo (dominant). Optional small thumbs. Generous empty areas around for typography.",
      negativeSpaceHint:
        "Strong negative space top and bottom for title, logo, and CTA; do not fill the whole frame with product.",
    },
    marisqueria_event_promo: {
      description: "Bloque destacado 2×1 + thumbs laterales",
      slots: [
        { kind: "wide", count: 1, note: "Bloque 2×1" },
        { kind: "thumb", count: 2, note: "Laterales opcionales" },
      ],
      geometryHint:
        "Wide featured photo block (approx 2×1) plus optional side thumbs. Festive/promo energy without clutter.",
      negativeSpaceHint:
        "Reserve a bold header band and a lower strip for event copy and contact.",
    },
    services_grid: {
      description: "Tarjetas 2×2 (foto o placeholder)",
      slots: [{ kind: "card", count: 4 }],
      geometryHint:
        "Four card-shaped slots in a 2×2 grid with soft frames or floating panels; airy professional look.",
      negativeSpaceHint:
        "Leave card interiors slightly empty for icon/photo + label overlays; top header and bottom CTA free.",
    },
    lifestyle_clean: {
      description: "1–2 fotos grandes con mucho aire",
      slots: [{ kind: "hero", count: 2, note: "Máximo 1–2" }],
      geometryHint:
        "1–2 large lifestyle photos with lots of breathing room; minimal decorative shapes.",
      negativeSpaceHint:
        "Maximum negative space for elegant typography; soft vignette edges OK; avoid dense patterns.",
    },
  };

const PRESET_ORDER: Record<BusinessType, FlyerLayoutPreset[]> = {
  restaurante: [
    "fonda_menu_dia",
    "combo_matrix_promos",
    "hero_star_product",
    "marisqueria_event_promo",
    "lifestyle_clean",
    "services_grid",
  ],
  servicios: [
    "services_grid",
    "lifestyle_clean",
    "hero_star_product",
    "combo_matrix_promos",
    "fonda_menu_dia",
    "marisqueria_event_promo",
  ],
  productos: [
    "combo_matrix_promos",
    "hero_star_product",
    "lifestyle_clean",
    "fonda_menu_dia",
    "services_grid",
    "marisqueria_event_promo",
  ],
};

export function layoutPresetsForBusinessType(
  businessType: string | null | undefined,
): FlyerLayoutPreset[] {
  const key = normalizeBusinessType(businessType);
  return PRESET_ORDER[key] ?? PRESET_ORDER.restaurante;
}

export function layoutPresetLabel(
  preset: FlyerLayoutPreset,
  businessType?: string | null,
): { title: string; hint: string } {
  const giro = labelsFor(businessType);
  const map: Record<FlyerLayoutPreset, { title: string; hint: string }> = {
    fonda_menu_dia: {
      title: `Menú del día`,
      hint: `Lista + fotos de ${giro.dishes.toLowerCase()}`,
    },
    combo_matrix_promos: {
      title: `Matriz / ${giro.combos}`,
      hint: "Grilla de promos con precios",
    },
    hero_star_product: {
      title: `${giro.dish} estrella`,
      hint: `Una foto grande del ${giro.dish.toLowerCase()} principal`,
    },
    marisqueria_event_promo: {
      title: "Evento / promo",
      hint: "Bloque destacado tipo festejo",
    },
    services_grid: {
      title: `Grilla de ${giro.dishes.toLowerCase()}`,
      hint: "Tarjetas 2×2 limpias",
    },
    lifestyle_clean: {
      title: "Lifestyle limpio",
      hint: "Pocas fotos, mucho aire",
    },
  };
  return map[preset];
}

export function similarityBand(similarity: number): SimilarityBand {
  const n = Math.max(0, Math.min(100, Math.round(similarity)));
  if (n <= 30) return "inspiration";
  if (n <= 70) return "structure";
  return "template";
}

export function similarityBandLabel(band: SimilarityBand): string {
  if (band === "inspiration") return "Inspiración";
  if (band === "structure") return "Estructura";
  return "Plantilla";
}

export function defaultMarketingOpts(
  partial?: Partial<FlyerMarketingOpts>,
): FlyerMarketingOpts {
  return {
    includeLogo: true,
    includeName: true,
    includeSlogan: true,
    includeWhatsapp: true,
    includeInstagram: false,
    includeFacebook: false,
    includeQr: false,
    includeDishNames: true,
    includeCategories: false,
    includePrices: true,
    includeEmojis: false,
    includeFreeShipping: false,
    includeIncludesTag: false,
    includeUnitTag: false,
    includeDayTag: true,
    includeDecorativeElements: true,
    includePriceBadges: true,
    includePhoneWhatsapp: true,
    ...partial,
  };
}

export function aspectRatioToFlyerAspect(
  ratio: FlyerAiAspectRatio,
): FlyerAspect {
  if (ratio === "9:16") return "story_9_16";
  if (ratio === "1:1") return "square_1_1";
  return "feed_4_5";
}

export function flyerAspectToAiRatio(aspect: FlyerAspect): FlyerAiAspectRatio {
  if (aspect === "story_9_16") return "9:16";
  if (aspect === "square_1_1") return "1:1";
  return "4:5";
}

export function aspectRatioToImagePreset(
  ratio: FlyerAiAspectRatio,
): AiImagePreset {
  if (ratio === "9:16") return "flyer_story";
  if (ratio === "1:1") return "flyer_square";
  return "flyer";
}

/** Map AI layout preset → classic studio canvas layout. */
export function mapAiLayoutToStudioLayout(
  preset: FlyerLayoutPreset,
  productImageSource: ProductImageSource,
): "hero_list" | "grid_2x2" | "text_only" {
  if (productImageSource === "none_text_only") return "text_only";
  if (
    preset === "combo_matrix_promos" ||
    preset === "services_grid"
  ) {
    return "grid_2x2";
  }
  if (preset === "fonda_menu_dia" && productImageSource === "real_catalog") {
    return "hero_list";
  }
  if (
    preset === "hero_star_product" ||
    preset === "marisqueria_event_promo" ||
    preset === "lifestyle_clean" ||
    preset === "fonda_menu_dia"
  ) {
    return "hero_list";
  }
  return "grid_2x2";
}

export type BuildFlyerCompositionBriefOpts = {
  mode: "menu" | "business" | "free";
  title?: string;
  userPrompt?: string;
  dishNames?: string[];
  productImageSource: ProductImageSource;
  layoutPreset: FlyerLayoutPreset;
  marketing: Partial<FlyerMarketingOpts>;
  similarity: number;
  aspectRatio: FlyerAiAspectRatio;
  businessType?: string | null;
  restaurantName?: string;
  slogan?: string;
  /** Filtered / raw style brief from Flash vision */
  referenceBrief?: string | null;
  referencePalette?: string | null;
  referenceStructures?: string | null;
  referenceNegativeSpace?: string | null;
};

function filterReferenceByBand(
  band: SimilarityBand,
  opts: BuildFlyerCompositionBriefOpts,
): string {
  const brief = (opts.referenceBrief ?? "").trim();
  const palette = (opts.referencePalette ?? "").trim();
  const structures = (opts.referenceStructures ?? "").trim();
  const neg = (opts.referenceNegativeSpace ?? "").trim();
  if (!brief && !palette && !structures) return "";

  if (band === "inspiration") {
    const parts = [
      palette ? `Palette/mood inspiration only: ${palette}.` : "",
      brief ? `Loose vibe (not composition): ${brief}.` : "",
    ].filter(Boolean);
    return parts.join(" ") || `Loose style inspiration: ${brief}`;
  }
  if (band === "structure") {
    const parts = [
      brief ? `Style + flexible structure: ${brief}.` : "",
      palette ? `Palette: ${palette}.` : "",
      structures
        ? `Adapt these structural frames flexibly: ${structures}.`
        : "",
      neg ? `Respect negative space ideas: ${neg}.` : "",
    ].filter(Boolean);
    return parts.join(" ");
  }
  // template
  const parts = [
    brief ? `Match this reference closely: ${brief}.` : "",
    palette ? `Palette: ${palette}.` : "",
    structures
      ? `Replicate structural frames almost literally: ${structures}.`
      : "",
    neg ? `Negative space layout: ${neg}.` : "",
    "Keep composition, banners, and divisions nearly template-faithful.",
  ].filter(Boolean);
  return parts.join(" ");
}

function marketingLines(
  m: Partial<FlyerMarketingOpts>,
  labels: ReturnType<typeof labelsFor>,
): string {
  const on: string[] = [];
  const off: string[] = [];
  const push = (cond: boolean | undefined, label: string) => {
    if (cond) on.push(label);
    else if (cond === false) off.push(label);
  };
  push(m.includeLogo, "logo slot");
  push(m.includeName, "business name");
  push(m.includeSlogan, "slogan");
  push(m.includeWhatsapp || m.includePhoneWhatsapp, "WhatsApp / phone");
  push(m.includeInstagram, "Instagram");
  push(m.includeFacebook, "Facebook");
  push(m.includeQr, "QR");
  push(m.includeDishNames, `${labels.dishes.toLowerCase()} names`);
  push(m.includeCategories, `${labels.categories.toLowerCase()}`);
  push(m.includePrices || m.includePriceBadges, "price badges");
  push(m.includeEmojis, "emoji accents");
  push(m.includeFreeShipping, "free shipping badge");
  push(m.includeIncludesTag, "includes tag");
  push(m.includeUnitTag, "unit / kg tag");
  push(m.includeDayTag, "day-of-week tag");
  push(m.includeDecorativeElements, "decorative shapes");

  const parts: string[] = [];
  if (on.length) {
    parts.push(
      `Leave clean empty regions for real typography overlays: ${on.join(", ")}.`,
    );
  }
  if (off.length) {
    parts.push(`Do not reserve space specifically for: ${off.join(", ")}.`);
  }
  return parts.join(" ");
}

function productSourceLine(
  source: ProductImageSource,
  labels: ReturnType<typeof labelsFor>,
  dishNames: string[],
): string {
  if (source === "none_text_only") {
    return `No product photos — graphic/texture background only for a text-forward flyer about a ${labels.business.toLowerCase()}.`;
  }
  if (source === "real_catalog") {
    return `Product photos will be composited later from the real catalog. Generate background, banners, frames and empty photo slots only — do NOT invent ${labels.dishes.toLowerCase()} or food photography of specific dishes.`;
  }
  // ai_generated
  if (dishNames.length > 0) {
    return `Photorealistic ${labels.dishes.toLowerCase()} of ONLY these selected items: ${dishNames.join(", ")}. Do not invent extra items outside this list.`;
  }
  return `Photorealistic appetizing product photography suitable for a ${labels.business.toLowerCase()} (${labels.dishes.toLowerCase()}), without inventing branded text.`;
}

export function buildFlyerCompositionBrief(
  opts: BuildFlyerCompositionBriefOpts,
): string {
  const labels = labelsFor(opts.businessType);
  const band = similarityBand(opts.similarity ?? 50);
  const slots = LAYOUT_PRESET_SLOTS[opts.layoutPreset];
  const dishNames = (opts.dishNames ?? []).map((d) => d.trim()).filter(Boolean);
  const name = (opts.restaurantName ?? "").trim() || "negocio";
  const slogan = (opts.slogan ?? "").trim();
  const title = (opts.title ?? "").trim();
  const userPrompt = (opts.userPrompt ?? "").trim();

  let modeLine = "";
  if (opts.mode === "menu") {
    modeLine =
      dishNames.length > 0
        ? `Mode: highlight selected ${labels.dishes.toLowerCase()} only (${dishNames.join(", ")}).`
        : `Mode: ${labels.catalog.toLowerCase()} / menu atmosphere for a ${labels.business.toLowerCase()}.`;
  } else if (opts.mode === "business") {
    modeLine = `Mode: brand identity and atmosphere for ${name} (${labels.business}).`;
  } else {
    modeLine = `Mode: creative social flyer for WhatsApp/Instagram for a ${labels.business.toLowerCase()}.`;
  }

  const refLine = filterReferenceByBand(band, opts);
  const bandGuide =
    band === "inspiration"
      ? "Similarity band: inspiration (0–30) — palette and mood only; invent a fresh layout."
      : band === "structure"
        ? "Similarity band: structure (31–70) — keep flexible banners/divisions inspired by the reference."
        : "Similarity band: template (71–100) — follow the reference composition closely.";

  const parts = [
    `Mexican small-business advertising background for ${name} (${labels.business} / business_type vocabulary: use “${labels.dishes.toLowerCase()}” not generic “dishes”).`,
    slogan ? `Brand slogan context (do not paint as text): ${slogan}.` : "",
    title ? `Campaign title context (do not paint as text): ${title}.` : "",
    modeLine,
    `Aspect ratio target: ${opts.aspectRatio}.`,
    `Layout preset “${opts.layoutPreset}”: ${slots.geometryHint}`,
    slots.negativeSpaceHint,
    productSourceLine(opts.productImageSource, labels, dishNames),
    marketingLines(opts.marketing ?? {}, labels),
    bandGuide,
    refLine,
    userPrompt ? `Creative direction from admin: ${userPrompt}` : "",
    ANTI_GHOST_TEXT,
    "Prefer empty negative space on top and bottom edges for logo, title, and contact overlays.",
  ];

  return parts.filter(Boolean).join(" ");
}

export type FlyerMenuItemForPrompt = {
  name: string;
  price?: number | null;
  category?: string | null;
  hasRealPhoto?: boolean;
  isSide?: boolean;
};

export type BuildFinishedFlyerPromptOpts = {
  mode: "menu" | "business" | "free";
  title?: string;
  userPrompt?: string;
  items?: FlyerMenuItemForPrompt[];
  productImageSource: ProductImageSource;
  layoutPreset: FlyerLayoutPreset;
  marketing: Partial<FlyerMarketingOpts>;
  similarity: number;
  aspectRatio: FlyerAiAspectRatio;
  businessType?: string | null;
  restaurantName?: string;
  slogan?: string;
  whatsapp?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  referenceBrief?: string | null;
  referencePalette?: string | null;
  referenceStructures?: string | null;
  referenceNegativeSpace?: string | null;
  /** How many real catalog photos were attached as multimodal parts */
  attachedPhotoCount?: number;
  /** Match reference image structure almost literally */
  followReferenceLayout?: boolean;
};

function formatMxPrice(price: number): string {
  const n = Math.round(price * 100) / 100;
  if (Number.isInteger(n)) return `$${n}`;
  return `$${n.toFixed(2)}`;
}

function finishedCopyLines(
  m: Partial<FlyerMarketingOpts>,
  opts: BuildFinishedFlyerPromptOpts,
  labels: ReturnType<typeof labelsFor>,
): string {
  const name = (opts.restaurantName ?? "").trim() || "Negocio";
  const slogan = (opts.slogan ?? "").trim();
  const title = (opts.title ?? "").trim();
  const allItems = opts.items ?? [];
  const mainsAll = allItems.filter((it) => !it.isSide);
  const sidesAll = allItems.filter((it) => it.isSide);
  const items = [
    ...mainsAll.slice(0, FLYER_COPY_ITEM_SOFT_MAX),
    ...sidesAll.slice(0, 4),
  ];
  const omitted = allItems.length - items.length;
  const lines: string[] = [
    "COPY DECK — SPELLING CRITICAL: paint clean sans-serif Spanish typography. Spell EVERY character EXACTLY as quoted below. No gibberish, no invented brands, no filler like \"Incluye $0\", no extra sides/guarniciones sections, no duplicate menu rows.",
  ];

  if (m.includeName !== false) {
    lines.push(`Business name text (exact): "${name}".`);
  }
  if (m.includeSlogan && slogan) {
    lines.push(`Slogan text (exact): "${slogan}".`);
  }
  if (title) {
    lines.push(`Campaign headline text (exact): "${title}".`);
  }
  if (m.includeDayTag) {
    lines.push("Optional small day-of-week chip is OK if it fits the layout.");
  }

  if (m.includeDishNames !== false && items.length > 0) {
    const formatItem = (it: FlyerMenuItemForPrompt) => {
      const bits = [`"${it.name.trim()}"`];
      if (
        (m.includePrices || m.includePriceBadges) &&
        typeof it.price === "number" &&
        Number.isFinite(it.price) &&
        !it.isSide
      ) {
        bits.push(formatMxPrice(it.price));
      }
      if (m.includeCategories && it.category?.trim()) {
        bits.push(`(${it.category.trim()})`);
      }
      return bits.join(" ");
    };
    const mains = items.filter((it) => !it.isSide);
    const sides = items.filter((it) => it.isSide);
    if (mains.length > 0) {
      lines.push(
        `MAIN ${labels.dishes.toUpperCase()} ONLY (${mains.length}): ${mains.map(formatItem).join("; ")}.`,
      );
    }
    if (sides.length > 0) {
      lines.push(
        `${labels.sides.toUpperCase()} section ONLY — list these as sides/includes, not as priced mains (${sides.length}): ${sides.map(formatItem).join("; ")}. Do not invent extra ${labels.sides.toLowerCase()}.`,
      );
    }
    if (omitted > 0) {
      lines.push(
        `Do NOT add the other ${omitted} catalog items — keep the flyer sparse and readable.`,
      );
    }
  }

  if (m.includeWhatsapp || m.includePhoneWhatsapp) {
    const wa = (opts.whatsapp ?? "").trim();
    if (wa) lines.push(`WhatsApp / phone text (exact): "${wa}".`);
  }
  if (m.includeInstagram) {
    const ig = (opts.instagram ?? "").trim();
    if (ig) lines.push(`Instagram handle text (exact): "${ig}".`);
  }
  if (m.includeFacebook) {
    const fb = (opts.facebook ?? "").trim();
    if (fb) lines.push(`Facebook text (exact): "${fb}".`);
  }
  if (m.includeFreeShipping) {
    lines.push('Include a clear "Envío gratis" badge.');
  }
  if (m.includeIncludesTag) {
    lines.push(
      'Only if space remains: a small "Incluye" tag — never invent "$0" or fake include lists.',
    );
  }
  if (m.includeUnitTag) {
    lines.push("Show unit/kg cues next to prices when relevant.");
  }
  if (m.includeEmojis) {
    lines.push("Subtle food-related emoji accents OK; keep professional.");
  } else {
    lines.push("No emoji clutter.");
  }
  if (m.includeDecorativeElements === false) {
    lines.push("Minimal decoration — prioritize clarity.");
  }
  if (m.includeQr) {
    lines.push(
      "Leave a small empty square near the footer for a QR (do not invent fake QR pixels).",
    );
  }
  if (m.includeLogo) {
    lines.push(
      "Leave a clean circular/square logo slot near the top if no logo image is attached; do not invent a fake logo mark.",
    );
  }

  lines.push(
    `Vocabulary: this is a ${labels.business.toLowerCase()} — prefer “${labels.dishes.toLowerCase()}” framing.`,
  );
  lines.push(
    "Prefer bold sans for dish names and prices (high legibility). Script/display only for short greetings if any.",
  );
  return lines.join(" ");
}

function finishedProductPhotoLine(
  source: ProductImageSource,
  attached: number,
  items: FlyerMenuItemForPrompt[],
  labels: ReturnType<typeof labelsFor>,
  slots: LayoutPresetSlots,
): string {
  if (source === "none_text_only") {
    return `No product photography — typographic/graphic flyer only about this ${labels.business.toLowerCase()}.`;
  }
  if (source === "real_catalog") {
    const missing = items.filter((i) => !i.hasRealPhoto).map((i) => i.name);
    return [
      attached > 0
        ? `Integrate the ${attached} attached real product photo(s) into the layout slots (${slots.geometryHint}). Do not leave empty grey photo frames.`
        : `No real photos attached — generate appetizing photoreal ${labels.dishes.toLowerCase()} for the listed items only.`,
      missing.length
        ? `For items without a real photo, invent photoreal food only for: ${missing.join(", ")}.`
        : "",
      "Do not invent extra menu items beyond the provided list.",
    ]
      .filter(Boolean)
      .join(" ");
  }
  // ai_generated
  const names = items.map((i) => i.name).filter(Boolean);
  if (names.length) {
    return `Generate photorealistic ${labels.dishes.toLowerCase()} of ONLY: ${names.join(", ")}. Place them in layout slots (${slots.geometryHint}). No empty frames.`;
  }
  return `Photorealistic appetizing product photography for a ${labels.business.toLowerCase()}; fill photo slots — no empty frames.`;
}

/** Publish-ready flyer prompt (allows exact business/menu typography). */
export function buildFinishedFlyerPrompt(
  opts: BuildFinishedFlyerPromptOpts,
): string {
  const labels = labelsFor(opts.businessType);
  const band = opts.followReferenceLayout
    ? ("template" as SimilarityBand)
    : similarityBand(opts.similarity ?? 50);
  const slots = LAYOUT_PRESET_SLOTS[opts.layoutPreset];
  const items = opts.items ?? [];
  const userPrompt = (opts.userPrompt ?? "").trim();
  const attached = opts.attachedPhotoCount ?? 0;

  const refOpts: BuildFlyerCompositionBriefOpts = {
    mode: opts.mode,
    title: opts.title,
    userPrompt: opts.userPrompt,
    dishNames: items.map((i) => i.name),
    productImageSource: opts.productImageSource,
    layoutPreset: opts.layoutPreset,
    marketing: opts.marketing,
    similarity: opts.followReferenceLayout ? 85 : opts.similarity,
    aspectRatio: opts.aspectRatio,
    businessType: opts.businessType,
    restaurantName: opts.restaurantName,
    slogan: opts.slogan,
    referenceBrief: opts.referenceBrief,
    referencePalette: opts.referencePalette,
    referenceStructures: opts.referenceStructures,
    referenceNegativeSpace: opts.referenceNegativeSpace,
  };
  const refLine = filterReferenceByBand(band, refOpts);

  const bandGuide = opts.followReferenceLayout
    ? "FOLLOW REFERENCE LAYOUT: replicate the attached reference composition, banners, columns, and photo slots almost literally; replace only the business copy and product photos from the COPY DECK. Keep the same aspect and visual hierarchy."
    : band === "inspiration"
      ? "Similarity: inspiration — use palette/mood only; invent a fresh finished layout. Reference image may be absent."
      : band === "structure"
        ? "Similarity: structure — match banners/divisions loosely from the reference image; replace all content with the exact copy below."
        : "Similarity: template — replicate the reference composition closely; swap in the exact business copy and product photos below.";

  let modeLine = "";
  if (opts.mode === "menu") {
    modeLine = `Mode: finished menu promo highlighting selected ${labels.dishes.toLowerCase()}.`;
  } else if (opts.mode === "business") {
    modeLine = `Mode: finished brand flyer for ${(opts.restaurantName ?? "").trim() || "the business"}.`;
  } else {
    modeLine = `Mode: finished creative social flyer for WhatsApp/Instagram.`;
  }

  const layoutLine = opts.followReferenceLayout
    ? "Layout: match the reference image structure (ignore conflicting preset geometry if they disagree)."
    : `Layout preset “${opts.layoutPreset}”: ${slots.geometryHint}`;

  const parts = [
    `Create one complete Mexican small-business advertising flyer, aspect ${opts.aspectRatio}, ready to post on WhatsApp/Instagram — not a wireframe, not empty photo boxes.`,
    modeLine,
    layoutLine,
    finishedProductPhotoLine(
      opts.productImageSource,
      attached,
      [
        ...items.filter((i) => !i.isSide).slice(0, FLYER_COPY_ITEM_SOFT_MAX),
        ...items.filter((i) => i.isSide).slice(0, 4),
      ],
      labels,
      slots,
    ),
    finishedCopyLines(opts.marketing ?? {}, opts, labels),
    bandGuide,
    refLine,
    userPrompt ? `Creative direction from admin: ${userPrompt}` : "",
    "High-quality print/social design: sharp contrast, readable hierarchy, professional Mexican food-service aesthetic. No watermark. No lorem ipsum. Sparse beats cluttered.",
  ];

  return parts.filter(Boolean).join(" ");
}

/** Whether to attach the reference image bytes for multimodal generation. */
export function shouldAttachReferenceImage(similarity: number): boolean {
  return similarityBand(similarity) !== "inspiration";
}

const ASPECT_TARGETS: { id: FlyerAiAspectRatio; ratio: number }[] = [
  { id: "1:1", ratio: 1 },
  { id: "4:5", ratio: 4 / 5 },
  { id: "9:16", ratio: 9 / 16 },
];

/** Map pixel dimensions to the closest flyer AI aspect ratio. */
export function nearestFlyerAspectRatio(
  width: number,
  height: number,
): FlyerAiAspectRatio {
  if (!width || !height || width <= 0 || height <= 0) return "4:5";
  const r = width / height;
  let best: FlyerAiAspectRatio = "4:5";
  let bestDist = Infinity;
  for (const t of ASPECT_TARGETS) {
    const d = Math.abs(Math.log(r) - Math.log(t.ratio));
    if (d < bestDist) {
      bestDist = d;
      best = t.id;
    }
  }
  return best;
}

export const FLYER_COPY_ITEM_SOFT_MAX = 5;
export const FLYER_COPY_ITEM_HARD_WARN = 8;
