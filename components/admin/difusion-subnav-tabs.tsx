"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function DifusionSubnavTabs({
  showFlyerTabs,
}: {
  showFlyerTabs: boolean;
}) {
  const pathname = usePathname();
  const tabs = [
    { href: "/admin/difusion", label: "Mensaje", exact: true },
    { href: "/admin/difusion/kit", label: "Kit", exact: false },
    ...(showFlyerTabs
      ? [
          { href: "/admin/flyer", label: "Flyer", exact: false },
          { href: "/admin/flyers", label: "Galería", exact: false },
        ]
      : []),
  ];

  return (
    <nav
      className="sticky top-[3.25rem] z-10 -mx-4 mb-4 border-b border-black/5 bg-background/95 px-4 backdrop-blur"
      aria-label="Difusión"
    >
      <div className="flex flex-nowrap gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const active = t.exact
            ? pathname === t.href
            : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "min-h-11 shrink-0 whitespace-nowrap rounded-t-lg px-3 py-2.5 text-center text-sm font-medium",
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
