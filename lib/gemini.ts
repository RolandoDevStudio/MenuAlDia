import { GoogleGenAI, type Schema } from "@google/genai";

export const GEMINI_TEXT_MODEL =
  process.env.GCP_GEMINI_MODEL?.trim() || "gemini-2.5-flash";
export const IMAGEN_MODEL =
  process.env.GCP_IMAGEN_MODEL?.trim() || "imagen-3.0-generate-002";

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

/** Imagen 3 — returns PNG/JPEG bytes (base64 decoded). */
export async function generateImagenBytes(opts: {
  prompt: string;
  aspectRatio?: string;
  numberOfImages?: number;
}): Promise<{ bytes: Buffer; mimeType: string }> {
  const ai = getGenAI();
  const res = await withBackoff(() =>
    ai.models.generateImages({
      model: IMAGEN_MODEL,
      prompt: opts.prompt,
      config: {
        numberOfImages: opts.numberOfImages ?? 1,
        aspectRatio: opts.aspectRatio ?? "1:1",
      },
    }),
  );

  const img = res.generatedImages?.[0]?.image;
  const b64 = img?.imageBytes;
  if (!b64) {
    throw new GeminiUnavailableError("Imagen 3 no devolvió imagen.", 502);
  }
  return {
    bytes: Buffer.from(b64, "base64"),
    mimeType: img.mimeType || "image/png",
  };
}
