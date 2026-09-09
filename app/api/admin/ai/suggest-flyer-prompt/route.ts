import { NextResponse } from "next/server";
import { z } from "zod";
import { Type } from "@google/genai";
import { requireTenantSession } from "@/lib/admin-session";
import {
  GeminiUnavailableError,
  describeImageStyleBrief,
  generateJson,
} from "@/lib/gemini";
import { assertAiAllowed } from "@/lib/ai-quota";
import {
  buildFlyerCompositionBrief,
  defaultMarketingOpts,
  type FlyerMarketingOpts,
} from "@/lib/flyer-ai-prompt";

export const maxDuration = 30;

const marketingSchema = z
  .object({
    includeLogo: z.boolean().optional(),
    includeName: z.boolean().optional(),
    includeSlogan: z.boolean().optional(),
    includeWhatsapp: z.boolean().optional(),
    includeInstagram: z.boolean().optional(),
    includeFacebook: z.boolean().optional(),
    includeQr: z.boolean().optional(),
    includeDishNames: z.boolean().optional(),
    includeCategories: z.boolean().optional(),
    includePrices: z.boolean().optional(),
    includeEmojis: z.boolean().optional(),
    includeFreeShipping: z.boolean().optional(),
    includeIncludesTag: z.boolean().optional(),
    includeUnitTag: z.boolean().optional(),
    includeDayTag: z.boolean().optional(),
    includeDecorativeElements: z.boolean().optional(),
    includePriceBadges: z.boolean().optional(),
    includePhoneWhatsapp: z.boolean().optional(),
  })
  .optional();

const bodySchema = z.object({
  mode: z.enum(["menu", "business", "free"]),
  dishNames: z.array(z.string().min(1).max(120)).max(40).optional(),
  style: z.string().max(80).optional(),
  restaurantName: z.string().max(120).optional(),
  slogan: z.string().max(200).optional(),
  businessType: z.string().max(40).optional(),
  title: z.string().max(200).optional(),
  marketing: marketingSchema,
  layoutPreset: z
    .enum([
      "fonda_menu_dia",
      "combo_matrix_promos",
      "hero_star_product",
      "marisqueria_event_promo",
      "services_grid",
      "lifestyle_clean",
    ])
    .optional(),
  productImageSource: z
    .enum(["real_catalog", "ai_generated", "none_text_only"])
    .optional(),
  similarity: z.number().min(0).max(100).optional(),
  aspectRatio: z.enum(["4:5", "9:16", "1:1"]).optional(),
  referenceBase64: z.string().max(600_000).optional(),
  referenceMime: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  const session = await requireTenantSession();
  const restaurantId = session.restaurant.id;

  if (session.restaurant.ai_paused) {
    return NextResponse.json(
      {
        error: "AI_PAUSED",
        message: "La IA está pausada para este negocio.",
      },
      { status: 403 },
    );
  }

  // Text/vision only — no image quota reservation.
  const gate = await assertAiAllowed({ restaurantId });
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.error, message: gate.message },
      { status: gate.status },
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Datos inválidos." },
      { status: 400 },
    );
  }

  const name =
    body.restaurantName?.trim() || session.restaurant.name || "Negocio";
  const slogan =
    body.slogan?.trim() || session.restaurant.slogan?.trim() || "";
  const businessType =
    body.businessType?.trim() ||
    session.restaurant.business_type ||
    "restaurante";
  const dishNames = (body.dishNames ?? []).map((d) => d.trim()).filter(Boolean);
  const marketing = defaultMarketingOpts(
    (body.marketing ?? {}) as Partial<FlyerMarketingOpts>,
  );
  const layoutPreset = body.layoutPreset ?? "hero_star_product";
  const productImageSource = body.productImageSource ?? "ai_generated";
  const similarity = body.similarity ?? 40;
  const aspectRatio = body.aspectRatio ?? "4:5";

  let referenceBrief: string | null = null;
  let referencePalette: string | null = null;
  let referenceStructures: string | null = null;
  let referenceNegativeSpace: string | null = null;

  try {
    if (body.referenceBase64 && body.referenceMime) {
      try {
        const style = await describeImageStyleBrief({
          base64: body.referenceBase64,
          mimeType: body.referenceMime,
        });
        referenceBrief = (style.brief ?? "").trim() || null;
        referencePalette = (style.palette ?? "").trim() || null;
        referenceStructures = (style.structures ?? "").trim() || null;
        referenceNegativeSpace = (style.negativeSpace ?? "").trim() || null;
      } catch (refErr) {
        console.warn("[suggest-flyer-prompt] style brief skipped", refErr);
      }
    }

    const composition = buildFlyerCompositionBrief({
      mode: body.mode,
      title: body.title,
      dishNames,
      productImageSource,
      layoutPreset,
      marketing,
      similarity,
      aspectRatio,
      businessType,
      restaurantName: name,
      slogan,
      referenceBrief,
      referencePalette,
      referenceStructures,
      referenceNegativeSpace,
      userPrompt: body.style?.trim() || undefined,
    });

    const result = await generateJson<{ prompt: string }>({
      system:
        "Eres copywriter visual para negocios en México. Escribes un único prompt corto y efectivo (español o inglés técnico) para un modelo de imagen: fondos/flyers publicitarios. Incorpora la brief de composición. Sin marcas de agua, sin texto ilegible en la imagen. Solo JSON con campo prompt.",
      parts: [
        {
          text: [
            "Brief de composición (respétalo):",
            composition,
            "Devuelve un único prompt listo para pegar (3–6 oraciones), en inglés técnico preferido, que preserve: layout geometry, productImageSource, negative space, anti ghost-text, y franja de similitud.",
          ].join("\n"),
        },
      ],
      schema: {
        type: Type.OBJECT,
        properties: {
          prompt: { type: Type.STRING },
        },
        required: ["prompt"],
      },
      temperature: 0.55,
    });

    const prompt = (result.prompt ?? "").trim();
    if (prompt.length < 8) {
      return NextResponse.json(
        { error: "empty", message: "La IA no sugirió un prompt útil." },
        { status: 502 },
      );
    }

    return NextResponse.json({ prompt });
  } catch (e) {
    if (e instanceof GeminiUnavailableError) {
      return NextResponse.json(
        { error: "AI_UNAVAILABLE", message: e.message },
        { status: e.status },
      );
    }
    console.error("[suggest-flyer-prompt]", e);
    return NextResponse.json(
      { error: "server_error", message: "No se pudo sugerir el prompt." },
      { status: 500 },
    );
  }
}
