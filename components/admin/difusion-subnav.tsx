"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/difusion", label: "Mensaje" },
  { href: "/admin/flyer", label: "Flyer" },
  { href: "/admin/flyers", label: "Galería" },
] as const;

export function DifusionSubnav() {
  const pathname = usePathname();
  return (
    <nav
      className="sticky top-[3.25rem] z-10 -mx-4 mb-4 border-b border-black/5 bg-background/95 px-4 backdrop-blur"
      aria-label="Difusión"
    >
      <div className="flex gap-1">
        {TABS.map((t) => {
          const active =
            t.href === "/admin/difusion"
              ? pathname === "/admin/difusion"
              : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "min-h-11 flex-1 rounded-t-lg px-2 py-2.5 text-center text-sm font-medium",
                active
                  ? "border-b-2 border-brand text-brand"
                  : "text-muted hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
