"use client";

const ROWS = [
  {
    feature: "Velocidad de carga",
    pdf: "Lenta (pesa MBs)",
    delivery: "Rápida",
    mad: "Ultrarrápida (PWA)",
  },
  {
    feature: "Comisión por venta",
    pdf: "0%",
    delivery: "30% – 35%",
    mad: "0% comisión",
  },
  {
    feature: "Actualizar precios",
    pdf: "Rehacer PDF / Canva",
    delivery: "Complejo en panel",
    mad: "Segundos desde el celular",
  },
  {
    feature: "Formato de pedido",
    pdf: "Texto plano suelto",
    delivery: "Vía app",
    mad: "WhatsApp estructurado",
  },
  {
    feature: "Dueño de los clientes",
    pdf: "Nadie",
    delivery: "La app",
    mad: "100% tu negocio",
  },
] as const;

export function ValueMatrix() {
  return (
    <div className="space-y-4">
      <ul className="space-y-3 md:hidden">
        {ROWS.map((row) => (
          <li
            key={row.feature}
            className="rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-sm font-semibold text-foreground">
              {row.feature}
            </p>
            <dl className="mt-2 space-y-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">PDF / Drive</dt>
                <dd className="text-right font-medium">{row.pdf}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Delivery apps</dt>
                <dd className="text-right font-medium">{row.delivery}</dd>
              </div>
              <div className="flex justify-between gap-2 border-t border-brand/15 pt-1.5">
                <dt className="font-semibold text-brand">Menú al Día</dt>
                <dd className="text-right font-semibold text-brand">
                  {row.mad}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-2xl border border-black/10 bg-white shadow-sm md:block">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-black/[0.02] text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-semibold">Característica</th>
              <th className="px-4 py-3 font-semibold">PDF / Drive</th>
              <th className="px-4 py-3 font-semibold">Delivery apps</th>
              <th className="px-4 py-3 font-semibold text-brand">
                Menú al Día
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr
                key={row.feature}
                className="border-t border-black/5 align-top"
              >
                <th className="px-4 py-3 font-semibold text-foreground">
                  {row.feature}
                </th>
                <td className="px-4 py-3 text-muted">{row.pdf}</td>
                <td className="px-4 py-3 text-muted">{row.delivery}</td>
                <td className="px-4 py-3 font-medium text-brand">{row.mad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
