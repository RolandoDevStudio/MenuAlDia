import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";

type Props = {
  params: Promise<{ slug: string; flyerId: string }>;
};

async function loadFlyer(slug: string, flyerId: string) {
  const supabase = createPublicClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name, slug, is_active")
    .eq("slug", slug)
    .maybeSingle();
  if (!restaurant || restaurant.is_active === false) return null;

  const { data: flyer } = await supabase
    .from("flyers")
    .select("id, title, png_path, is_active, expires_at, restaurant_id")
    .eq("id", flyerId)
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();

  if (!flyer || !flyer.is_active) return null;
  if (flyer.expires_at && new Date(flyer.expires_at).getTime() < Date.now()) {
    return null;
  }
  if (!flyer.png_path) return null;

  return { restaurant, flyer };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, flyerId } = await params;
  const data = await loadFlyer(slug, flyerId);
  if (!data) {
    return { title: "Promo no disponible" };
  }
  const title =
    data.flyer.title?.trim() ||
    `Promo — ${data.restaurant.name}`;
  const description = `Mira la promoción de ${data.restaurant.name} en Menú al Día`;
  const image = data.flyer.png_path!;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "Menú al Día",
      images: [{ url: image }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function PublicFlyerOgPage({ params }: Props) {
  const { slug, flyerId } = await params;
  const data = await loadFlyer(slug, flyerId);
  if (!data) notFound();
  redirect(`/${slug}?flyer=${encodeURIComponent(flyerId)}`);
}
