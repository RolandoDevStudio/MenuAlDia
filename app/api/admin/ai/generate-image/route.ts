import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantSession } from "@/lib/admin-session";
import {
  GeminiUnavailableError,
  describeImageStyleBrief,
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

export const maxDuration = 60;

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
  prompt: z.string().min(8).max(1200),
  style: z.string().max(80).optional(),
  referenceBase64: z.string().max(600_000).optional(),
  referenceMime: z.string().max(40).optional(),
});

function usageKind(
  imageKind: "flyer" | "banner" | "background",
): "flyer" | "banner" | "background" {
  return imageKind;
}

function resolvePreset(
  imageKind: "flyer" | "banner" | "background",
  preset?: AiImagePreset,
): AiImagePreset {
  if (preset && IMAGE_KIND_ASPECTS[preset]) {
    if (imageKind === "flyer" && preset.startsWith("flyer")) return preset;
    if (imageKind === "banner" && preset === "banner") return preset;
    if (imageKind === "background" && preset === "background") return preset;
  }
  if (imageKind === "banner") return "banner";
  if (imageKind === "background") return "background";
  return "flyer";
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

  const preset = resolvePreset(body.imageKind, body.preset);
  const aspect = IMAGE_KIND_ASPECTS[preset];
  const kind = usageKind(body.imageKind);

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
  let prompt = `${body.prompt.trim()}.${styleBit} Formato publicitario para restaurante/negocio en México. Sin texto ilegible. Aspecto aproximado ${aspect.native}.`;

  try {
    if (body.referenceBase64 && body.referenceMime) {
      try {
        const { brief } = await describeImageStyleBrief({
          base64: body.referenceBase64,
          mimeType: body.referenceMime,
        });
        const clean = (brief ?? "").trim();
        if (clean) {
          prompt = `${prompt} Referencia de estilo: ${clean}`;
        }
      } catch (refErr) {
        console.warn("[generate-image] style brief skipped", refErr);
      }
    }
    const { bytes, mimeType } = await generateImagenBytes({
      prompt,
      aspectRatio: aspect.native,
    });
    await finalizeUsage(reserved.usageId, true);

    return NextResponse.json({
      imageBase64: bytes.toString("base64"),
      mimeType,
      preset,
      targetAspect: aspect.target,
      nativeAspect: aspect.native,
      remaining: reserved.remaining,
      total: reserved.total,
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
