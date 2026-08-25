import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionRestaurant } from "@/lib/restaurant";
import type { MemberRole, Restaurant } from "@/lib/types";

export type TenantSession = {
  restaurant: Restaurant;
  userId: string;
  role: MemberRole;
  supportMode?: boolean;
};

/**
 * For admin pages: breaks the login↔admin redirect loop when the Auth user
 * exists but has no restaurant_members row.
 */
export async function requireTenantSession(): Promise<TenantSession> {
  const session = await getSessionRestaurant();
  if (session) return session;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/admin/sin-negocio");
  }
  redirect("/admin/login");
}
