"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function SuperAdminSignOut() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/super-admin/login");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="min-h-10 shrink-0 gap-1.5 px-2"
      onClick={() => void signOut()}
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Salir</span>
    </Button>
  );
}
