import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPublicMenuBySlug,
} from "@/lib/restaurant";
import { comboDisplayPrice } from "@/lib/combo";
import { parseThemeConfig } from "@/lib/theme";
import { labelsFor } from "@/lib/business-labels";
import { formatMxn } from "@/lib/money";
import { formatPlaceLine } from "@/lib/mx-locations";
import { RestaurantHeader } from "@/components/public/restaurant-header";
import { DailyMenuHero } from "@/components/public/daily-menu-hero";
import { PublicMenuClient } from "@/components/public/public-menu-client";
import {
  CartBottomSpacer,
  FloatingCart,
} from "@/components/public/floating-cart";
import { PoweredByMenuAlDia } from "@/components/brand/brand-logo";
import { TryAsCustomerBanner } from "@/components/marketing/try-as-customer-banner";
import { MenuFaqs } from "@/components/public/menu-faqs";
import { FlyerPromoBanner } from "@/components/public/flyer-promo-banner";
import { MenuViewBeacon } from "@/components/public/menu-view-beacon";
import { StoreClosedBanner } from "@/components/public/store-closed-banner";
import { createPublicClient } from "@/lib/supabase/public";
import {
  effectiveAcceptingOrders,
  publicClosedMessage,
} from "@/lib/store-hours";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string; c?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const data = await getPublicMenuBySlug(slug);
  if (!data) return { title: "Menú no encontrado" };

  const { restaurant } = data;
  const theme = parseThemeConfig(restaurant.theme_config);
  const siteName = "Menú al Día";

  if (sp.c) {
    const combo = data.combos.find((c) => c.slug === sp.c);
    if (combo) {
      const price = comboDisplayPrice(combo);
      const includes = combo.items
        .map((i) => i.dish.name)
        .slice(0, 5)
        .join(", ");
      const title = `🔥 ${combo.title} — ${restaurant.name}`;
      const description = `Incluye: ${includes}. ¡Solo ${formatMxn(price)} MXN!`;
      const image =
        combo.photo_url ||
        theme.bannerUrl ||
        restaurant.logo_url ||
        undefined;
      return {
        title,
        description,
        openGraph: {
          title,
          description,
          siteName,
          images: image ? [{ url: image }] : undefined,
          type: "website",
        },
        twitter: {
          card: "summary_large_image",
          title,
          description,
          images: image ? [image] : undefined,
        },
      };
    }
  }

  if (sp.p) {
    const dish = data.dishes.find((d) => d.id === sp.p);
    if (dish) {
      const title = `${dish.name} — ${restaurant.name}`;
      const description = [
        dish.description?.trim(),
        `Precio: ${formatMxn(Number(dish.price))}`,
      ]
        .filter(Boolean)
        .join(" · ");
      const image =
        dish.photo_url ||
        theme.bannerUrl ||
        restaurant.logo_url ||
        undefined;
      return {
        title,
        description,
        openGraph: {
          title,
          description,
          siteName,
          images: image ? [{ url: image }] : undefined,
          type: "website",
        },
        twitter: {
          card: "summary_large_image",
          title,
          description,
          images: image ? [image] : undefined,
        },
      };
    }
  }

  const title = `${restaurant.name} — ${siteName}`;
  const description = restaurant.slogan || "Menú digital y pedidos por WhatsApp";
  const image =
    theme.bannerUrl || restaurant.logo_url || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName,
      images: image ? [{ url: image }] : undefined,
      type: "website",
    },
  };
}

