import type { ReactNode } from "react";
import type { Dish, Restaurant } from "@/lib/types";
import { formatMxn } from "@/lib/money";
import {
  FLYER_ASPECT_SIZE,
  formatWhatsappDisplay,
  type FlyerEditorOptions,
} from "@/lib/flyer-types";
import { getFlyerTheme } from "@/lib/flyer-themes";
import { cn } from "@/lib/utils";

type Props = {
  restaurant: Restaurant;
  dishes: Dish[];
  sides: Dish[];
  packagePrice: number;
  options: FlyerEditorOptions;
  id?: string;
  sidesTitle?: string;
};

const TEXT_SCALE = {
  sm: { name: 56, headline: 40, weekday: 36, body: 22, price: 40 },
  md: { name: 68, headline: 48, weekday: 44, body: 26, price: 52 },
  lg: { name: 80, headline: 56, weekday: 52, body: 30, price: 64 },
} as const;

/** Logo edge in canvas px (flyer is ~1080 wide). */
const LOGO_SIZE = {
  off: 0,
  sm: 72,
  md: 96,
  lg: 128,
} as const;

export function FlyerCanvas({
  restaurant,
  dishes,
  sides,
  packagePrice,
  options,
  id = "flyer-canvas",
  sidesTitle = "Guarniciones",
}: Props) {
  const theme = getFlyerTheme(options.themePack);
  const { w, h } = FLYER_ASPECT_SIZE[options.aspect];
  const ts = TEXT_SCALE[options.textScale];
  const mains = dishes.filter((d) => !d.is_side).slice(0, 6);
  const showSides = options.showSides && sides.length > 0;
  const bullet = options.bullet === "star" ? "★" : "✓";
  const phone = formatWhatsappDisplay(restaurant.phone_whatsapp);
  const subtitle = options.subtitle.trim() || restaurant.slogan || "Sabor casero";
  const showWa = options.showWhatsapp && Boolean(phone);
  const showShip =
    options.showFreeShipping &&
    (restaurant.free_shipping || Number(restaurant.shipping_cost) === 0);
  const chalk = theme.id === "urbano_pizarra";

  const fitClass =
    options.objectFit === "contain"
      ? "object-contain"
      : "object-cover";

  function dishCard(dish: Dish, i: number, tall?: boolean) {
    const polaroid = options.frameStyle === "polaroid";
    const rotate = polaroid ? (i % 2 === 0 ? -3 : 3) : 0;
    return (
      <div
        key={dish.id}
        className={cn(
          "overflow-hidden shadow-lg",
          polaroid
            ? chalk
              ? "rounded-sm border-[10px] border-b-[18px] border-[#f5f0e6]"
              : "rounded-sm border-white border-b-[16px] border-x-8 border-t-8"
            : chalk
              ? "rounded-2xl border-2 border-dashed"
              : "rounded-3xl border-4",
        )}
        style={{
          transform: rotate ? `rotate(${rotate}deg)` : undefined,
          background: theme.cardBg,
          borderColor: polaroid ? undefined : theme.cardBorder,
        }}
      >
        {options.layout !== "text_only" && dish.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dish.photo_url}
            alt=""
            crossOrigin="anonymous"
            className={cn("w-full", fitClass, tall ? "h-72" : "h-44")}
            style={{
              filter: theme.photoFilter,
              background: theme.placeholderBg,
            }}
          />
        ) : options.layout !== "text_only" ? (
          <div
            className={cn(
              "flex items-center justify-center font-semibold",
              tall ? "h-72 text-4xl" : "h-44 text-2xl",
            )}
            style={{
              background: theme.placeholderBg,
              color: theme.muted,
            }}
          >
            {dish.name.slice(0, 1)}
          </div>
        ) : null}
        <div className="px-3 py-2 text-center">
          <p
            className="font-bold leading-tight"
            style={{ fontSize: ts.body, color: theme.text }}
          >
            {bullet} {dish.name}
          </p>
          {options.priceMode === "per_item" ? (
            <p
              className="mt-1 font-semibold"
              style={{ fontSize: ts.body * 0.9, color: theme.accent }}
            >
              {formatMxn(Number(dish.price))}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  function listPanel(children: ReactNode, className?: string) {
    return (
      <ul
        className={cn(
          "space-y-2 px-6 py-4",
          chalk ? "rounded-2xl border-2 border-dashed" : "rounded-3xl",
          className,
        )}
        style={{
          background: chalk ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.85)",
          borderColor: chalk ? theme.cardBorder : undefined,
          color: theme.text,
        }}
      >
        {children}
      </ul>
    );
  }

  function dishesBlock() {
    if (options.layout === "text_only") {
      return (
        <div className="mt-8">
          {listPanel(
            mains.map((d) => (
              <li key={d.id} style={{ fontSize: ts.body }} className="font-bold">
                {bullet} {d.name}
                {options.priceMode === "per_item"
                  ? ` — ${formatMxn(Number(d.price))}`
                  : ""}
              </li>
            )),
            "space-y-3 px-8 py-6",
          )}
        </div>
      );
    }
    if (options.layout === "hero_list") {
      const [hero, ...rest] = mains;
      return (
        <div className="mt-8 space-y-4">
          {hero ? dishCard(hero, 0, true) : null}
          {rest.length > 0
            ? listPanel(
                rest.map((d) => (
                  <li
                    key={d.id}
                    className="font-bold"
                    style={{ fontSize: ts.body }}
                  >
                    {bullet} {d.name}
                    {options.priceMode === "per_item"
                      ? ` — ${formatMxn(Number(d.price))}`
                      : ""}
                  </li>
                )),
              )
            : null}
        </div>
      );
    }
    const cols = mains.length <= 1 ? 1 : 2;
    return (
      <div
        className={cn(
          "mt-8 grid gap-5",
          cols === 1 ? "grid-cols-1" : "grid-cols-2",
        )}
      >
        {mains.slice(0, 4).map((d, i) => dishCard(d, i, mains.length === 1))}
      </div>
    );
  }

  function headlineBlock() {
    if (theme.titleStyle === "ribbon") {
      return (
        <div className="mt-3 flex justify-center">
          <div
            className="relative px-10 py-3 text-center"
            style={{
              background: theme.ribbonBg,
              color: theme.ribbonText,
              clipPath:
                "polygon(8% 0, 92% 0, 100% 50%, 92% 100%, 8% 100%, 0 50%)",
              boxShadow: `0 6px 0 ${theme.accentDeep}`,
            }}
          >
            <p
              className="leading-none tracking-wide"
              style={{
                fontFamily: theme.displayFont,
                fontSize: ts.headline,
              }}
            >
              {options.headline}
            </p>
          </div>
        </div>
      );
    }
    // chalk
    return (
      <div className="mt-4 text-center">
        <p
          className="leading-none tracking-wide"
          style={{
            fontFamily: theme.displayFont,
            fontSize: ts.headline,
            color: theme.text,
            textShadow: "0 2px 0 rgba(0,0,0,0.45)",
          }}
        >
          {options.headline}
        </p>
        <div
          className="mx-auto mt-3 h-1 w-40 rounded-full opacity-80"
          style={{
            background: `repeating-linear-gradient(90deg, ${theme.accent} 0 10px, transparent 10px 16px)`,
          }}
        />
      </div>
    );
  }

  return (
    <div
      id={id}
      className="relative overflow-hidden"
      style={{
        width: w,
        height: h,
        background: theme.outerGradient,
        color: theme.text,
        fontFamily: theme.bodyFont,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: theme.textureSvg,
          opacity: theme.textureOpacity,
          mixBlendMode: chalk ? "overlay" : "multiply",
        }}
        aria-hidden
      />

      <div
        className="absolute inset-6"
        style={{
          borderRadius: theme.panelRadius,
          borderWidth: chalk ? 3 : 6,
          borderStyle: chalk ? "dashed" : "solid",
          borderColor: theme.panelBorder,
          background: theme.panelBg,
        }}
      />

      <div className="relative z-10 flex h-full flex-col px-14 py-12">
        <div className="flex items-start justify-center gap-4 text-center">
          {restaurant.logo_url && options.logoScale !== "off" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.logo_url}
              alt=""
              crossOrigin="anonymous"
              className={cn(
                "shrink-0 object-cover shadow",
                chalk ? "rounded-full ring-2 ring-white/40" : "rounded-2xl",
              )}
              style={{
                width: LOGO_SIZE[options.logoScale],
                height: LOGO_SIZE[options.logoScale],
                filter: theme.photoFilter,
              }}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p
              className="leading-none tracking-wide"
              style={{
                fontFamily: theme.displayFont,
                fontSize: ts.name,
                color: chalk ? theme.text : theme.muted,
              }}
            >
              {restaurant.name}
            </p>
            <p
              className="mt-2 font-semibold uppercase tracking-[0.2em]"
              style={{ fontSize: ts.body * 0.85, color: theme.accent }}
            >
              {subtitle}
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          {theme.weekdayPill === "filled" ? (
            <p
              className="inline-block rounded-full px-8 py-2 font-bold uppercase tracking-wider"
              style={{
                fontSize: ts.weekday * 0.55,
                background: theme.sealBg,
                color: theme.sealText,
              }}
            >
              {options.weekdayLabel}
            </p>
          ) : (
            <p
              className="inline-block rounded-full border-2 border-dashed px-8 py-2 font-bold uppercase tracking-wider"
              style={{
                fontSize: ts.weekday * 0.55,
                borderColor: theme.muted,
                color: theme.muted,
              }}
            >
              {options.weekdayLabel}
            </p>
          )}
          {headlineBlock()}
        </div>

        {dishesBlock()}

        {showSides ? (
          <div
            className={cn(
              "mt-6 px-8 py-5",
              chalk ? "rounded-2xl border-2 border-dashed" : "rounded-3xl",
            )}
            style={{
              background: chalk
                ? "rgba(255,255,255,0.04)"
                : "rgba(255,255,255,0.85)",
              borderColor: chalk ? theme.cardBorder : undefined,
            }}
          >
            <p
              className="font-bold uppercase tracking-wide"
              style={{ fontSize: ts.body, color: theme.muted }}
            >
              {sidesTitle}
            </p>
            <ul className="mt-2 space-y-1">
              {sides.map((s) => (
                <li
                  key={s.id}
                  style={{ fontSize: ts.body * 0.95, color: theme.text }}
                >
                  {bullet} {s.name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-4 pb-2 pt-6">
          <div className="space-y-3">
            {showShip ? (
              <span
                className="inline-block rounded-full px-5 py-2 text-xl font-bold"
                style={{
                  background: theme.sealBg,
                  color: theme.sealText,
                }}
              >
                ¡Envío gratis!
              </span>
            ) : null}
            {showWa ? (
              <div
                className="rounded-2xl px-4 py-3"
                style={{ background: theme.waBg }}
              >
                <p
                  className="text-lg font-bold"
                  style={{ color: theme.waText }}
                >
                  Pedidos por WhatsApp
                </p>
                <p
                  className="text-2xl font-semibold"
                  style={{ color: theme.text }}
                >
                  {phone}
                </p>
              </div>
            ) : null}
          </div>

          {options.priceMode === "package" ? (
            options.priceBadge === "ribbon" ? (
              <div
                className="px-6 py-4 text-center text-white shadow-xl"
                style={{
                  background: theme.priceBg,
                  color: chalk ? theme.sealText : "#fff",
                  borderRadius: chalk ? 12 : 16,
                  clipPath: chalk
                    ? undefined
                    : "polygon(0 12%, 100% 0, 100% 88%, 0 100%)",
                }}
              >
                <p className="text-sm font-semibold uppercase tracking-wider">
                  Platillo completo
                </p>
                <p
                  className="leading-none"
                  style={{
                    fontFamily: theme.displayFont,
                    fontSize: ts.price,
                  }}
                >
                  {formatMxn(packagePrice).replace(/\s?MX\$?/i, "$")}
                </p>
              </div>
            ) : (
              <div
                className="flex h-40 w-40 items-center justify-center rounded-full text-center shadow-xl"
                style={{
                  background: theme.priceBg,
                  color: chalk ? theme.sealText : "#fff",
                  boxShadow: chalk
                    ? `0 0 0 4px ${theme.cardBorder}, 0 8px 0 ${theme.priceShadow}`
                    : `0 10px 0 ${theme.priceShadow}`,
                }}
              >
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wider opacity-90">
                    Solo
                  </p>
                  <p
                    className="leading-none"
                    style={{
                      fontFamily: theme.displayFont,
                      fontSize: ts.price * 0.85,
                    }}
                  >
                    {formatMxn(packagePrice).replace(/\s?MX\$?/i, "$")}
                  </p>
                </div>
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
