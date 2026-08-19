/** Catálogo canónico de estados MX + ciudades principales (sugerencias). */

export type MxState = {
  code: string;
  name: string;
};

export const MX_STATES: MxState[] = [
  { code: "AGU", name: "Aguascalientes" },
  { code: "BCN", name: "Baja California" },
  { code: "BCS", name: "Baja California Sur" },
  { code: "CAM", name: "Campeche" },
  { code: "CHP", name: "Chiapas" },
  { code: "CHH", name: "Chihuahua" },
  { code: "CMX", name: "Ciudad de México" },
  { code: "COA", name: "Coahuila" },
  { code: "COL", name: "Colima" },
  { code: "DUR", name: "Durango" },
  { code: "GUA", name: "Guanajuato" },
  { code: "GRO", name: "Guerrero" },
  { code: "HID", name: "Hidalgo" },
  { code: "JAL", name: "Jalisco" },
  { code: "MEX", name: "Estado de México" },
  { code: "MIC", name: "Michoacán" },
  { code: "MOR", name: "Morelos" },
  { code: "NAY", name: "Nayarit" },
  { code: "NLE", name: "Nuevo León" },
  { code: "OAX", name: "Oaxaca" },
  { code: "PUE", name: "Puebla" },
  { code: "QUE", name: "Querétaro" },
  { code: "ROO", name: "Quintana Roo" },
  { code: "SLP", name: "San Luis Potosí" },
  { code: "SIN", name: "Sinaloa" },
  { code: "SON", name: "Sonora" },
  { code: "TAB", name: "Tabasco" },
  { code: "TAM", name: "Tamaulipas" },
  { code: "TLA", name: "Tlaxcala" },
  { code: "VER", name: "Veracruz" },
  { code: "YUC", name: "Yucatán" },
  { code: "ZAC", name: "Zacatecas" },
];

const STATE_BY_CODE = new Map(MX_STATES.map((s) => [s.code, s]));

/** Alias comunes → código (legacy free-text). */
const STATE_ALIASES: Record<string, string> = {
  aguascalientes: "AGU",
  "baja california": "BCN",
  bc: "BCN",
  "baja california sur": "BCS",
  bcs: "BCS",
  campeche: "CAM",
  chiapas: "CHP",
  chihuahua: "CHH",
  "ciudad de mexico": "CMX",
  "ciudad de méxico": "CMX",
  cdmx: "CMX",
  df: "CMX",
  "cd mexico": "CMX",
  coahuila: "COA",
  colima: "COL",
  durango: "DUR",
  guanajuato: "GUA",
  guerrero: "GRO",
  hidalgo: "HID",
  jalisco: "JAL",
  "estado de mexico": "MEX",
  "estado de méxico": "MEX",
  "edo de mexico": "MEX",
  "edo. de mexico": "MEX",
  mexico: "MEX",
  méxico: "MEX",
  michoacan: "MIC",
  michoacán: "MIC",
  morelos: "MOR",
  nayarit: "NAY",
  "nuevo leon": "NLE",
  "nuevo león": "NLE",
  nl: "NLE",
  "n.l.": "NLE",
  "n.l": "NLE",
  oaxaca: "OAX",
  puebla: "PUE",
  queretaro: "QUE",
  querétaro: "QUE",
  "quintana roo": "ROO",
  qroo: "ROO",
  "san luis potosi": "SLP",
  "san luis potosí": "SLP",
  slp: "SLP",
  sinaloa: "SIN",
  sonora: "SON",
  tabasco: "TAB",
  tamaulipas: "TAM",
  tlaxcala: "TLA",
  veracruz: "VER",
  yucatan: "YUC",
  yucatán: "YUC",
  zacatecas: "ZAC",
};

