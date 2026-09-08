"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OrderPrintToolbar({ folio }: { folio: number | null }) {
  return (
    <div className="print:hidden space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="secondary" className="min-h-11">
          <Link href="/admin/orders">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Volver a pedidos
          </Link>
        </Button>
        <Button
          type="button"
          className="min-h-11"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" aria-hidden />
          Imprimir
        </Button>
      </div>
      <p className="text-center text-sm text-muted">
        {folio != null ? `Comanda #${folio}. ` : ""}
        Si el diálogo de impresión no apareció, usa Imprimir.
      </p>
    </div>
  );
}
