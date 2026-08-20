"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SuperAdminLoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const wrongAccount = searchParams.get("reason") === "not-sa";

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/super-admin/login");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setLoading(false);
      setError(authError.message);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setError("No se pudo verificar la sesión");
      return;
    }

    const { data: sa } = await supabase
      .from("restaurant_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .limit(1)
      .maybeSingle();

    if (!sa) {
      await supabase.auth.signOut();
      setLoading(false);
      setError(
        "Esta cuenta no tiene rol super_admin. Usa la cuenta de plataforma.",
      );
      return;
    }

    const next = searchParams.get("next");
    const dest =
      next?.startsWith("/") &&
      !next.startsWith("//") &&
      next.startsWith("/super-admin") &&
      !next.startsWith("/super-admin/login")
        ? next
        : "/super-admin";

    window.location.assign(dest);
  }

  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-4 py-12">
      <BrandLogo variant="lockup" size="lg" href="/" priority />
      <h1 className="mt-6 text-xl font-semibold">Super Admin</h1>
      <p className="mt-1 text-sm text-muted">
        Acceso a la consola de plataforma · menualdia.com.mx
      </p>

      {wrongAccount ? (
        <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-brand-dark">
          <p>
            Estás en una cuenta de negocio (p. ej. demo), no de Super Admin.
            Cierra sesión e ingresa con la cuenta de plataforma.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 w-full"
            disabled={signingOut}
            onClick={() => void signOut()}
          >
            {signingOut ? "Cerrando…" : "Cerrar sesión"}
          </Button>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" className="w-full min-h-11" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </main>
  );
}

export default function SuperAdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <SuperAdminLoginForm />
    </Suspense>
  );
}
