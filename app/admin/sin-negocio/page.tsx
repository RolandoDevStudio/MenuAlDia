"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";

export default function SinNegocioPage() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-12">
      <BrandLogo variant="lockup" size="lg" href="/" />
      <h1 className="mt-6 text-xl font-semibold">Sin negocio vinculado</h1>
      <p className="mt-2 text-sm text-muted">
        Tu usuario de Auth existe, pero no está ligado a ningún tenant en{" "}
        <code className="text-xs">restaurant_members</code>. Por eso el panel no
        puede cargar (y antes entraba en un bucle de redirección).
      </p>
      <p className="mt-3 text-sm text-muted">
        Pide al superadmin que vuelva a crear el acceso (Crear Nuevo Admin) o que
        revise que el alta terminó con rol <strong>owner</strong> en ese
        negocio.
      </p>
      <Button type="button" className="mt-6 min-h-11 w-full" onClick={signOut}>
        Cerrar sesión e intentar de nuevo
      </Button>
    </main>
  );
}
