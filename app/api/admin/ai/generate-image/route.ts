import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantSession } from "@/lib/admin-session";
import {
  GeminiUnavailableError,
  describeImageStyleBrief,
  generateFlyerMultimodal,
  generateImagenBytes,
} from "@/lib/gemini";
import {
  assertAiAllowed,
  finalizeUsage,
  getImageQuotaStatus,
  reserveImageUsage,
} from "@/lib/ai-quota";
import { IMAGE_KIND_ASPECTS, type AiImagePreset } from "@/lib/ai-schemas";
import type { PlanType } from "@/lib/plans";
import {
  aspectRatioToImagePreset,
  buildFinishedFlyerPrompt,
  buildFlyerCompositionBrief,
  defaultMarketingOpts,
  shouldAttachReferenceImage,
  type FlyerMarketingOpts,
  type FlyerMenuItemForPrompt,
} from "@/lib/flyer-ai-prompt";
import {
  formatWhatsappDisplay,
  socialHandleFromUrl,
} from "@/lib/flyer-types";

export const maxDuration = 60;

const MAX_PRODUCT_PHOTOS = 6;
const MAX_PRODUCT_BYTES = 900_000;

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

const menuItemSchema = z.object({
  name: z.string().min(1).max(120),
  price: z.number().finite().optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  isSide: z.boolean().optional(),
  photoUrl: z
    .string()
    .max(2000)
    .optional()
    .nullable()
    .refine(
      (v) => v == null || v === "" || /^https?:\/\//i.test(v),
      "photoUrl inválida",
    ),
});

const bodySchema = z.object({
  imageKind: z.enum(["flyer", "banner", "background"]),
  preset: z
    .enum([
      "flyer",
      "flyer_story",
      "flyer_square",
      "banner",
      "background",
    ])
    .optional(),
  /** Optional for flyer wizard (composition); required 8+ chars for banner/background. */
  prompt: z.string().max(2000).optional().default(""),
  style: z.string().max(80).optional(),
  referenceBase64: z.string().max(600_000).optional(),
  referenceMime: z.string().max(40).optional(),
  mode: z.enum(["menu", "business", "free"]).optional(),
  dishNames: z.array(z.string().min(1).max(120)).max(40).optional(),
  items: z.array(menuItemSchema).max(40).optional(),
  title: z.string().max(200).optional(),
  restaurantName: z.string().max(120).optional(),
  slogan: z.string().max(200).optional(),
  businessType: z.string().max(40).optional(),
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
  /** When true (default for flyer composition), generate finished publish-ready art. */
  finishedAsset: z.boolean().optional(),
  followReferenceLayout: z.boolean().optional(),
});

function usageKind(
  imageKind: "flyer" | "banner" | "background",
): "flyer" | "banner" | "background" {
  return imageKind;
}

function resolvePreset(
  imageKind: "flyer" | "banner" | "background",
  preset?: AiImagePreset,
  aspectRatio?: "4:5" | "9:16" | "1:1",
): AiImagePreset {
  if (imageKind === "flyer" && aspectRatio) {
    return aspectRatioToImagePreset(aspectRatio);
  }
  if (preset && IMAGE_KIND_ASPECTS[preset]) {
    if (imageKind === "flyer" && preset.startsWith("flyer")) return preset;
    if (imageKind === "banner" && preset === "banner") return preset;
    if (imageKind === "background" && preset === "background") return preset;
  }
  if (imageKind === "banner") return "banner";
  if (imageKind === "background") return "background";
  return "flyer";
}

async function fetchProductImage(opts: {
  url: string;
  label: string;
}): Promise<{ base64: string; mimeType: string; label: string } | null> {
  try {
    const res = await fetch(opts.url, {
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "image/*" },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 32 || buf.byteLength > MAX_PRODUCT_BYTES) return null;
    const ct = (res.headers.get("content-type") || "").split(";")[0]?.trim();
    const mimeType =
      ct && ct.startsWith("image/")
        ? ct
        : opts.url.toLowerCase().includes(".png")
          ? "image/png"
          : opts.url.toLowerCase().includes(".webp")
            ? "image/webp"
            : "image/jpeg";
    return {
      base64: buf.toString("base64"),
      mimeType,
      label: opts.label,
    };
  } catch (e) {
    console.warn("[generate-image] product photo fetch failed", opts.url, e);
    return null;
  }
}

