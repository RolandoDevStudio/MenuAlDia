import {
  BACKGROUND_OVERLAY,
  parseBackgroundOverlay,
  type ThemeConfig,
} from "@/lib/theme";

/** Viewport-fixed wallpaper: cover on desktop and mobile, each with its own focus. */
export function PublicMenuBackdrop({ theme }: { theme: ThemeConfig }) {
  if (!theme.useBackgroundImage || !theme.backgroundImageUrl) return null;

  const bg = theme.colors.bg;
  const overlay = BACKGROUND_OVERLAY[parseBackgroundOverlay(theme.backgroundOverlay)];
  const url = JSON.stringify(theme.backgroundImageUrl);

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundColor: bg }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 hidden bg-cover bg-no-repeat md:block"
        style={{
          backgroundImage: `url(${url})`,
          backgroundPosition: `${theme.backgroundDesktopFocusX ?? 50}% ${theme.backgroundDesktopFocusY ?? 50}%`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-no-repeat md:hidden"
        style={{
          backgroundImage: `url(${url})`,
          backgroundPosition: `${theme.backgroundFocusX ?? 50}% ${theme.backgroundFocusY ?? 50}%`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${bg} ${overlay.from}%, transparent), color-mix(in srgb, ${bg} ${overlay.to}%, transparent))`,
        }}
      />
    </>
  );
}
