import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  GeminiUnavailableError,
  generateJson,
} from "@/lib/gemini";
import {
  assertAiAllowed,
  getIntentCache,
  intentCacheHash,
  recordUsage,
  setIntentCache,
} from "@/lib/ai-quota";
import {
  menuIntentGeminiSchema,
  menuIntentSchema,
} from "@/lib/ai-schemas";
import { looksLikePhrase } from "@/lib/menu-intent";
import { takeRateLimitSlot } from "@/lib/memory-rate-limit";

export const maxDuration = 30;

const bodySchema = z.object({
  text: z.string().min(2).max(400),
  slug: z.string().min(1).max(80),
});

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function localFallback(text: string, message?: string) {
  return NextResponse.json({
    intent: {
      comensales: null,
      presupuesto_min: null,
      presupuesto_max: null,
      etiquetas: [],
      query: text,
    },
    source: message ? "fallback" : "local",
    ...(message ? { message } : {}),
  });
}

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const text = body.text.trim();
  if (!looksLikePhrase(text)) {
    return localFallback(text);
  }

  if (!takeRateLimitSlot(`menu-intent:${clientIp(request)}`, 10, 60_000)) {
    return NextResponse.json(
      {
        intent: {
          comensales: null,
          presupuesto_min: null,
          presupuesto_max: null,
          etiquetas: [],
          query: text,
        },
        source: "fallback",
        message: "Demasiadas búsquedas. Intenta en un momento.",
      },
      { status: 429 },
    );
  }

  const supabase = await createClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, ai_paused, is_active")
    .eq("slug", body.slug)
    .maybeSingle();

  if (!restaurant || restaurant.is_active === false) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const hash = intentCacheHash(text);
  const cached = await getIntentCache(hash);
  if (cached) {
    const parsed = menuIntentSchema.safeParse(cached);
    if (parsed.success) {
      return NextResponse.json({ intent: parsed.data, source: "cache" });
    }
  }

  const gate = await assertAiAllowed({
    restaurantId: restaurant.id,
    aiPaused: restaurant.ai_paused,
  });
  if (!gate.ok) {
    return localFallback(text, gate.message);
  }

  try {
    const raw = await generateJson<unknown>({
      system:
        "Extrae filtros de pedido de comida en México. presupuesto en pesos MXN. etiquetas cortas (ej. mariscos, ligero, sin lacteos, para compartir). query = palabras de búsqueda de platillo. Si falta un dato usa null.",
      parts: [{ text: `Frase del comensal: ${text}` }],
      schema: menuIntentGeminiSchema,
      temperature: 0.1,
    });
    const parsed = menuIntentSchema.safeParse(raw);
    if (!parsed.success) {
      await recordUsage({
        restaurantId: restaurant.id,
        kind: "intent",
        ok: false,
      });
      return localFallback(text);
    }
    await setIntentCache(hash, parsed.data);
    await recordUsage({
      restaurantId: restaurant.id,
      kind: "intent",
      ok: true,
    });
    return NextResponse.json({ intent: parsed.data, source: "ai" });
  } catch (e) {
    await recordUsage({
      restaurantId: restaurant.id,
      kind: "intent",
      ok: false,
    });
    if (e instanceof GeminiUnavailableError) {
      return localFallback(text, e.message);
    }
    console.error("[menu-intent]", e);
    return localFallback(text);
  }
}
