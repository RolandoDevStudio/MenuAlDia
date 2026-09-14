import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION?.trim() || "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.META_APP_SECRET?.trim();
  if (!secret || !signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(received, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type WaSendResult = { ok: boolean; wamid?: string; error?: string };

async function graphPost(
  phoneNumberId: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<WaSendResult> {
  const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    messages?: { id?: string }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    return { ok: false, error: json.error?.message || `HTTP ${res.status}` };
  }
  return { ok: true, wamid: json.messages?.[0]?.id };
}

export async function sendWaText(opts: {
  phoneNumberId: string;
  accessToken: string;
  toE164: string;
  text: string;
}): Promise<WaSendResult> {
  return graphPost(opts.phoneNumberId, opts.accessToken, {
    to: opts.toE164.replace(/\D/g, ""),
    type: "text",
    text: { preview_url: false, body: opts.text },
  });
}

export async function sendWaImageByLink(opts: {
  phoneNumberId: string;
  accessToken: string;
  toE164: string;
  imageUrl: string;
  caption?: string;
}): Promise<WaSendResult> {
  return graphPost(opts.phoneNumberId, opts.accessToken, {
    to: opts.toE164.replace(/\D/g, ""),
    type: "image",
    image: {
      link: opts.imageUrl,
      ...(opts.caption ? { caption: opts.caption } : {}),
    },
  });
}

/** Resolve temporary media URL then download (max 8s). */
export async function downloadWhatsAppMedia(
  mediaId: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const timeout = AbortSignal.timeout(8000);
  const combined =
    signal != null
      ? AbortSignal.any([signal, timeout])
      : timeout;

  const metaRes = await fetch(`${GRAPH_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: combined,
  });
  if (!metaRes.ok) return null;
  const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!meta.url) return null;

  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: combined,
  });
  if (!fileRes.ok) return null;
  const ab = await fileRes.arrayBuffer();
  return {
    buffer: Buffer.from(ab),
    mimeType: meta.mime_type || "application/octet-stream",
  };
}
