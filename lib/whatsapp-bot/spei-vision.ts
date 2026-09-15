import { Type, type Schema } from "@google/genai";
import { generateJson, isVertexConfigured } from "@/lib/gemini";

export type SpeiVisionResult = {
  spei_match: boolean | null;
  detected_amount: number | null;
  notes: string;
};

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    spei_match: { type: Type.BOOLEAN },
    detected_amount: { type: Type.NUMBER },
    notes: { type: Type.STRING },
  },
  required: ["spei_match", "notes"],
};

/**
 * Assistive SPEI receipt check. Never auto-approves payment —
 * admin still decides. Returns null if Vertex unavailable or call fails.
 */
export async function analyzeSpeiProof(opts: {
  buffer: Buffer;
  mimeType: string;
  expectedTotal: number;
  businessName?: string;
}): Promise<SpeiVisionResult | null> {
  if (!isVertexConfigured()) return null;
  try {
    const base64 = opts.buffer.toString("base64");
    const mime = opts.mimeType.startsWith("image/")
      ? opts.mimeType
      : "image/jpeg";
    const result = await generateJson<{
      spei_match: boolean;
      detected_amount?: number | null;
      notes: string;
    }>({
      system:
        "Eres un asistente de caja para negocios en México. Analizas capturas de comprobantes SPEI/transferencia. Devuelve JSON: spei_match (true si el monto visible coincide aproximadamente con expected_total ±2 MXN, o si el comprobante se ve legítimo y el monto es coherente), detected_amount (número o null), notes (1 frase corta en español). No inventes CLABEs. Si la imagen no es un comprobante, spei_match=false.",
      parts: [
        { inlineData: { mimeType: mime, data: base64 } },
        {
          text: `Negocio: ${opts.businessName || "N/A"}. Monto esperado del pedido: ${opts.expectedTotal.toFixed(2)} MXN. ¿Coincide el comprobante?`,
        },
      ],
      schema,
      temperature: 0.1,
    });
    return {
      spei_match: Boolean(result.spei_match),
      detected_amount:
        result.detected_amount != null && Number.isFinite(result.detected_amount)
          ? Number(result.detected_amount)
          : null,
      notes: String(result.notes || "").slice(0, 280),
    };
  } catch (err) {
    console.error("[analyzeSpeiProof]", err);
    return null;
  }
}
