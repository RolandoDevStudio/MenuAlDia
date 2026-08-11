"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ImageIcon,
  LayoutGrid,
  LogOut,
  Settings,
  UtensilsCrossed,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/admin", label: "Hoy", icon: UtensilsCrossed },
  { href: "/admin/catalog", label: "Catálogo", icon: LayoutGrid },
  { href: "/admin/flyer", label: "Flyer", icon: ImageIcon },
  { href: "/admin/settings", label: "Ajustes", icon: Settings },
];

export function AdminShell({
  restaurantName,
  children,
}: {
  restaurantName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div
      className="mx-auto flex min-h-full w-full max-w-lg flex-col"
      style={{
        paddingBottom: "calc(6rem + env(safe-area-inset-bottom))",
      }}
    >
      <header className="sticky top-0 z-20 border-b border-black/5 bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-display)] text-2xl text-brand">
              Menú al Día
            </p>
            <p className="truncate text-xs text-muted">{restaurantName}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Salir">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>
      <div className="flex-1 px-4 py-4">{children}</div>
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-black/10 bg-surface/95 backdrop-blur"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-lg justify-around px-2 pt-2">
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-11 min-w-[4.25rem] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium",
                  active ? "text-brand" : "text-muted",
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
