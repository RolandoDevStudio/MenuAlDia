export type CrmHelpEntry = {
  title: string;
  what: string;
  how: string;
  ifBad: string;
};

export const CRM_HELP: Record<string, CrmHelpEntry> = {
  overview: {
    title: "Cómo leer el CRM",
    what: "Arriba ves cifras de toda la plataforma. Abajo, gráficos y la lista cambian con filtros y con “Hoy conviene”.",
    how: "Las cifras globales no se recortan al filtrar. La vista filtrada sí.",
    ifBad: "Si una cifra global está mal, el bloque “Hoy conviene” te dice a quién ver primero.",
  },
  active: {
    title: "Activos",
    what: "Negocios con suscripción vigente (activos y fecha de vencimiento en el futuro).",
    how: "Cuenta tenants reales; las demos oficiales no entran.",
    ifBad: "Si baja de golpe, revisa vencimientos a 7 días y cobranza.",
  },
  foundersActive: {
    title: "Fundadores activos",
    what: "Socios fundadores que aún tienen el plan vigente.",
    how: "Mismo criterio de activo, solo con la marca de fundador.",
    ifBad: "Si hay fundadores incompletos, “Hoy conviene” te los lista para entrar en modo Soporte.",
  },
  mrr: {
    title: "MRR lista",
    what: "Ingreso mensual teórico si todos los activos pagaran el precio de lista de su plan.",
    how: "Suma del precio mensual CMS de cada activo. No es lo cobrado.",
    ifBad: "Compáralo con caja del mes: si la caja es mucho menor, hay atraso de cobro.",
  },
  arr: {
    title: "ARR",
    what: "MRR lista × 12. Orden de magnitud anual, no un contrato firmado.",
    how: "Se deriva del MRR; no hay facturación anual real detrás.",
    ifBad: "Úsalo para plática; las decisiones del día salen de caja y churn.",
  },
  cashMonth: {
    title: "Caja del mes",
    what: "Suma de pagos registrados este mes calendario (no anulados).",
    how: "Sale de Finanzas / tenant_payments.",
    ifBad: "Si está muy por debajo del MRR, ve a Finanzas o filtra a quienes vencen pronto.",
  },
  churn30: {
    title: "Churn 30d",
    what: "De quienes se les venció el plan en los últimos 30 días, qué proporción “salió” frente a los que siguen activos.",
    how: "Aprox.: vencidos en 30d / (activos + esos vencidos). No es un historial de bajas.",
    ifBad: "Habla antes del vencimiento (+7d) y revisa onboarding incompleto.",
  },
  retentionM1: {
    title: "Retención M1",
    what: "De un mes de altas, cuántos seguían activos al cerrar el mes siguiente.",
    how: "Última cohorte ya cerrada. El mes en curso se marca “en curso”.",
    ifBad: "Si baja del 60%, el hueco suele ser el fin de la prueba: contacta antes de que venza.",
  },
  ctr30: {
    title: "CTR WA 30d",
    what: "Clics al botón de WhatsApp / visitas al menú en 30 días. Son eventos, no personas únicas.",
    how: "0 visitas = no comparten el link. Visitas y 0 clics = el menú no convence.",
    ifBad: "“Hoy conviene” te separa esos dos casos para que no mezcles difusión con conversión.",
  },
  paidConversion: {
    title: "Conversión pago",
    what: "Porcentaje de negocios (no demo) que ya tienen al menos un pago.",
    how: "Pagos no anulados / total de tenants.",
    ifBad: "Si es baja, prioriza fundadores y pruebas que ya armó el menú.",
  },
  ltv: {
    title: "LTV medio",
    what: "Promedio de lo que ha pagado un negocio que sí pagó al menos una vez.",
    how: "Suma de pagos por tenant, luego promedio. No descuenta churn futuro.",
    ifBad: "Con pocos pagos el número salta; míralo junto a retención M1.",
  },
  ordersMonth: {
    title: "Pedidos mes",
    what: "Pedidos registrados este mes, partidos en recoger vs envío. No hay comedor.",
    how: "order_logs del mes calendario.",
    ifBad: "Si hay visitas y casi no hay pedidos, mira el CTR de WhatsApp.",
  },
  foundersPaid: {
    title: "Fundadores con pago",
    what: "Qué parte de los socios fundadores ya dejó un pago registrado.",
    how: "Fundadores con ≥1 pago / total fundadores.",
    ifBad: "Si armaste el menú tú y aún no pagan, el tema es cobro, no onboarding.",
  },
  mix: {
    title: "Mix global",
    what: "Cómo se reparte la base activa por plan, fundadores y origen de alta.",
    how: "Conteo de tenants; origen vacío = aún no lo capturaste al crear/editar.",
    ifBad: "Si casi todo es “sin origen”, llénalo en Tenants para saber qué canal sí convierte.",
  },
  cohorts: {
    title: "Retención M0 → M1",
    what: "Altas por mes y % que siguen activos un mes después.",
    how: "No se recorta con los filtros de la vista (plan/origen). El gráfico de retención es global.",
    ifBad: "Una caída en un mes concreto suele coincidir con el fin de descuento o prueba.",
  },
  charts: {
    title: "Vista filtrada",
    what: "Gráficos y lista de acción según plan, origen, fundador o una tarjeta de “Hoy conviene”.",
    how: "Mix y embudo usan el subset filtrado. La retención por cohorte sigue siendo global.",
    ifBad: "Quita el chip “Viendo: …” para volver a la lista de quien necesita acción.",
  },
  actionList: {
    title: "Lista de acción",
    what: "Los negocios sobre los que puedes escribir, entrar en Soporte o alargar días.",
    how: "Sin filtro: colas de onboarding + riesgo. Con “Hoy conviene”: solo esa señal.",
    ifBad: "Fundadores: Soporte. Resto: WhatsApp o copiar mensaje si no hay número.",
  },
};

export function crmHelp(id: string): CrmHelpEntry {
  return CRM_HELP[id] ?? CRM_HELP.overview;
}
