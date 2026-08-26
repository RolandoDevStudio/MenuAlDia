/** Vocabulario visual. No usar en menús de navegación (Lucide o texto). */
export const UI_EMOJI = {
  crm: "🎯",
  tenants: "🏪",
  finance: "💵",
  requests: "📥",
  promos: "🎟️",
  seeds: "🌱",
  cms: "📝",
  whatsapp: "💬",
  copy: "📋",
  support: "🎧",
  edit: "✏️",
  save: "✅",
  extend: "📅",
  pause: "⏸️",
  resume: "▶️",
  approve: "👍",
  reject: "❌",
  remind: "🔔",
  csv: "⬇️",
  create: "➕",
  clone: "🌱",
  exit: "↩️",
  catalog: "🗂️",
  broadcast: "📣",
  customers: "👥",
  combos: "📦",
  orders: "🛍️",
  history: "🕓",
  tenantPromos: "🏷️",
  metrics: "📊",
  settings: "⚙️",
  gallery: "🖼️",
  flyer: "🖼️",
  hours: "🕒",
} as const;

export function dailyMenuEmoji(businessType?: string | null): string {
  if (businessType === "servicios") return "✨";
  if (businessType === "productos") return "🛍️";
  return "🍽️";
}
