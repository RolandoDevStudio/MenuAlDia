import { CrmConsole } from "@/components/super-admin/crm-console";
import { Suspense } from "react";

export default function SuperAdminCrmPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">CRM</h1>
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
