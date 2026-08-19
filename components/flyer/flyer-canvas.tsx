import type { Dish, Restaurant } from "@/lib/types";
import { formatMxn } from "@/lib/money";

type Props = {
  restaurant: Restaurant;
  dishes: Dish[];
  sides: Dish[];
  packagePrice: number;
  id?: string;
  headline?: string;
  sidesTitle?: string;
};

/** Fixed 1080×1350 canvas for WhatsApp flyers (4:5). */
export function FlyerCanvas({
  restaurant,
  dishes,
  sides,
  packagePrice,
  id = "flyer-canvas",
  headline = "MENÚ DEL DÍA",
  sidesTitle = "Incluye guarniciones",
}: Props) {
  return (
    <div
      id={id}
      className="relative overflow-hidden text-[#1c1410]"
      style={{
        width: 1080,
        height: 1350,
        background:
          "linear-gradient(165deg, #f7e6c8 0%, #f0c48a 38%, #e8a05a 70%, #c45c26 100%)",
        fontFamily: "var(--font-sans), system-ui, sans-serif",
      }}
    >
      <div
        className="absolute inset-6 rounded-[40px] border-[6px] border-[#8b3a14]/40"
        style={{ background: "rgba(255,248,235,0.92)" }}
      />

      <div className="relative z-10 flex h-full flex-col px-16 py-14">
        <div className="text-center">
          <p
            className="text-[72px] leading-none tracking-wide text-[#8b3a14]"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            {restaurant.name}
          </p>
          <p className="mt-2 text-2xl font-semibold uppercase tracking-[0.25em] text-[#c45c26]">
            {restaurant.slogan || "Sabor casero"}
          </p>
          <p
            className="mt-6 text-[56px] leading-none text-[#1c1410]"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            {headline}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-6">
          {dishes.slice(0, 4).map((dish) => (
            <div
              key={dish.id}
              className="overflow-hidden rounded-3xl border-4 border-[#8b3a14]/30 bg-white shadow-lg"
            >
              {dish.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={dish.photo_url}
                  alt={dish.name}
                  crossOrigin="anonymous"
                  className="h-48 w-full object-cover"
                />
              ) : (
                <div className="flex h-48 items-center justify-center bg-[#f3e0c4] text-xl font-semibold text-[#8b3a14]">
                  {dish.name.slice(0, 1)}
                </div>
              )}
              <p className="px-4 py-3 text-center text-2xl font-bold leading-tight">
                {dish.name}
              </p>
            </div>
          ))}
        </div>

        {sides.length > 0 ? (
          <div className="mt-8 rounded-3xl bg-white/80 px-8 py-5">
            <p className="text-xl font-bold uppercase tracking-wide text-[#8b3a14]">
              {sidesTitle}
            </p>
            <p className="mt-2 text-2xl leading-snug">
              {sides.map((s) => s.name).join(" · ")}
            </p>
          </div>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-6 pb-4">
          <div className="space-y-3">
            {(restaurant.free_shipping || Number(restaurant.shipping_cost) === 0) && (
              <span className="inline-block rounded-full bg-[#2f6b4f] px-5 py-2 text-xl font-bold text-white">
                Envío Gratis
              </span>
            )}
            <p className="text-2xl font-semibold">
              WhatsApp: {restaurant.phone_whatsapp}
            </p>
            {restaurant.schedule_text ? (
              <p className="text-xl text-[#5a4638]">{restaurant.schedule_text}</p>
            ) : null}
          </div>

          <div
            className="flex h-44 w-44 items-center justify-center rounded-full bg-[#c45c26] text-center text-white shadow-xl"
            style={{ boxShadow: "0 12px 0 #8b3a14" }}
          >
            <div>
              <p className="text-lg font-semibold uppercase tracking-wider opacity-90">
                Solo
              </p>
              <p
                className="text-5xl leading-none"
                style={{ fontFamily: "var(--font-display), sans-serif" }}
              >
                {formatMxn(packagePrice).replace(/\s?MX\$?/i, "$")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
