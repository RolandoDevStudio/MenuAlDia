import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";
import { label } from "@/lib/business-labels";
import { DishForm } from "@/components/admin/dish-form";
import type { Category, Dish } from "@/lib/types";

type Props = { params: Promise<{ dishId: string }> };

export default async function DishEditPage({ params }: Props) {
  const { dishId } = await params;
  const session = await requireTenantSession();

  const businessType = session.restaurant.business_type;
  const dishLabel = label(businessType, "dish");

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("restaurant_id", session.restaurant.id)
    .order("sort_order");

  const { count: photoCount } = await supabase
    .from("dishes")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", session.restaurant.id)
    .is("archived_at", null)
    .not("photo_url", "is", null)
    .neq("photo_url", "");

  let dish: Dish | null = null;
  if (dishId !== "new") {
    const { data } = await supabase
      .from("dishes")
      .select("*")
      .eq("id", dishId)
      .eq("restaurant_id", session.restaurant.id)
      .maybeSingle();
    if (!data) notFound();
    dish = data as Dish;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">
        {dish
          ? `Editar ${dishLabel.toLowerCase()}`
          : `Nuevo ${dishLabel.toLowerCase()}`}
      </h1>
      <DishForm
        restaurantId={session.restaurant.id}
        categories={(categories ?? []) as Category[]}
        dish={dish}
        publicSlug={session.restaurant.slug}
        planType={session.restaurant.plan_type}
        currentPhotoCount={photoCount ?? 0}
        businessType={businessType}
      />
    </div>
  );
}
