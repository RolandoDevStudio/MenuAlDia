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
    <div className="mx-auto min-h-full w-full min-w-0 max-w-6xl px-3 pb-6 sm:px-4">
      <header className="sticky top-0 z-40 -mx-3 mb-6 border-b border-black/10 bg-background/95 px-3 py-3 backdrop-blur sm:-mx-4 sm:px-4">
        <div className="mb-2 min-w-0">
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
