import { GoogleGenAI, Type, type Schema } from "@google/genai";

export const GEMINI_TEXT_MODEL =
  process.env.GCP_GEMINI_MODEL?.trim() || "gemini-2.5-flash";
/** Image generation model (Imagen was shut down; use Gemini image models). */
export const IMAGEN_MODEL =
  process.env.GCP_IMAGEN_MODEL?.trim() || "gemini-2.5-flash-image";

const GEMINI_IMAGE_ASPECTS = new Set([
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
]);

function normalizeImageAspectRatio(ratio?: string): string {
  const r = (ratio ?? "1:1").trim();
  return GEMINI_IMAGE_ASPECTS.has(r) ? r : "1:1";
}

export class GeminiUnavailableError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "GeminiUnavailableError";
    this.status = status;
  }
}

function gcpCredentials() {
  const clientEmail = process.env.GCP_CLIENT_EMAIL?.trim();
  const privateKeyRaw = process.env.GCP_PRIVATE_KEY?.trim();
  if (!clientEmail || !privateKeyRaw) return null;
  return {
    client_email: clientEmail,
    private_key: privateKeyRaw.replace(/\\n/g, "\n"),
  };
}

export function isVertexConfigured(): boolean {
  return Boolean(
    process.env.GCP_PROJECT_ID?.trim() &&
      process.env.GCP_CLIENT_EMAIL?.trim() &&
      process.env.GCP_PRIVATE_KEY?.trim(),
  );
}

let cached: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (cached) return cached;
  const project = process.env.GCP_PROJECT_ID?.trim();
  const location = process.env.GCP_LOCATION?.trim() || "us-central1";
  const credentials = gcpCredentials();
  if (!project || !credentials) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[gemini] GCP_PROJECT_ID / GCP_CLIENT_EMAIL / GCP_PRIVATE_KEY missing.",
      );
    }
    throw new GeminiUnavailableError(
      "Vertex AI no está configurado en el servidor.",
      503,
    );
  }

  cached = new GoogleGenAI({
    vertexai: true,
    project,
    location,
    googleAuthOptions: {
      credentials,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    },
  });

  return cached;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const status =
    typeof err === "object" && err && "status" in err
      ? Number((err as { status?: number }).status)
      : NaN;
  return (
    status === 429 ||
    status === 503 ||
    /429|RESOURCE_EXHAUSTED|Too Many Requests|UNAVAILABLE/i.test(msg)
  );
}

function isPermission(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const status =
    typeof err === "object" && err && "status" in err
      ? Number((err as { status?: number }).status)
      : NaN;
  return status === 403 || /PERMISSION_DENIED|403|Forbidden/i.test(msg);
}

async function withBackoff<T>(fn: () => Promise<T>): Promise<T> {
  const waits = [2000, 4000, 8000];
  let last: unknown;
  for (let i = 0; i <= waits.length; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (isPermission(err)) {
        throw new GeminiUnavailableError(
          "IA no disponible (permisos o API). Revisa Vertex AI.",
          403,
        );
      }
      if (!isRetryable(err) || i === waits.length) break;
      await sleep(waits[i]!);
    }
  }
  const msg = last instanceof Error ? last.message : "Error de Vertex AI";
  throw new GeminiUnavailableError(
    isRetryable(last)
      ? "Hay mucha demanda en IA. Espera un momento e intenta de nuevo."
      : msg,
    isRetryable(last) ? 429 : 502,
  );
}

export type GeminiJsonPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

/** Structured JSON from Gemini Flash (vision/text). */
export async function generateJson<T>(opts: {
  system: string;
  parts: GeminiJsonPart[];
  schema: Schema;
  temperature?: number;
}): Promise<T> {
  const ai = getGenAI();
  const res = await withBackoff(() =>
    ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: [
        {
          role: "user",
          parts: opts.parts.map((p) =>
            "text" in p
              ? { text: p.text }
              : {
                  inlineData: {
                    mimeType: p.inlineData.mimeType,
                    data: p.inlineData.data,
                  },
                },
          ),
        },
      ],
      config: {
        systemInstruction: opts.system,
        temperature: opts.temperature ?? 0.2,
        responseMimeType: "application/json",
        responseSchema: opts.schema,
      },
    }),
  );

  const text = (res.text ?? "").trim();
  if (!text) {
    throw new GeminiUnavailableError("La IA no devolvió datos.", 502);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GeminiUnavailableError("La IA devolvió JSON inválido.", 502);
  }
}

/** Flash multimodal → short style brief from a reference image (for Imagen prompts). */
export async function describeImageStyleBrief(opts: {
  base64: string;
  mimeType: string;
}): Promise<{ brief: string }> {
  return generateJson<{ brief: string }>({
    system:
      "Eres un director de arte. Describe el estilo visual de la imagen de referencia en un breve (1–2 oraciones) en español o inglés técnico, útil para guiar una generación Imagen: colores, iluminación, textura, mood, composición. Sin texto ilegible ni marcas. Solo JSON.",
    parts: [
      {
        inlineData: {
          mimeType: opts.mimeType || "image/jpeg",
          data: opts.base64,
        },
      },
      {
        text: "Resume el estilo visual de esta referencia para generar un fondo publicitario similar.",
      },
    ],
    schema: {
      type: Type.OBJECT,
      properties: {
        brief: { type: Type.STRING },
      },
      required: ["brief"],
    },
    temperature: 0.3,
  });
}

/** Generate one image via Gemini image models (replaces discontinued Imagen). */
export async function generateImagenBytes(opts: {
  prompt: string;
  aspectRatio?: string;
  numberOfImages?: number;
}): Promise<{ bytes: Buffer; mimeType: string }> {
  const ai = getGenAI();
  const aspectRatio = normalizeImageAspectRatio(opts.aspectRatio);
  const model = IMAGEN_MODEL;

  const res = await withBackoff(() =>
    ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [{ text: opts.prompt }],
        },
      ],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio,
        },
      },
    }),
  );

  const parts = res.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData;
    if (inline?.data) {
      return {
        bytes: Buffer.from(inline.data, "base64"),
        mimeType: inline.mimeType || "image/png",
      };
    }
  }

  throw new GeminiUnavailableError("El modelo de imagen no devolvió imagen.", 502);
}
