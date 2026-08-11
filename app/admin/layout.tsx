import { AdminShell } from "@/components/admin/admin-shell";
import { getSessionRestaurant } from "@/lib/restaurant";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionRestaurant();

  if (!session) {
    return <>{children}</>;
  }

  return (
    <AdminShell restaurantName={session.restaurant.name}>{children}</AdminShell>
  );
}
