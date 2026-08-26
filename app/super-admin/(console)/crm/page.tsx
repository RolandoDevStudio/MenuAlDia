import { Suspense } from "react";
import { CrmConsole } from "@/components/super-admin/crm-console";
import { Emoji } from "@/components/ui-emoji";
import { UI_EMOJI } from "@/lib/ui-emoji";

export default function SuperAdminCrmPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">
          <Emoji char={UI_EMOJI.crm} />
          CRM
        </h1>
        <p className="text-sm text-muted">
          Salud de tenants, onboarding y colas de acción. Resumen sigue siendo
          alertas operativas; Tenants sigue siendo el CRUD.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Cargando CRM…</p>}>
        <CrmConsole />
      </Suspense>
    </div>
  );
}
