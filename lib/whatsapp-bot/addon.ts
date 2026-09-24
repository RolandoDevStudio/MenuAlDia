/** Add-On "IA & Marketing": Vision SPEI, VIP push, abandoned-cart nudge, AI template assist. */

import { WHATSAPP_AI_MARKETING_ADDON } from "@/lib/plans";

/**
 * Abandoned-cart nudge needs a ~10m scheduler (Vercel Pro cron or external).
 * Keep route + DB; flip to true when ops can run `/api/cron/wa-abandoned-cart`.
 */
export const ABANDONED_CART_NUDGE_ENABLED: boolean = false;

export type AddonAccountFields = {
  whatsapp_ai_marketing_addon?: boolean | null;
  addon_trial_ends_at?: string | null;
};

export function isWhatsappAiMarketingAddonActive(
  account: AddonAccountFields | null | undefined,
  now = new Date(),
): boolean {
  if (!account) return false;
  if (account.whatsapp_ai_marketing_addon === true) return true;
  const ends = account.addon_trial_ends_at;
  if (!ends) return false;
  const t = Date.parse(ends);
  return Number.isFinite(t) && t > now.getTime();
}

export function addonStatusLabel(
  account: AddonAccountFields | null | undefined,
  now = new Date(),
): "active" | "trial" | "expired" | "off" {
  if (!account) return "off";
  if (account.whatsapp_ai_marketing_addon === true) return "active";
  const ends = account.addon_trial_ends_at;
  if (!ends) return "off";
  const t = Date.parse(ends);
  if (!Number.isFinite(t)) return "off";
  if (t > now.getTime()) return "trial";
  return "expired";
}

export const ADDON_TRIAL_DAYS = WHATSAPP_AI_MARKETING_ADDON.trialDays;