export default async function PublicMenuPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const data = await getPublicMenuBySlug(slug);
  if (!data) notFound();

  const packagePrice = Number(data.dailyMenu?.package_price ?? 0);
  const maxSides = data.dailyMenu?.max_sides ?? 2;
  const pricingMode =
    data.dailyMenu?.pricing_mode === "individual" ? "individual" : "package";
  const dailyMenuActive = data.dailyMenu?.is_active !== false;
  const theme = parseThemeConfig(data.restaurant.theme_config);
  const labels = labelsFor(data.restaurant.business_type);
  const place = formatPlaceLine(data.restaurant.city, data.restaurant.state);

  const hasDaily =
    (data.dailyDishes?.length ?? 0) > 0 || (data.dailySides?.length ?? 0) > 0;
  const hasCatalog = (data.dishes?.length ?? 0) > 0;
  const hasCombos = (data.combos?.length ?? 0) > 0;
  const menuEmpty = !hasDaily && !hasCatalog && !hasCombos;

  const publicClient = createPublicClient();
  const { data: faqRows } = await publicClient
    .from("restaurant_faqs")
    .select("id, question, answer")
    .eq("restaurant_id", data.restaurant.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(8);
  const faqs = faqRows ?? [];

  const bgStyle =
    theme.useBackgroundImage && theme.backgroundImageUrl
      ? {
          backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${theme.colors.bg} 88%, transparent), ${theme.colors.bg}), url(${theme.backgroundImageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }
      : {
          background: `radial-gradient(ellipse 90% 50% at 10% 0%, color-mix(in srgb, ${theme.colors.primary} 28%, transparent) 0%, transparent 55%), radial-gradient(ellipse 70% 40% at 100% 10%, color-mix(in srgb, ${theme.colors.primary} 18%, transparent) 0%, transparent 50%), linear-gradient(180deg, var(--color-bg) 0%, color-mix(in srgb, var(--color-bg) 85%, ${theme.colors.primary}) 100%)`,
        };

  return (
    <main className="relative min-h-full overflow-x-clip bg-background">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-90"
        aria-hidden
        style={bgStyle}
      />
      <TryAsCustomerBanner slug={slug} />
      <StoreClosedBanner
        acceptingOrders={effectiveAcceptingOrders(data.restaurant)}
        message={publicClosedMessage(data.restaurant.closed_message)}
      />
      <MenuViewBeacon restaurantId={data.restaurant.id} />
      <Suspense fallback={null}>
        <FlyerPromoBanner restaurantId={data.restaurant.id} />
      </Suspense>
      {theme.bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={theme.bannerUrl}
          alt=""
          className="h-28 w-full object-cover sm:h-36"
        />
      ) : null}
      <RestaurantHeader
        restaurant={data.restaurant}
        placeLine={place}
        hasFaqs={faqs.length > 0}
      />
      {menuEmpty ? (
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-lg font-semibold text-brand-dark">
            {data.restaurant.name} está preparando su menú.
          </p>
          <p className="mt-2 text-sm text-muted">¡Vuelve pronto!</p>
        </div>
      ) : (
        <>
          {dailyMenuActive && (data.dailyDishes?.length ?? 0) > 0 ? (
            <DailyMenuHero
              dishes={data.dailyDishes}
              sides={data.dailySides}
              packagePrice={packagePrice}
              maxSides={maxSides}
              pricingMode={pricingMode}
              photoFrame={theme.photoFrame}
              dailyMenuLabel={labels.dailyMenu}
              sidesLabel={labels.sides}
              dishesLabel={labels.dishes}
              dishLabel={labels.dish}
            />
          ) : null}
          <Suspense fallback={null}>
            <PublicMenuClient
              slug={slug}
              restaurant={data.restaurant}
              categories={data.categories}
              dishes={data.dishes}
              addonsByDishId={data.addonsByDishId}
              combos={data.combos}
              photoFrame={theme.photoFrame}
              sidesLabel={labels.sides}
              combosLabel={labels.combos}
              popularLabel={labels.popular}
              initialDishId={sp.p ?? null}
              initialComboSlug={sp.c ?? null}
            />
          </Suspense>
          <MenuFaqs faqs={faqs} />
        </>
      )}
      {menuEmpty && faqs.length > 0 ? <MenuFaqs faqs={faqs} /> : null}
      <div className="mx-auto max-w-lg px-4 pb-4 pt-2 text-center">
        <PoweredByMenuAlDia />
      </div>
      {!menuEmpty ? (
        <>
          <CartBottomSpacer />
          <FloatingCart restaurant={data.restaurant} />
        </>
      ) : null}
    </main>
  );
}
