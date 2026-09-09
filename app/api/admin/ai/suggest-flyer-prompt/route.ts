import { NextResponse } from "next/server";
import { z } from "zod";
import { Type } from "@google/genai";
import { requireTenantSession } from "@/lib/admin-session";
import {
  GeminiUnavailableError,
  generateJson,
} from "@/lib/gemini";
import { assertAiAllowed } from "@/lib/ai-quota";
import { labelsFor } from "@/lib/business-labels";

export const maxDuration = 30;

const bodySchema = z.object({
  mode: z.enum(["menu", "business", "free"]),
  dishNames: z.array(z.string().min(1).max(120)).max(40).optional(),
  style: z.string().max(80).optional(),
  restaurantName: z.string().max(120).optional(),
  slogan: z.string().max(200).optional(),
  businessType: z.string().max(40).optional(),
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

  const name =
    body.restaurantName?.trim() || session.restaurant.name || "Negocio";
  const slogan =
    body.slogan?.trim() || session.restaurant.slogan?.trim() || "";
  const businessType =
    body.businessType?.trim() ||
    session.restaurant.business_type ||
    "restaurante";
  const labels = labelsFor(businessType);
  const dishNames = (body.dishNames ?? []).map((d) => d.trim()).filter(Boolean);
  const styleBit = body.style?.trim() ? ` Estilo preferido: ${body.style.trim()}.` : "";

  let modeHint = "";
  if (body.mode === "menu") {
    modeHint =
      dishNames.length > 0
        ? `Modo menú: destaca estos ${labels.dishes.toLowerCase()}: ${dishNames.join(", ")}. Fondo/appetizing food photography o collage publicitario sin texto ilegible.`
        : `Modo menú: ambiente de ${labels.catalog.toLowerCase()} / comida atractiva sin texto ilegible.`;
  } else if (body.mode === "business") {
    modeHint = `Modo negocio: identidad de marca, atmósfera del local, tipografía implícita en la escena (sin texto ilegible), adecuado para flyer de ${name}.`;
  } else {
    modeHint =
      "Modo libre: escena publicitaria creativa para redes (WhatsApp/Instagram), sin texto ilegible.";
  }

  try {
    const result = await generateJson<{ prompt: string }>({
      system:
        "Eres copywriter visual para negocios en México. Escribes prompts cortos y efectivos (español o inglés técnico) para Imagen 3: fondos/flyers publicitarios. Sin marcas de agua, sin texto ilegible en la imagen. Solo JSON con campo prompt.",
      parts: [
        {
          text: [
            `Negocio: ${name}.`,
            slogan ? `Slogan: ${slogan}.` : "",
            `Giro: ${labels.business} (${businessType}).`,
            modeHint,
            styleBit,
            "Devuelve un único prompt listo para pegar en Imagen (2–4 oraciones).",
          ]
            .filter(Boolean)
            .join(" "),
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
