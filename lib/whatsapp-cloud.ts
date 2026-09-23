import { createHmac, timingSafeEqual } from "node:crypto";

export const WHATSAPP_GRAPH_VERSION =
  process.env.WHATSAPP_GRAPH_VERSION?.trim() || "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}`;

type GraphErrorBody = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    error_user_title?: string;
    error_user_msg?: string;
    fbtrace_id?: string;
  };
};

export type GraphCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fbtraceId?: string; status: number };

function mapGraphError(
  status: number,
  body: GraphErrorBody,
  fallback: string,
): GraphCallResult<never> {
  const err = body.error;
  const raw = (
    err?.error_user_msg ||
    err?.message ||
    fallback
  ).toLowerCase();
  let message = fallback;
  if (
    raw.includes("code has expired") ||
    raw.includes("authorization code") ||
    raw.includes("verification code")
  ) {
    message =
      "El código de Meta expiró o es inválido. Vuelve a pulsar Conectar con Meta.";
  } else if (
    raw.includes("permission") ||
    raw.includes("(#200)") ||
    err?.code === 200
  ) {
    message =
      "Faltan permisos de WhatsApp en Meta. Revisa la configuración de la app.";
  } else if (
    raw.includes("redirect_uri") ||
    err?.error_subcode === 36008
  ) {
    message =
      "Error de dominio OAuth en Meta. Revisa Allowed Domains / Redirect URIs.";
  } else if (err?.error_user_msg || err?.message) {
    message = err.error_user_msg || err.message || fallback;
  }
  if (err?.fbtrace_id) {
    console.error("[whatsapp-cloud]", {
      fbtrace_id: err.fbtrace_id,
      code: err.code,
      subcode: err.error_subcode,
      message: err.message,
    });
  }
  return { ok: false, message, fbtraceId: err?.fbtrace_id, status };
}

function isAlreadyRegisteredError(body: GraphErrorBody): boolean {
  const msg = (body.error?.message || "").toLowerCase();
  const code = body.error?.code;
  return (
    msg.includes("already registered") ||
    msg.includes("already exists") ||
    code === 133010
  );
}

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

/** Max 3 quick-reply buttons (Meta limit). */
export async function sendWaButtons(opts: {
  phoneNumberId: string;
  accessToken: string;
  toE164: string;
  body: string;
  buttons: { id: string; title: string }[];
}): Promise<WaSendResult> {
  const buttons = opts.buttons.slice(0, 3).map((b) => ({
    type: "reply",
    reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) },
  }));
  return graphPost(opts.phoneNumberId, opts.accessToken, {
    to: opts.toE164.replace(/\D/g, ""),
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: opts.body.slice(0, 1024) },
      action: { buttons },
    },
  });
}

/** Marketing / utility template (requires Meta APPROVED template). */
export async function sendWaTemplate(opts: {
  phoneNumberId: string;
  accessToken: string;
  toE164: string;
  templateName: string;
  languageCode?: string;
  bodyParameters?: string[];
}): Promise<WaSendResult> {
  const components =
    opts.bodyParameters && opts.bodyParameters.length > 0
      ? [
          {
            type: "body",
            parameters: opts.bodyParameters.map((text) => ({
              type: "text",
              text: text.slice(0, 1024),
            })),
          },
        ]
      : undefined;
  return graphPost(opts.phoneNumberId, opts.accessToken, {
    to: opts.toE164.replace(/\D/g, ""),
    type: "template",
    template: {
      name: opts.templateName,
      language: { code: opts.languageCode || "es_MX" },
      ...(components ? { components } : {}),
    },
  });
}

/** Exchange Embedded Signup authorization code for a business token. */
export async function exchangeEmbeddedSignupCode(
  code: string,
): Promise<GraphCallResult<{ accessToken: string }>> {
  const clientId = process.env.META_APP_ID?.trim();
  const clientSecret = process.env.META_APP_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      message: "Meta App no configurada en el servidor",
      status: 500,
    };
  }
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString(), { method: "GET" });
  const json = (await res.json().catch(() => ({}))) as GraphErrorBody & {
    access_token?: string;
  };
  if (!res.ok || !json.access_token) {
    return mapGraphError(
      res.status,
      json,
      "No se pudo obtener el token de Meta",
    );
  }
  return { ok: true, data: { accessToken: json.access_token } };
}

export type WabaPhoneNumber = {
  id: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
};

/** List phone numbers on a WABA (fallback when Embedded Signup omits phone_number_id). */
export async function listWabaPhoneNumbers(
  wabaId: string,
  accessToken: string,
): Promise<GraphCallResult<WabaPhoneNumber[]>> {
  const url = new URL(`${GRAPH_BASE}/${wabaId}/phone_numbers`);
  url.searchParams.set(
    "fields",
    "id,display_phone_number,verified_name",
  );
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json().catch(() => ({}))) as GraphErrorBody & {
    data?: {
      id?: string;
      display_phone_number?: string;
      verified_name?: string;
    }[];
  };
  if (!res.ok) {
    return mapGraphError(
      res.status,
      json,
      "No se pudieron listar los números del WABA",
    );
  }
  const phones = (json.data ?? [])
    .filter((p): p is { id: string } & typeof p => Boolean(p.id))
    .map((p) => ({
      id: p.id,
      displayPhoneNumber: p.display_phone_number,
      verifiedName: p.verified_name,
    }));
  return { ok: true, data: phones };
}

export async function subscribeAppToWaba(
  wabaId: string,
  accessToken: string,
): Promise<GraphCallResult<{ success: boolean }>> {
  const res = await fetch(`${GRAPH_BASE}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json().catch(() => ({}))) as GraphErrorBody & {
    success?: boolean;
  };
  if (!res.ok) {
    return mapGraphError(
      res.status,
      json,
      "No se pudo suscribir la app a webhooks del WABA",
    );
  }
  return { ok: true, data: { success: Boolean(json.success ?? true) } };
}

/**
 * Register phone for Cloud API. Treats "already registered" as success
 * (reconnect / second connect).
 */
export async function registerCloudPhoneNumber(
  phoneNumberId: string,
  accessToken: string,
  pin: string,
): Promise<GraphCallResult<{ success: boolean }>> {
  const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/register`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      pin,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as GraphErrorBody & {
    success?: boolean;
  };
  if (!res.ok) {
    if (isAlreadyRegisteredError(json)) {
      return { ok: true, data: { success: true } };
    }
    return mapGraphError(
      res.status,
      json,
      "No se pudo registrar el número en Cloud API",
    );
  }
  return { ok: true, data: { success: Boolean(json.success ?? true) } };
}

export async function fetchPhoneDisplay(
  phoneNumberId: string,
  accessToken: string,
): Promise<
  GraphCallResult<{ displayPhoneNumber: string | null; verifiedName: string | null }>
> {
  const url = new URL(`${GRAPH_BASE}/${phoneNumberId}`);
  url.searchParams.set("fields", "display_phone_number,verified_name");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json().catch(() => ({}))) as GraphErrorBody & {
    display_phone_number?: string;
    verified_name?: string;
  };
  if (!res.ok) {
    return mapGraphError(
      res.status,
      json,
      "No se pudo leer el número conectado",
    );
  }
  return {
    ok: true,
    data: {
      displayPhoneNumber: json.display_phone_number ?? null,
      verifiedName: json.verified_name ?? null,
    },
  };
}

/** Resolve temporary media URL then download (max 8s). */
export async function downloadWhatsAppMedia(
  mediaId: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const timeout = AbortSignal.timeout(8000);
  const combined = timeout;

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