export const MAJOR_CITIES_BY_STATE: Record<string, string[]> = {
  AGU: ["Aguascalientes", "Jesús María"],
  BCN: ["Tijuana", "Mexicali", "Ensenada", "Rosarito"],
  BCS: ["La Paz", "Los Cabos", "Cabo San Lucas", "San José del Cabo"],
  CAM: ["Campeche", "Ciudad del Carmen"],
  CHP: ["Tuxtla Gutiérrez", "San Cristóbal de las Casas", "Tapachula"],
  CHH: ["Chihuahua", "Ciudad Juárez", "Delicias"],
  CMX: [
    "Álvaro Obregón",
    "Benito Juárez",
    "Coyoacán",
    "Cuauhtémoc",
    "Gustavo A. Madero",
    "Iztapalapa",
    "Miguel Hidalgo",
    "Tlalpan",
  ],
  COA: ["Saltillo", "Torreón", "Monclova", "Piedras Negras"],
  COL: ["Colima", "Manzanillo", "Tecomán"],
  DUR: ["Durango", "Gómez Palacio", "Lerdo"],
  GUA: ["León", "Guanajuato", "Irapuato", "Celaya", "Salamanca"],
  GRO: ["Acapulco", "Chilpancingo", "Iguala", "Zihuatanejo"],
  HID: ["Pachuca", "Tulancingo", "Tula"],
  JAL: ["Guadalajara", "Zapopan", "Tlaquepaque", "Tonalá", "Puerto Vallarta"],
  MEX: ["Toluca", "Naucalpan", "Tlalnepantla", "Ecatepec", "Nezahualcóyotl"],
  MIC: ["Morelia", "Uruapan", "Zamora", "Lázaro Cárdenas"],
  MOR: ["Cuernavaca", "Jiutepec", "Cuautla"],
  NAY: ["Tepic", "Bahía de Banderas", "Santiago Ixcuintla"],
  NLE: ["Monterrey", "San Pedro Garza García", "San Nicolás", "Guadalupe", "Apodaca"],
  OAX: ["Oaxaca de Juárez", "Salina Cruz", "Juchitán"],
  PUE: ["Puebla", "Tehuacán", "San Martín Texmelucan"],
  QUE: ["Querétaro", "San Juan del Río", "El Marqués"],
  ROO: ["Cancún", "Playa del Carmen", "Chetumal", "Tulum"],
  SLP: ["San Luis Potosí", "Soledad de Graciano Sánchez", "Ciudad Valles"],
  SIN: ["Culiacán", "Mazatlán", "Los Mochis"],
  SON: ["Hermosillo", "Ciudad Obregón", "Nogales", "Guaymas"],
  TAB: ["Villahermosa", "Cárdenas", "Comalcalco"],
  TAM: ["Tampico", "Reynosa", "Matamoros", "Ciudad Victoria", "Nuevo Laredo"],
  TLA: ["Tlaxcala", "Apizaco", "Huamantla"],
  VER: ["Veracruz", "Xalapa", "Coatzacoalcos", "Orizaba", "Poza Rica"],
  YUC: ["Mérida", "Valladolid", "Progreso"],
  ZAC: ["Zacatecas", "Fresnillo", "Guadalupe"],
};

export function isMxStateCode(code: string): boolean {
  return STATE_BY_CODE.has(code.trim().toUpperCase());
}

export function stateLabel(code: string | null | undefined): string {
  if (!code) return "";
  const c = code.trim().toUpperCase();
  return STATE_BY_CODE.get(c)?.name ?? code;
}

/** Normaliza texto libre legacy → código, o "" si no hay match. */
export function normalizeLegacyState(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const upper = trimmed.toUpperCase();
  if (STATE_BY_CODE.has(upper)) return upper;
  const key = trimmed
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (STATE_ALIASES[key]) return STATE_ALIASES[key];
  // try without accents already done
  const noAccent = key;
  for (const [alias, code] of Object.entries(STATE_ALIASES)) {
    if (alias === noAccent) return code;
  }
  return "";
}

export function citiesForState(code: string): string[] {
  return MAJOR_CITIES_BY_STATE[code.trim().toUpperCase()] ?? [];
}

export function formatPlaceLine(
  city: string | null | undefined,
  stateCode: string | null | undefined,
): string {
  const c = (city ?? "").trim();
  const s = stateLabel(stateCode);
  return [c, s].filter(Boolean).join(", ");
}
