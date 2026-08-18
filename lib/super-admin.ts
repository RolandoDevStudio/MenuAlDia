import { redirect } from "next/navigation";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";

export async function requireSuperAdmin() {
  const ok = await isCurrentUserSuperAdmin();
  if (!ok) redirect("/admin");
}
