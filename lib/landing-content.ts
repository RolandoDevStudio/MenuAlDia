import { createPublicClient } from "@/lib/supabase/public";
import type { CanonicalDemoId } from "@/lib/canonical-demos";

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

export type LandingContent = {
  heroTitle: string;
  heroSubtitle: string;
  contactBlurb: string;
  socialProofLine: string;
  testimonials: LandingTestimonial[];
  faq: LandingFaqItem[];
  demoPosters: LandingDemoPosters;
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
    "Digitaliza tu menú en 2 minutos. Recibe pedidos por WhatsApp sin comisiones.",
  heroSubtitle:
    "Hecho para restaurantes, servicios y tiendas locales que viven de listas de difusión — no de intermediarios.",
  contactBlurb:
    "Te respondemos por WhatsApp y te activamos en el mismo día.",
  socialProofLine: "Hecho para locales en México · activación el mismo día",
  testimonials: [],
  faq: DEFAULT_LANDING_FAQ,
  demoPosters: {},
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

export function parseLandingContent(raw: unknown): LandingContent {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_LANDING_CONTENT, faq: [...DEFAULT_LANDING_FAQ] };
  }
  const row = raw as Record<string, unknown>;
  return {
    heroTitle: asString(row.heroTitle) || DEFAULT_LANDING_CONTENT.heroTitle,
    heroSubtitle:
      asString(row.heroSubtitle) || DEFAULT_LANDING_CONTENT.heroSubtitle,
    contactBlurb:
      asString(row.contactBlurb) || DEFAULT_LANDING_CONTENT.contactBlurb,
    socialProofLine:
      asString(row.socialProofLine) ||
      DEFAULT_LANDING_CONTENT.socialProofLine,
    testimonials: parseTestimonials(row.testimonials),
    faq: parseFaq(row.faq),
    demoPosters: parseDemoPosters(row.demoPosters),
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
    };
  }
}
