export const SUPPORT_COOKIE = "support_restaurant_id";
export const SUPPORT_ACTOR_LABEL = "Soporte";
export const SUPPORT_LINK_TTL_MS = 15 * 60 * 1000;
export const SUPPORT_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export const SUPPORT_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: Math.floor(SUPPORT_SESSION_TTL_MS / 1000),
};
