import { normalizeBusinessType } from "@/lib/business-labels";
import type { BusinessType } from "@/lib/types";

export type ProductAiMode = "item" | "combo";

export type ProductAiComboItem = {
  name: string;
  quantity: number;
  photoUrl?: string | null;
};

const BACKGROUND_BY_TYPE: Record<BusinessType, string> = {
  restaurante:
    "Served on a rustic warm wood table with soft natural warm lighting, shallow depth of field, consistent restaurant food-photography look.",
  productos:
    "Clean commercial product photography on a soft neutral studio surface with even softbox lighting, consistent catalog look.",
  servicios:
    "Clean professional studio background, soft neutral tones, even professional lighting, lifestyle-service photography look.",
};

function backgroundLine(businessType: BusinessType | string | null | undefined): string {
  const key = normalizeBusinessType(businessType);
  return BACKGROUND_BY_TYPE[key] ?? BACKGROUND_BY_TYPE.restaurante;
}

const ANTI_TEXT =
  "Absolutely no typography, no letters, no logos, no watermarks, no price tags, no UI, no menus, no hands holding phones.";

export function buildProductItemPrompt(opts: {
  name: string;
  description?: string | null;
  businessType?: string | null;
  style?: string | null;
}): string {
  const name = opts.name.trim();
  const desc = (opts.description ?? "").trim();
  const style = (opts.style ?? "").trim();
  const bg = backgroundLine(opts.businessType);
  const giro = normalizeBusinessType(opts.businessType);

  const subject =
    giro === "servicios"
      ? `Professional photo representing the service or offering named "${name}"`
      : giro === "productos"
        ? `Photorealistic product shot of "${name}" as sold in a Mexican shop`
        : `Photorealistic appetizing dish photo of "${name}" as served in a Mexican restaurant`;

  return [
    subject + (desc ? ` — details: ${desc.slice(0, 280)}` : ""),
    "Single centered subject, square 1:1 framing, sharp focus on the main item.",
    bg,
    style ? `Mood/style hint: ${style}.` : "",
    ANTI_TEXT,
    "Do not invent extra unrelated items. No collage. No text overlays.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildProductComboPrompt(opts: {
  name: string;
  description?: string | null;
  businessType?: string | null;
  style?: string | null;
  items: ProductAiComboItem[];
  attachedPhotoCount: number;
}): string {
  const name = opts.name.trim();
  const desc = (opts.description ?? "").trim();
  const style = (opts.style ?? "").trim();
  const bg = backgroundLine(opts.businessType);
  const list = opts.items
    .slice(0, 8)
    .map((i) => `${i.quantity}× ${i.name}`)
    .join(", ");

  const attachHint =
    opts.attachedPhotoCount > 0
      ? `Integrate the ${opts.attachedPhotoCount} attached real product photo(s) into one cohesive combo/platter composition. Match their appearance; do not invent different dishes.`
      : "Compose a realistic combo/platter arrangement of the listed items together.";

  return [
    `Promotional combo photo for offer "${name}" including: ${list}.`,
    desc ? `Offer notes: ${desc.slice(0, 200)}.` : "",
    attachHint,
    "Square 1:1, appetizing, single scene (not a grid of separate cards).",
    bg,
    style ? `Mood/style hint: ${style}.` : "",
    ANTI_TEXT,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Allow only this tenant's public Storage URLs. */
export function isTenantStoragePhotoUrl(
  url: string,
  restaurantId: string,
): boolean {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("supabase")) return false;
    const path = u.pathname;
    const inDish =
      path.includes("/object/public/dish-photos/") &&
      path.includes(`/${restaurantId}/`);
    const inAssets =
      path.includes("/object/public/restaurant-assets/") &&
      path.includes(`/${restaurantId}/`);
    return inDish || inAssets;
  } catch {
    return false;
  }
}
