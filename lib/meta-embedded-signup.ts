/**
 * Client helpers for Meta WhatsApp Embedded Signup (Facebook JS SDK).
 * Buffers FB.login `code` and WA_EMBEDDED_SIGNUP session info until both arrive.
 */

export type EmbeddedSignupResult = {
  code: string;
  wabaId: string;
  phoneNumberId?: string;
};

export type LaunchEmbeddedSignupOpts = {
  appId: string;
  configId: string;
  /** e.g. v21.0 — must match server Graph version. */
  graphVersion?: string;
  timeoutMs?: number;
};

type FbAuthResponse = {
  code?: string;
  accessToken?: string;
};

type FbLoginResponse = {
  authResponse?: FbAuthResponse | null;
  status?: string;
};

type FbSdk = {
  init: (opts: {
    appId: string;
    cookie?: boolean;
    xfbml?: boolean;
    version: string;
  }) => void;
  login: (
    cb: (res: FbLoginResponse) => void,
    opts: Record<string, unknown>,
  ) => void;
};

declare global {
  interface Window {
    FB?: FbSdk;
    fbAsyncInit?: () => void;
  }
}

const FB_ORIGINS = [
  "https://www.facebook.com",
  "https://web.facebook.com",
  "https://facebook.com",
];

function isFacebookOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return (
      host === "facebook.com" ||
      host.endsWith(".facebook.com") ||
      host === "facebook.net" ||
      host.endsWith(".facebook.net")
    );
  } catch {
    return FB_ORIGINS.includes(origin);
  }
}

type SessionPayload = {
  type?: string;
  event?: string;
  data?: {
    waba_id?: string;
    phone_number_id?: string;
  };
};

function parseSessionMessage(data: unknown): SessionPayload | null {
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as SessionPayload;
    } catch {
      return null;
    }
  }
  if (data && typeof data === "object") {
    return data as SessionPayload;
  }
  return null;
}

let sdkPromise: Promise<FbSdk> | null = null;

export function loadFacebookSdk(_graphVersion: string): Promise<FbSdk> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("SDK solo disponible en el navegador"));
  }
  if (window.FB) return Promise.resolve(window.FB);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (!window.FB) {
        reject(new Error("Facebook SDK no cargó"));
        return;
      }
      resolve(window.FB);
    };
    window.fbAsyncInit = finish;
    if (document.getElementById("facebook-jssdk")) {
      if (window.FB) finish();
      return;
    }
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.async = true;
    script.src = "https://connect.facebook.net/es_LA/sdk.js";
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("No se pudo cargar el SDK de Facebook"));
    };
    document.body.appendChild(script);
  });

  return sdkPromise;
}

/**
 * Launch Embedded Signup and resolve when we have authorization code + waba_id.
 * phone_number_id is optional (server can resolve from WABA).
 */
export function launchEmbeddedSignup(
  opts: LaunchEmbeddedSignupOpts,
): Promise<EmbeddedSignupResult> {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const graphVersion = opts.graphVersion || "v21.0";

  return new Promise((resolve, reject) => {
    let settled = false;
    let code: string | undefined;
    let wabaId: string | undefined;
    let phoneNumberId: string | undefined;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };

    const tryFinish = () => {
      if (settled || !code || !wabaId) return;
      settled = true;
      cleanup();
      resolve({
        code,
        wabaId,
        phoneNumberId: phoneNumberId || undefined,
      });
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };

    const onMessage = (event: MessageEvent) => {
      if (!isFacebookOrigin(event.origin)) return;
      const payload = parseSessionMessage(event.data);
      if (!payload || payload.type !== "WA_EMBEDDED_SIGNUP") return;
      const ev = payload.event || "";
      if (
        ev === "FINISH" ||
        ev === "FINISH_ONLY_WABA" ||
        ev === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"
      ) {
        if (payload.data?.waba_id) wabaId = payload.data.waba_id;
        if (payload.data?.phone_number_id) {
          phoneNumberId = payload.data.phone_number_id;
        }
        tryFinish();
      } else if (ev === "CANCEL" || ev === "error" || ev === "ERROR") {
        fail("Cancelaste el registro en Meta. Puedes intentarlo de nuevo.");
      }
    };

    const timer = window.setTimeout(() => {
      fail(
        "Se agotó el tiempo del registro Meta. Si cerraste la ventana, vuelve a intentar.",
      );
    }, timeoutMs);

    window.addEventListener("message", onMessage);

    void (async () => {
      try {
        const FB = await loadFacebookSdk(graphVersion);
        const version = graphVersion.startsWith("v")
          ? graphVersion
          : `v${graphVersion}`;
        FB.init({
          appId: opts.appId,
          cookie: true,
          xfbml: false,
          version,
        });
        FB.login(
          (response) => {
            if (response.authResponse?.code) {
              code = response.authResponse.code;
              tryFinish();
              return;
            }
            if (response.status === "unknown" || !response.authResponse) {
              fail(
                "No se completó el inicio de sesión con Meta. Revisa pop-ups bloqueados e inténtalo otra vez.",
              );
            }
          },
          {
            config_id: opts.configId,
            response_type: "code",
            override_default_response_type: true,
            extras: {
              setup: {},
              sessionInfoVersion: "3",
            },
          },
        );
      } catch (err) {
        fail(
          err instanceof Error
            ? err.message
            : "No se pudo abrir el registro de Meta",
        );
      }
    })();
  });
}

/** Short steps shown next to the Connect button (tenant-facing). */
export const EMBEDDED_SIGNUP_HELP_STEPS = [
  {
    title: "Antes de empezar",
    body: "Ten a mano una cuenta de Facebook, el número que usarás (el de tu negocio o una línea Express solo para pedidos) y el SMS o llamada para el código de verificación.",
  },
  {
    title: "Al pulsar Conectar con Meta",
    body: "Se abre una ventana de Meta. Inicia sesión, elige o crea el negocio, verifica el número y acepta los términos de WhatsApp Cloud API.",
  },
  {
    title: "Número que ya usas en el celular",
    body: "Si migras tu WhatsApp actual a la API, Meta pedirá desvincular la app del teléfono. Haz respaldo de chats antes. Si prefieres no tocarlo, usa un chip nuevo solo para pedidos.",
  },
  {
    title: "Después de conectar",
    body: "Verás el número como “conectado”. El asistente sigue apagado hasta que leas la guía y actives el interruptor. Para chats manuales usa Meta Business Suite; los pedidos del bot van al tablero Pedidos. Prueba escribiendo MENU desde otro WhatsApp.",
  },
] as const;
