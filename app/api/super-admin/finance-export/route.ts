import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";
import { PLAN_LABELS, type PlanType } from "@/lib/plans";

function csvCell(v: unknown) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Monthly accountant export: CSV of tenant_payments. */
export async function GET(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const month = new URL(request.url).searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "month required (YYYY-MM)" },
      { status: 400 },
    );
  }

  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const end = new Date(Date.UTC(y, m, 1)).toISOString();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_payments")
    .select("*, restaurants ( name, slug, owner_name )")
    .gte("paid_at", start)
    .lt("paid_at", end)
    .order("paid_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const header = [
    "Fecha Depósito",
    "Negocio",
    "Slug",
    "Dueño",
    "Monto ($)",
    "Moneda",
    "Método",
    "Plan",
    "Periodo (días)",
    "Clave Rastreo SPEI",
    "Requiere Factura",
    "RFC Cliente",
    "Estatus Factura",
    "Comprobante URL",
    "Notas",
  ].join(",");

  const body = rows
    .map((p) => {
      const r = p.restaurants as
        | { name?: string; slug?: string; owner_name?: string }
        | null
        | undefined;
      const needs = p.needs_invoice ? "Sí" : "No";
      const invoiceStatus = p.needs_invoice ? "Pendiente" : "Global";
      const rfc = p.needs_invoice ? "" : "XAXX010101000";
      return [
        new Date(p.paid_at).toLocaleDateString("es-MX"),
        csvCell(r?.name),
        csvCell(r?.slug),
        csvCell(r?.owner_name),
        Number(p.amount).toFixed(2),
        p.currency || "MXN",
        p.method,
        csvCell(PLAN_LABELS[p.plan_type as PlanType] ?? p.plan_type),
        p.period_days,
        csvCell(p.reference),
        needs,
        rfc,
        invoiceStatus,
        csvCell(p.receipt_url),
        csvCell(p.notes),
      ].join(",");
    })
    .join("\n");

  const csv = `\uFEFF${header}\n${body}\n`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="menualdia-pagos-${month}.csv"`,
    },
  });
}
