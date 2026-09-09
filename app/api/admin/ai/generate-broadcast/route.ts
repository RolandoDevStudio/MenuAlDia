import { NextResponse } from "next/server";
import { z } from "zod";
import { Type } from "@google/genai";
import { requireTenantSession } from "@/lib/admin-session";
import {
  GeminiUnavailableError,
  generateJson,
} from "@/lib/gemini";
import { assertAiAllowed, recordUsage } from "@/lib/ai-quota";
import {
  ANNOUNCEMENT_TYPES,
  LENGTHS,
  TONES,
  buildBroadcastAiUserPrompt,
  buildBroadcastSystemPrompt,
  buildFallbackBroadcastVariants,
  withOptionalWhatsAppBold,
} from "@/lib/broadcast-ai-prompt";

export const maxDuration = 30;

const bodySchema = z.object({
  announcementType: z.enum(ANNOUNCEMENT_TYPES),
  tone: z.enum(TONES),
  length: z.enum(LENGTHS).default("corto"),
  itemNames: z.array(z.string().min(1).max(120)).max(20).default([]),
  packagePrice: z.number().nullable().optional(),
  includeEmojis: z.boolean().default(true),
  includeMenuLink: z.boolean().default(true),
  includePrice: z.boolean().default(true),
  includeBoldMarkers: z.boolean().default(true),
  adminNote: z.string().max(400).optional(),
  menuUrl: z.string().url().max(500),
  dailyLabel: z.string().max(80).optional(),
  shareCta: z.string().max(120).optional(),
  variantCount: z.number().int().min(1).max(6).default(3),
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

  const dailyLabel = body.dailyLabel?.trim() || "Especiales de hoy";
  const fallbackOpts = {
    businessName: session.restaurant.name,
    menuUrl: body.menuUrl,
    dailyLabel,
    announcementType: body.announcementType,
    itemNames: body.itemNames,
    packagePrice: body.packagePrice ?? null,
    includeEmojis: body.includeEmojis,
    includeMenuLink: body.includeMenuLink,
    includePrice: body.includePrice,
    includeBoldMarkers: body.includeBoldMarkers,
    shareCta: body.shareCta,
  };

  try {
    const result = await generateJson<{ variants: string[] }>({
      system: buildBroadcastSystemPrompt(body.includeBoldMarkers),
      parts: [
        {
          text: buildBroadcastAiUserPrompt({
            ...fallbackOpts,
            tone: body.tone,
            length: body.length,
            adminNote: body.adminNote,
            variantCount: body.variantCount,
          }),
        },
      ],
      schema: {
        type: Type.OBJECT,
        properties: {
          variants: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["variants"],
      },
      temperature: 0.7,
    });

    const variants = (result.variants ?? [])
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter((v) => v.length >= 8)
      .map((v) => withOptionalWhatsAppBold(v, body.includeBoldMarkers))
      .slice(0, body.variantCount);

    if (variants.length === 0) {
      await recordUsage({
        restaurantId,
        kind: "broadcast",
        ok: false,
      });
      return NextResponse.json({
        variants: buildFallbackBroadcastVariants(fallbackOpts).slice(
          0,
          body.variantCount,
        ),
        fallback: true,
      });
    }

    await recordUsage({
      restaurantId,
      kind: "broadcast",
      ok: true,
    });

    return NextResponse.json({ variants, fallback: false });
  } catch (e) {
    if (e instanceof GeminiUnavailableError) {
      await recordUsage({
        restaurantId,
        kind: "broadcast",
        ok: false,
      }).catch(() => undefined);
      return NextResponse.json({
        variants: buildFallbackBroadcastVariants(fallbackOpts).slice(
          0,
          body.variantCount,
        ),
        fallback: true,
        message: e.message,
      });
    }
    console.error("[generate-broadcast]", e);
    return NextResponse.json(
      {
        variants: buildFallbackBroadcastVariants(fallbackOpts).slice(
          0,
          body.variantCount,
        ),
        fallback: true,
        message: "No se pudo generar con IA; usamos plantillas locales.",
      },
      { status: 200 },
    );
  }
}
