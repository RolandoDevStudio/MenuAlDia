import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";
import { CatalogSidebar } from "@/components/admin/catalog-sidebar";

export default async function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireTenantSession();
  const supabase = await createClient();
  const { data: dishes } = await supabase
    .from("dishes")
    .select("id, name, is_active")
    .eq("restaurant_id", session.restaurant.id)
    .is("archived_at", null)
    .order("sort_order");

  return (
    <div className="md:grid md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <CatalogSidebar
        businessType={session.restaurant.business_type}
        dishes={dishes ?? []}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
