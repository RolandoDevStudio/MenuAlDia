import { createPublicClient } from "@/lib/supabase/public";
import type { CanonicalDemoId } from "@/lib/canonical-demos";
import { SALES_WHATSAPP, normalizeWhatsAppPhone } from "@/lib/whatsapp";

export type LandingTestimonial = {
  quote: string;
  author: string;
  role?: string;
  initial?: string;
};

export type LandingFaqItem = {
  q: string;
  a: string;
};

export type LandingDemoPosters = Partial<
  Record<CanonicalDemoId, string>
>;

export const COMPARISON_ROW_IDS = [
  "control",
  "attraction",
  "retention",
  "value",
] as const;

export type ComparisonRowId = (typeof COMPARISON_ROW_IDS)[number];

export type ComparisonImageSlot =
  `${ComparisonRowId}_${"problem" | "solution"}`;

export const COMPARISON_IMAGE_SLOTS: ComparisonImageSlot[] = [
  "control_problem",
  "control_solution",
  "attraction_problem",
  "attraction_solution",
  "retention_problem",
  "retention_solution",
  "value_problem",
  "value_solution",
];

export type LandingComparisonImages = Partial<
  Record<ComparisonImageSlot, string>
>;

export type ComparisonRowContent = {
  id: ComparisonRowId;
  problemTitle: string;
  problemBody: string;
  solutionTitle: string;
  solutionBody: string;
  /** Default SVG under /marketing/compare/ when CMS vacío */
  defaultProblemArt: string;
  defaultSolutionArt: string;
};

export const DEFAULT_COMPARISON_ROWS: ComparisonRowContent[] = [
  {
    id: "control",
    problemTitle: "Actualización pasiva",
    problemBody: "Dependes de terceros; el menú termina abandonado.",
    solutionTitle: "Autonomía total",
    solutionBody: "Panel propio, PWA y cambio al instante en 1 clic.",
    defaultProblemArt: "/marketing/compare/control-problem.svg",
    defaultSolutionArt: "/marketing/compare/control-solution.svg",
  },
  {
    id: "attraction",
    problemTitle: "Catálogo estático",
    problemBody: "Esperas que alguien escanee el QR por casualidad.",
    solutionTitle: "Atracción activa",
    solutionBody: "Flyers diarios, Cita Express y mapa local.",
    defaultProblemArt: "/marketing/compare/attraction-problem.svg",
    defaultSolutionArt: "/marketing/compare/attraction-solution.svg",
  },
  {
    id: "retention",
    problemTitle: "Nula retención",
    problemBody: "Sin datos del cliente, sin seguimiento.",
    solutionTitle: "CRM completo",
    solutionBody: "Historial, recurrencia y base para fidelizar.",
    defaultProblemArt: "/marketing/compare/retention-problem.svg",
    defaultSolutionArt: "/marketing/compare/retention-solution.svg",
  },
  {
    id: "value",
    problemTitle: "Te dejan solo",
    problemBody: "Pago único: te entregan el menú y adiós.",
    solutionTitle: "Ventas y fidelización",
    solutionBody: "Te ayudamos a que tus clientes vuelvan cada semana.",
    defaultProblemArt: "/marketing/compare/value-problem.svg",
    defaultSolutionArt: "/marketing/compare/value-solution.svg",
  },
];

export type LandingContent = {
  heroTitle: string;
  heroSubtitle: string;
  contactBlurb: string;
  socialProofLine: string;
  /** Digits for wa.me (landing CTAs). Empty → fallback SALES_WHATSAPP. */
  salesWhatsApp: string;
  testimonials: LandingTestimonial[];
  faq: LandingFaqItem[];
  demoPosters: LandingDemoPosters;
  comparisonImages: LandingComparisonImages;
};

export const DEFAULT_LANDING_FAQ: LandingFaqItem[] = [
  {
    q: "¿Necesito que mis clientes instalen una app?",
    a: "No. Solo compartes un link: abren el menú en el navegador y piden por WhatsApp.",
  },
  {
    q: "¿Quién paga WhatsApp?",
    a: "El cliente escribe a tu número de negocio. MenuAlDía no cobra comisión por pedido.",
  },
  {
    q: "¿Cuánto tarda la activación?",
    a: "Te activamos el mismo día. Configuras tu menú y ya puedes compartir el link.",
  },
  {
    q: "¿Puedo cambiar de plan después?",
    a: "Sí. Te ajustamos el plan cuando lo necesites, sin fricción.",
  },
];

