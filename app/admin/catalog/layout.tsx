import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";
import { cn } from "@/lib/utils";

export default async function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireTenantSession();
  const supabase = await createClient();
  const { data: dishes } = await supabase
    .from("dishes")
    .select("id, name, is_active")
    .eq("restaurant_id", session.restaurant.id)
    .is("archived_at", null)
    .order("sort_order");

  return (
    <div className="md:grid md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <aside className="mb-4 hidden max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-xl border border-black/5 bg-surface p-2 md:sticky md:top-16 md:mb-0 md:block">
        <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Platillos
        </p>
        <ul className="space-y-0.5">
          <li>
            <Link
              href="/admin/catalog"
              className="block rounded-lg px-2 py-2 text-sm font-medium hover:bg-black/[0.04]"
            >
              Ver todos
            </Link>
          </li>
          <li>
            <Link
              href="/admin/catalog/new"
              className="block rounded-lg px-2 py-2 text-sm font-medium text-brand hover:bg-brand/10"
            >
              + Nuevo
            </Link>
          </li>
          {(dishes ?? []).map((d) => (
            <li key={d.id}>
              <Link
                href={`/admin/catalog/${d.id}`}
                className={cn(
                  "block truncate rounded-lg px-2 py-2 text-sm hover:bg-black/[0.04]",
                  d.is_active === false && "text-muted",
                )}
              >
                {d.name}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
