import { notFound } from "next/navigation";
import { getPublicMenuBySlug } from "@/lib/restaurant";
import { RestaurantHeader } from "@/components/public/restaurant-header";
import { DailyMenuHero } from "@/components/public/daily-menu-hero";
import { CatalogSection } from "@/components/public/catalog-section";
import {
  CartBottomSpacer,
  FloatingCart,
} from "@/components/public/floating-cart";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const data = await getPublicMenuBySlug(slug);
  if (!data) return { title: "Menú no encontrado" };
  return {
    title: `${data.restaurant.name} — Menú al Día`,
    description: data.restaurant.slogan,
  };
}

export default async function PublicMenuPage({ params }: Props) {
  const { slug } = await params;
  const data = await getPublicMenuBySlug(slug);
  if (!data) notFound();

  const packagePrice = Number(data.dailyMenu?.package_price ?? 0);
  const maxSides = data.dailyMenu?.max_sides ?? 2;

  return (
    <main className="relative min-h-full overflow-x-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-90"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 90% 50% at 10% 0%, #f0d4b8 0%, transparent 55%), radial-gradient(ellipse 70% 40% at 100% 10%, #e8c49a 0%, transparent 50%), linear-gradient(180deg, #faf6f1 0%, #f3e8dc 100%)",
        }}
      />
      <RestaurantHeader restaurant={data.restaurant} />
      <DailyMenuHero
        dishes={data.dailyDishes}
        sides={data.dailySides}
        packagePrice={packagePrice}
        maxSides={maxSides}
      />
      <CatalogSection categories={data.categories} dishes={data.dishes} />
      <CartBottomSpacer />
      <FloatingCart restaurant={data.restaurant} />
    </main>
  );
}
