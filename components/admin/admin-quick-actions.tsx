"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { can, type PlanType } from "@/lib/plans";

export function AdminQuickActions({
  plan,
  dishLabel,
}: {
  plan: PlanType | string;
  dishLabel: string;
}) {
  return (
    <details className="rounded-xl border border-black/5 bg-surface">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
        Acciones rápidas ▸
      </summary>
      <div className="flex flex-wrap gap-2 border-t border-black/5 px-4 py-3">
        {can(plan, "flyer") ? (
          <Button asChild size="sm" variant="secondary">
            <Link href="/admin/difusion">Compartir en WhatsApp</Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="secondary">
            <Link href="/admin/settings">Ver mi plan</Link>
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/catalog/new">
            Agregar {dishLabel.toLowerCase()}
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/promociones">Crear cupón</Link>
        </Button>
        {can(plan, "flyer") ? (
          <>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/flyer?from=today">Generar Flyer</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/flyers">Galería</Link>
            </Button>
          </>
        ) : null}
      </div>
    </details>
  );
}
