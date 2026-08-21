"use client";

const ROWS = [
  {
    attribute: "Control y Actualización del Negocio",
    competitor:
      "Dependen de terceros para actualizar precios o terminan abandonando el menú por ser difícil de editar de forma autónoma.",
    ours:
      "Autonomía total gracias a un panel de administración propio y PWA en el celular para cambiar precios, platillos y flyers de manera instantánea en 1 clic.",
  },
  {
    attribute: "Generación y Difusión de Ventas",
    competitor:
      "Catálogo pasivo y estático (esperar a que el cliente escanee y entre por casualidad al código QR).",
    ours:
      "Herramientas activas de atracción que incluyen generador de flyers diarios, formato de Cita Express y el mapa de exploración local.",
  },
  {
    attribute: "Retención y Relación con Clientes",
    competitor:
      "Inexistente; no guardan datos de los consumidores finales ni permiten dar seguimiento.",
    ours:
      "Módulo integral de CRM y Lealtad con tarjeta digital de puntos, fotos de referencias de servicio y control automatizado de visitas recurrentes.",
  },
  {
    attribute: "Propuesta de Valor y Propósito",
    competitor:
      '"Te entregamos tu menú una sola vez y te dejamos operar por tu cuenta."',
    ours:
      '"Te ayudamos a que tus clientes vuelvan cada semana, aumentes tus ventas y fidelices tu base de consumidores."',
  },
] as const;

export function ComparisonTable() {
  return (
    <div className="mt-8 overflow-x-auto rounded-2xl border border-black/10 bg-white shadow-sm">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-black/10">
            <th className="px-4 py-3 font-semibold text-muted">
              Atributo / Característica
            </th>
            <th className="px-4 py-3 font-semibold text-muted">
              Modelo de Pago Único
            </th>
            <th className="bg-brand/10 px-4 py-3 font-semibold text-brand-dark">
              Menú al Día
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.attribute} className="border-b border-black/5 align-top">
              <th
                scope="row"
                className="px-4 py-4 font-semibold text-foreground"
              >
                {row.attribute}
              </th>
              <td className="px-4 py-4 text-muted leading-relaxed">
                {row.competitor}
              </td>
              <td className="border-l border-brand/20 bg-brand/5 px-4 py-4 font-medium leading-relaxed text-foreground">
                {row.ours}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
