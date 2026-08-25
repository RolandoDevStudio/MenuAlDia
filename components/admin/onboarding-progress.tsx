import Link from "next/link";
import type { OnboardingFlags } from "@/lib/super-admin-crm";
import { missingOnboardingSteps } from "@/lib/super-admin-crm";

const STEPS: {
  key: keyof OnboardingFlags;
  label: string;
  href: string;
}[] = [
  { key: "hasLogoOrBanner", label: "Sube logo o portada", href: "/admin/settings" },
  { key: "hasEnoughDishes", label: "Agrega más de 5 productos", href: "/admin/catalog" },
  { key: "hasWhatsApp", label: "Configura tu WhatsApp", href: "/admin/settings" },
  { key: "hasCategory", label: "Crea al menos 1 categoría", href: "/admin/catalog" },
];

export function OnboardingProgress({
  score,
  flags,
}: {
  score: number;
  flags: OnboardingFlags;
}) {
  if (score >= 100) return null;
  const left = missingOnboardingSteps(flags);
  return (
    <div className="mx-4 mb-3 rounded-xl border border-brand/20 bg-brand/5 px-3 py-3 print:hidden">
      <p className="text-sm font-semibold">
        Tu menú está listo al {score}% — {left} paso{left === 1 ? "" : "s"}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
        <div
          className="h-full rounded-full bg-brand"
          style={{ width: `${score}%` }}
        />
      </div>
      <ul className="mt-2 space-y-1">
        {STEPS.map((s) => (
          <li key={s.key} className="text-xs">
            {flags[s.key] ? (
              <span className="text-muted">Listo: {s.label}</span>
            ) : (
              <Link href={s.href} className="font-medium text-brand underline-offset-2 hover:underline">
                {s.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
