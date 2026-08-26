export const LANDING_EVENT_KEYS = [
  "wa_nav",
  "wa_breath",
  "wa_form",
  "wa_fab",
  "wa_plan_catalog",
  "wa_plan_daily",
  "wa_plan_pro",
  "demo_open",
] as const;

export type LandingEventKey = (typeof LANDING_EVENT_KEYS)[number];

export const LANDING_EVENT_LABELS: Record<LandingEventKey, string> = {
  wa_nav: "WhatsApp · nav",
  wa_breath: "WhatsApp · franja",
  wa_form: "WhatsApp · formulario",
  wa_fab: "WhatsApp · botón flotante",
  wa_plan_catalog: "WhatsApp · Catálogo",
  wa_plan_daily: "WhatsApp · Menú al Día",
  wa_plan_pro: "WhatsApp · Pro",
  demo_open: "Abrir demo",
};

const KEY_SET = new Set<string>(LANDING_EVENT_KEYS);

export function isLandingEventKey(value: string): value is LandingEventKey {
  return KEY_SET.has(value);
}

export function isLandingWaKey(key: string): boolean {
  return key.startsWith("wa_");
}

const VIEW_STORAGE_KEY = "mad_landing_view";

function postLanding(body: Record<string, string>) {
  void fetch("/api/public/landing-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}

/** Fire-and-forget. Views: once per browser tab (survives refresh). */
export function trackLandingView() {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(VIEW_STORAGE_KEY)) return;
    sessionStorage.setItem(VIEW_STORAGE_KEY, "1");
  } catch {
    /* private mode */
  }
  postLanding({ type: "view" });
}

export function trackLandingEvent(key: LandingEventKey) {
  postLanding({ type: "event", key });
}
