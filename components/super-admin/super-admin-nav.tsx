"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS: {
  href: string;
  label: string;
  exact?: boolean;
  title?: string;
}[] = [
  { href: "/super-admin", label: "Resumen", exact: true },
  { href: "/super-admin/crm", label: "CRM" },
  { href: "/super-admin/tenants", label: "Tenants" },
  { href: "/super-admin/finanzas", label: "Finanzas" },
  { href: "/super-admin/solicitudes", label: "Solicitudes" },
  { href: "/super-admin/promociones", label: "Promociones" },
  {
    href: "/super-admin/templates",
    label: "Semillas",
    title: "Semillas demo por giro × plan",
  },
  { href: "/super-admin/settings", label: "CMS" },
];

export function SuperAdminNav() {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [pathname]);

  return (
    <nav className="min-w-0" aria-label="Super admin">
      <div className="-mx-1 flex flex-nowrap gap-1 overflow-x-auto px-1 scrollbar-thin lg:flex-wrap lg:overflow-visible">
        {LINKS.map((l) => {
          const active = l.exact
            ? pathname === l.href
            : pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <Link
              key={l.href}
              href={l.href}
              title={l.title}
              ref={active ? activeRef : undefined}
              className={cn(
                "min-h-10 shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold",
                active
                  ? "bg-brand/10 text-brand"
                  : "text-muted hover:bg-black/5 hover:text-brand",
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
