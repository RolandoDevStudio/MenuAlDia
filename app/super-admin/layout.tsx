import Link from "next/link";
import { requireSuperAdmin } from "@/lib/super-admin";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();

  return (
    <div className="mx-auto min-h-full max-w-3xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-4">
        <div>
          <p className="font-[family-name:var(--font-display)] text-3xl text-brand">
            Super Admin
          </p>
          <p className="text-xs text-muted">Control global menualdia.app</p>
        </div>
        <nav className="flex gap-3 text-sm font-semibold">
          <Link href="/super-admin" className="text-brand">
            Resumen
          </Link>
          <Link href="/super-admin/tenants" className="text-muted hover:text-brand">
            Tenants
          </Link>
          <Link href="/admin" className="text-muted hover:text-brand">
            Admin
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
