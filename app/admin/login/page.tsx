"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function AdminLoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nextParam = searchParams.get("next");
  const goingToSuperAdmin = Boolean(nextParam?.startsWith("/super-admin"));

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

    const next = searchParams.get("next");
    let dest =
      next?.startsWith("/") && !next.startsWith("//") ? next : null;

    if (!dest) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      dest = "/admin";
      if (user) {
        const { data: sa } = await supabase
          .from("restaurant_members")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "super_admin")
          .limit(1)
          .maybeSingle();
        if (sa) dest = "/super-admin";
      }
    }

    // Full navigation so auth cookies are sent on the next request
    // (router.push can race middleware and bounce back to login).
    window.location.assign(dest);
  }

  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-4 py-12">
      <BrandLogo variant="lockup" size="lg" href="/" priority />
      <h1 className="mt-6 text-xl font-semibold">
        {goingToSuperAdmin ? "Entrar a Super Admin" : "Entrar al panel"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {goingToSuperAdmin
          ? "Usa la cuenta con rol super_admin de la plataforma."
          : "Usa tu correo de dueño del restaurante."}
      </p>
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
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginForm />
    </Suspense>
  );
}
