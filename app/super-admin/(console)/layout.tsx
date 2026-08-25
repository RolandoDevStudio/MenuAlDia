import { requireSuperAdmin } from "@/lib/super-admin";
import { BrandLogo } from "@/components/brand/brand-logo";
import { SuperAdminNav } from "@/components/super-admin/super-admin-nav";

export default async function SuperAdminConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();

  return (
    <div className="mx-auto min-h-full w-full min-w-0 max-w-6xl px-3 py-6 sm:px-4">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-4">
        <div className="min-w-0">
          <BrandLogo variant="lockup" size="md" href="/super-admin" />
          <p className="mt-1 text-xs text-muted">
            Super Admin · control global menualdia.com.mx
          </p>
        </div>
        <SuperAdminNav />
      </header>
      <div className="min-w-0 w-full">{children}</div>
    </div>
  );
}
