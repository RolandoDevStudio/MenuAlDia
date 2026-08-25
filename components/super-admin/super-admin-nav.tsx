"use client";

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
  return (
    <nav className="flex flex-wrap gap-3 text-sm font-semibold">
      {LINKS.map((l) => {
        const active = l.exact
          ? pathname === l.href
          : pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            title={l.title}
            className={cn(
              active ? "text-brand" : "text-muted hover:text-brand",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
