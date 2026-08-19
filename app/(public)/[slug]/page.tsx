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
  const theme = parseThemeConfig(data.restaurant.theme_config);
  const labels = labelsFor(data.restaurant.business_type);
  const place = formatPlaceLine(data.restaurant.city, data.restaurant.state);

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
      {theme.bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={theme.bannerUrl}
          alt=""
          className="h-28 w-full object-cover sm:h-36"
        />
      ) : null}
      <RestaurantHeader restaurant={data.restaurant} placeLine={place} />
      <DailyMenuHero
        dishes={data.dailyDishes}
        sides={data.dailySides}
        packagePrice={packagePrice}
        maxSides={maxSides}
        photoFrame={theme.photoFrame}
        dailyMenuLabel={labels.dailyMenu}
        sidesLabel={labels.sides}
        dishesLabel={labels.dishes}
      />
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
          initialDishId={sp.p ?? null}
          initialComboSlug={sp.c ?? null}
        />
      </Suspense>
      <div className="mx-auto max-w-lg px-4 pb-4 pt-2 text-center">
        <PoweredByMenuAlDia />
      </div>
      <CartBottomSpacer />
      <FloatingCart restaurant={data.restaurant} />
    </main>
  );
}
