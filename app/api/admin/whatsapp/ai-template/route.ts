import { NextResponse } from "next/server";
import { z } from "zod";
import { Type } from "@google/genai";
import { requireTenantSession } from "@/lib/admin-session";
import { can } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import {
  GeminiUnavailableError,
  generateJson,
  isVertexConfigured,
} from "@/lib/gemini";
import { isWhatsappAiMarketingAddonActive } from "@/lib/whatsapp-bot/addon";
import { assertAiAllowed, recordUsage } from "@/lib/ai-quota";

export const runtime = "nodejs";

const BodySchema = z.object({
  restaurant_id: z.string().uuid(),
  scene: z.enum(["menu_pull", "abandoned_cart", "vip_teaser", "order_confirm"]),
  tone: z.enum(["amigable", "urgente", "premium"]).optional(),
  hints: z.string().max(400).optional(),
});

/**
 * AI-assisted copy for WhatsApp bot message templates (Add-On).
 * Does not submit templates to Meta — admin copies/edits and saves locally.
 */
export async function POST(req: Request) {
  const session = await requireTenantSession();
  if (!can(session.restaurant.plan_type, "whatsapp_bot")) {
    return NextResponse.json({ error: "Plan Pro requerido" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success || parsed.data.restaurant_id !== session.restaurant.id) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: account } = await supabase
    .from("restaurant_whatsapp_accounts")
    .select("whatsapp_ai_marketing_addon, addon_trial_ends_at")
    .eq("restaurant_id", session.restaurant.id)
    .maybeSingle();

  if (!isWhatsappAiMarketingAddonActive(account)) {
    return NextResponse.json(
      { error: "Requiere Add-On IA & Marketing" },
      { status: 403 },
    );
  }

  if (session.restaurant.ai_paused) {
    return NextResponse.json(
      { error: "AI_PAUSED", message: "La IA está pausada para este negocio." },
      { status: 403 },
    );
  }

  const gate = await assertAiAllowed({ restaurantId: session.restaurant.id });
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.error, message: gate.message },
      { status: gate.status },
    );
  }

  if (!isVertexConfigured()) {
    return NextResponse.json(
      { error: "IA no configurada en el servidor" },
      { status: 503 },
    );
  }

  const sceneLabels: Record<string, string> = {
    menu_pull: "respuesta cuando el cliente escribe MENU",
    abandoned_cart: "recordatorio de carrito abandonado (1 mensaje, 15 min)",
    vip_teaser: "teaser corto para difusión VIP (texto de sesión / preview)",
    order_confirm: "confirmación breve de pedido tomado",
  };

  try {
    const result = await generateJson<{
      body: string;
      cta?: string;
      emojis_ok: boolean;
    }>({
      system:
        "Eres copywriter de WhatsApp para negocios en México (restaurantes, servicios, tiendas). Escribes mensajes cortos, claros, con emojis opcionales moderados. Sin promesas falsas de entrega ni precios inventados. Incluye BAJA solo si es marketing. JSON: body (máx 600 chars), cta opcional, emojis_ok boolean.",
      parts: [
        {
          text: `Negocio: ${session.restaurant.name}. Escena: ${sceneLabels[parsed.data.scene]}. Tono: ${parsed.data.tone || "amigable"}. Hints: ${parsed.data.hints || "ninguno"}.`,
        },
      ],
      schema: {
        type: Type.OBJECT,
        properties: {
          body: { type: Type.STRING },
          cta: { type: Type.STRING },
          emojis_ok: { type: Type.BOOLEAN },
        },
        required: ["body", "emojis_ok"],
      },
      temperature: 0.7,
    });

    await recordUsage({
      restaurantId: session.restaurant.id,
      kind: "broadcast",
      ok: true,
    });

    return NextResponse.json({
      ok: true,
      body: String(result.body || "").slice(0, 1000),
      cta: result.cta ? String(result.cta).slice(0, 80) : null,
      emojis_ok: Boolean(result.emojis_ok),
    });
  } catch (err) {
    await recordUsage({
      restaurantId: session.restaurant.id,
      kind: "broadcast",
      ok: false,
    }).catch(() => undefined);
    if (err instanceof GeminiUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("[whatsapp/ai-template]", err);
    return NextResponse.json(
      { error: "No se pudo generar el texto" },
      { status: 502 },
    );
  }
}