export async function GET() {
  const session = await requireTenantSession();
  const status = await getImageQuotaStatus({
    restaurantId: session.restaurant.id,
    plan: session.restaurant.plan_type as PlanType,
    bonus: session.restaurant.ai_image_bonus ?? 0,
  });
  return NextResponse.json({
    ...status,
    paused: Boolean(session.restaurant.ai_paused),
  });
}

export async function POST(request: Request) {
  const session = await requireTenantSession();
  const restaurantId = session.restaurant.id;
  const plan = session.restaurant.plan_type as PlanType;
  const bonus = session.restaurant.ai_image_bonus ?? 0;

  if (session.restaurant.ai_paused) {
    return NextResponse.json(
      {
        error: "AI_PAUSED",
        message: "La IA está pausada para este negocio.",
      },
      { status: 403 },
    );
  }

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

  const preset = resolvePreset(body.imageKind, body.preset, body.aspectRatio);
  const aspect = IMAGE_KIND_ASPECTS[preset];
  const kind = usageKind(body.imageKind);
  const userPromptText = (body.prompt ?? "").trim();

  const useComposition =
    body.imageKind === "flyer" &&
    Boolean(
      body.layoutPreset ||
        body.productImageSource ||
        body.marketing ||
        typeof body.similarity === "number" ||
        body.aspectRatio ||
        (body.items && body.items.length > 0) ||
        body.finishedAsset === true,
    );

  const finishedAsset =
    body.imageKind === "flyer" &&
    useComposition &&
    body.finishedAsset !== false;

  if (!useComposition && userPromptText.length < 8) {
    return NextResponse.json(
      {
        error: "bad_request",
        message:
          "Describe un poco más lo que quieres generar (mín. 8 caracteres).",
      },
      { status: 400 },
    );
  }

  const reserved = await reserveImageUsage({
    restaurantId,
    kind,
    plan,
    bonus,
  });
  if (!reserved.ok) {
    return NextResponse.json(
      { error: reserved.error, message: reserved.message },
      { status: reserved.status },
    );
  }

  const styleBit = body.style ? ` Estilo: ${body.style}.` : "";
  let prompt = `${userPromptText}.${styleBit} Formato publicitario para restaurante/negocio en México. Sin texto ilegible. Aspecto aproximado ${aspect.native}.`;

  try {
    let referenceBrief: string | null = null;
    let referencePalette: string | null = null;
    let referenceStructures: string | null = null;
    let referenceNegativeSpace: string | null = null;

    const hasReference = Boolean(body.referenceBase64 && body.referenceMime);
    const followReferenceLayout = Boolean(body.followReferenceLayout);
    const similarity = followReferenceLayout
      ? Math.max(body.similarity ?? 85, 75)
      : (body.similarity ?? 40);
    const attachReference =
      hasReference &&
      (followReferenceLayout || shouldAttachReferenceImage(similarity));

    // Flash style brief: useful when we still want palette text, or for non-finished paths.
    // For finished + attached reference we still keep a light brief as secondary guidance.
    if (hasReference && body.referenceBase64 && body.referenceMime) {
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
        console.warn("[generate-image] style brief skipped", refErr);
      }
    }

    const nativeAspect = body.aspectRatio ?? aspect.native;

    if (finishedAsset) {
      const marketing = defaultMarketingOpts(
        (body.marketing ?? {}) as Partial<FlyerMarketingOpts>,
      );
      const productImageSource = body.productImageSource ?? "ai_generated";

      const rawItems =
        body.items && body.items.length > 0
          ? body.items
          : (body.dishNames ?? []).map((name) => ({
              name,
              price: null as number | null,
              category: null as string | null,
              photoUrl: null as string | null,
              isSide: false,
            }));

      const productImages: {
        base64: string;
        mimeType: string;
        label: string;
      }[] = [];

      if (productImageSource === "real_catalog") {
        for (const it of rawItems) {
          if (productImages.length >= MAX_PRODUCT_PHOTOS) break;
          const url = it.photoUrl?.trim();
          if (!url) continue;
          const fetched = await fetchProductImage({
            url,
            label: it.name,
          });
          if (fetched) productImages.push(fetched);
        }
      }

      const photoLabels = new Set(
        productImages.map((p) => p.label.toLowerCase()),
      );
      const itemsForPrompt: FlyerMenuItemForPrompt[] = rawItems.map((it) => ({
        name: it.name,
        price: it.price,
        category: it.category,
        isSide: Boolean(it.isSide),
        hasRealPhoto: Boolean(
          it.photoUrl && photoLabels.has(it.name.trim().toLowerCase()),
        ),
      }));

      const wa = formatWhatsappDisplay(session.restaurant.phone_whatsapp);
      const ig = socialHandleFromUrl(session.restaurant.instagram_url);
      const fb = socialHandleFromUrl(session.restaurant.facebook_url);

      prompt = buildFinishedFlyerPrompt({
        mode: body.mode ?? "business",
        title: body.title,
        userPrompt: userPromptText,
        items: itemsForPrompt,
        productImageSource,
        layoutPreset: body.layoutPreset ?? "hero_star_product",
        marketing,
        similarity,
        aspectRatio: body.aspectRatio ?? "4:5",
        businessType:
          body.businessType ??
          session.restaurant.business_type ??
          "restaurante",
        restaurantName:
          body.restaurantName?.trim() || session.restaurant.name || "Negocio",
        slogan:
          body.slogan?.trim() || session.restaurant.slogan?.trim() || "",
        whatsapp: wa || null,
        instagram: ig || null,
        facebook: fb || null,
        referenceBrief,
        referencePalette,
        referenceStructures,
        referenceNegativeSpace,
        attachedPhotoCount: productImages.length,
        followReferenceLayout,
      });

      const { bytes, mimeType } = await generateFlyerMultimodal({
        prompt,
        aspectRatio: nativeAspect,
        includeReferenceImage: attachReference,
        reference:
          attachReference && body.referenceBase64 && body.referenceMime
            ? {
                base64: body.referenceBase64,
                mimeType: body.referenceMime,
              }
            : null,
        productImages,
      });

      await finalizeUsage(reserved.usageId, true);

      return NextResponse.json({
        imageBase64: bytes.toString("base64"),
        mimeType,
        preset,
        targetAspect: aspect.target,
        nativeAspect,
        remaining: reserved.remaining,
        total: reserved.total,
        finishedAsset: true,
        attachedPhotos: productImages.length,
      });
    }

    // Legacy / banner / background / empty-background composition path
    if (useComposition) {
      const marketing = defaultMarketingOpts(
        (body.marketing ?? {}) as Partial<FlyerMarketingOpts>,
      );
      const composition = buildFlyerCompositionBrief({
        mode: body.mode ?? "business",
        title: body.title,
        userPrompt: userPromptText,
        dishNames:
          body.items?.map((i) => i.name) ?? body.dishNames,
        productImageSource: body.productImageSource ?? "ai_generated",
        layoutPreset: body.layoutPreset ?? "hero_star_product",
        marketing,
        similarity,
        aspectRatio: body.aspectRatio ?? "4:5",
        businessType:
          body.businessType ??
          session.restaurant.business_type ??
          "restaurante",
        restaurantName:
          body.restaurantName?.trim() || session.restaurant.name || "Negocio",
        slogan:
          body.slogan?.trim() || session.restaurant.slogan?.trim() || "",
        referenceBrief,
        referencePalette,
        referenceStructures,
        referenceNegativeSpace,
      });
      prompt = composition;
    } else if (referenceBrief) {
      prompt = `${prompt} Referencia de estilo: ${referenceBrief}`;
      if (referencePalette) prompt += ` Palette: ${referencePalette}.`;
      if (referenceStructures) prompt += ` Structures: ${referenceStructures}.`;
    }

    const { bytes, mimeType } = await generateImagenBytes({
      prompt,
      aspectRatio: nativeAspect,
    });
    await finalizeUsage(reserved.usageId, true);

    return NextResponse.json({
      imageBase64: bytes.toString("base64"),
      mimeType,
      preset,
      targetAspect: aspect.target,
      nativeAspect,
      remaining: reserved.remaining,
      total: reserved.total,
      finishedAsset: false,
    });
  } catch (e) {
    await finalizeUsage(reserved.usageId, false);
    if (e instanceof GeminiUnavailableError) {
      return NextResponse.json(
        { error: "AI_UNAVAILABLE", message: e.message },
        { status: e.status },
      );
    }
    console.error("[generate-image]", e);
    return NextResponse.json(
      { error: "server_error", message: "No se pudo generar la imagen." },
      { status: 500 },
    );
  }
}