export const DEFAULT_LANDING_CONTENT: LandingContent = {
  heroTitle:
    "Tu catálogo y menú digital interactivo. Recibe pedidos por WhatsApp con 0% de comisiones.",
  heroSubtitle:
    "Hecho para restaurantes, servicios y tiendas locales — sin intermediarios ni App Store.",
  contactBlurb:
    "Te respondemos por WhatsApp y te activamos en el mismo día.",
  socialProofLine: "Hecho para locales en México · activación el mismo día",
  salesWhatsApp: SALES_WHATSAPP,
  testimonials: [],
  faq: DEFAULT_LANDING_FAQ,
  demoPosters: {},
  comparisonImages: {},
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseTestimonials(raw: unknown): LandingTestimonial[] {
  if (!Array.isArray(raw)) return [];
  const out: LandingTestimonial[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const quote = asString(row.quote);
    const author = asString(row.author);
    if (!quote || !author) continue;
    out.push({
      quote,
      author,
      role: asString(row.role) || undefined,
      initial: asString(row.initial) || undefined,
    });
    if (out.length >= 3) break;
  }
  return out;
}

function parseFaq(raw: unknown): LandingFaqItem[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_LANDING_FAQ.map((item) => ({ ...item }));
  }
  const out: LandingFaqItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const q = asString(row.q);
    const a = asString(row.a);
    if (!q || !a) continue;
    out.push({ q, a });
  }
  return out.length > 0
    ? out
    : DEFAULT_LANDING_FAQ.map((item) => ({ ...item }));
}

function parseDemoPosters(raw: unknown): LandingDemoPosters {
  if (!raw || typeof raw !== "object") return {};
  const row = raw as Record<string, unknown>;
  const posters: LandingDemoPosters = {};
  for (const id of ["restaurante", "servicios", "tienda"] as CanonicalDemoId[]) {
    const url = asString(row[id]);
    if (url) posters[id] = url;
  }
  return posters;
}

function parseComparisonImages(raw: unknown): LandingComparisonImages {
  if (!raw || typeof raw !== "object") return {};
  const row = raw as Record<string, unknown>;
  const out: LandingComparisonImages = {};
  for (const slot of COMPARISON_IMAGE_SLOTS) {
    const url = asString(row[slot]);
    if (url) out[slot] = url;
  }
  return out;
}

export function parseLandingContent(raw: unknown): LandingContent {
  if (!raw || typeof raw !== "object") {
    return {
      ...DEFAULT_LANDING_CONTENT,
      faq: [...DEFAULT_LANDING_FAQ],
      comparisonImages: {},
    };
  }
  const row = raw as Record<string, unknown>;
  const salesDigits = normalizeWhatsAppPhone(asString(row.salesWhatsApp));
  return {
    heroTitle: asString(row.heroTitle) || DEFAULT_LANDING_CONTENT.heroTitle,
    heroSubtitle:
      asString(row.heroSubtitle) || DEFAULT_LANDING_CONTENT.heroSubtitle,
    contactBlurb:
      asString(row.contactBlurb) || DEFAULT_LANDING_CONTENT.contactBlurb,
    socialProofLine:
      asString(row.socialProofLine) ||
      DEFAULT_LANDING_CONTENT.socialProofLine,
    salesWhatsApp:
      salesDigits.length >= 10
        ? salesDigits
        : DEFAULT_LANDING_CONTENT.salesWhatsApp,
    testimonials: parseTestimonials(row.testimonials),
    faq: parseFaq(row.faq),
    demoPosters: parseDemoPosters(row.demoPosters),
    comparisonImages: parseComparisonImages(row.comparisonImages),
  };
}

export async function getLandingContent(): Promise<LandingContent> {
  try {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "landing_content")
      .maybeSingle();
    return parseLandingContent(data?.value);
  } catch {
    return {
      ...DEFAULT_LANDING_CONTENT,
      faq: [...DEFAULT_LANDING_FAQ],
      comparisonImages: {},
    };
  }
}
