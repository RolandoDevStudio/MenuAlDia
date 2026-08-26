"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { labelsFor } from "@/lib/business-labels";

type DishLink = { id: string; name: string; is_active: boolean | null };

export function CatalogSidebar({
  businessType,
  dishes,
}: {
  businessType: string | null | undefined;
  dishes: DishLink[];
}) {
  const pathname = usePathname();
  const dishesLabel = labelsFor(businessType).dishes;
  const activeRef = useRef<HTMLAnchorElement>(null);

  const onAll = pathname === "/admin/catalog";
  const onNew = pathname === "/admin/catalog/new";
  const editingId = pathname.startsWith("/admin/catalog/")
    ? pathname.slice("/admin/catalog/".length)
    : "";

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  return (
    <aside className="mb-4 hidden max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-xl border border-black/5 bg-surface p-2 md:sticky md:top-16 md:mb-0 md:block">
      <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
        {dishesLabel}
      </p>
      <ul className="space-y-0.5">
        <li>
          <Link
            href="/admin/catalog"
            className={cn(
              "block rounded-lg px-2 py-2 text-sm font-medium hover:bg-black/[0.04]",
              onAll && "bg-brand/10 text-brand",
            )}
          >
            Ver todos
          </Link>
        </li>
        <li>
          <Link
            href="/admin/catalog/new"
            className={cn(
              "block rounded-lg px-2 py-2 text-sm font-medium hover:bg-black/[0.04]",
              onNew ? "bg-brand/10 text-brand" : "text-brand",
            )}
          >
            + Nuevo
          </Link>
        </li>
        {dishes.map((d) => {
          const active = editingId === d.id;
          return (
            <li key={d.id}>
              <Link
                ref={active ? activeRef : undefined}
                href={`/admin/catalog/${d.id}`}
                className={cn(
                  "block truncate rounded-lg px-2 py-2 text-sm hover:bg-black/[0.04]",
                  d.is_active === false && "text-muted",
                  active && "bg-brand/10 font-medium text-brand",
                )}
              >
                {d.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
