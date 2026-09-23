/** Bump when guide copy changes materially (forces re-ack). */
export const WHATSAPP_BOT_GUIDE_VERSION = "2026-09-v2";

export type WhatsappBotGuideSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

/**
 * Pre-enablement guide for tenant admins (Pro WhatsApp bot).
 * Softened vs marketing copy: Vision SPEI is Add-On; no “zero errors”.
 */
export const WHATSAPP_BOT_GUIDE_SECTIONS: WhatsappBotGuideSection[] = [
  {
    title: "¿Qué necesitas para empezar?",
    bullets: [
      "Una cuenta personal de Facebook para el botón «Conectar con Meta» (Embedded Signup).",
      "Un número de teléfono (el de tu negocio o una línea nueva Express).",
      "Acceso a SMS o llamadas en ese número para el código de verificación.",
      "Una tarjeta en Meta Business para validar la cuenta del negocio. Responder a clientes que te escriben primero (menú/pedidos) suele usar conversaciones de servicio de Meta (hay cupo gratuito mensual por número). La difusión masiva (módulo IA & Marketing) sí puede generar cargos de Marketing en tu tarjeta de Meta.",
    ],
  },
  {
    title: "Cómo conectar en Menú al Día",
    bullets: [
      "En Ajustes → WhatsApp bot pulsa «Conectar con Meta» y completa la ventana de Facebook (negocio, número y términos).",
      "Cuando veas el estado «conectado», lee esta guía, márcala como leída y activa el asistente.",
      "Prueba escribiendo MENU o hola al número conectado desde otro WhatsApp.",
    ],
  },
  {
    title: "Dos formas de elegir tu número",
    bullets: [
      "Opción A — Número actual: ideal si tus clientes ya lo conocen. Antes debes desvincular WhatsApp del celular (haz respaldo de chats) para que Meta Cloud API tome el número.",
      "Opción B — Línea Express de pedidos (recomendada): un chip/eSIM solo para pedidos. Dejas tu WhatsApp personal intacto y rediriges a clientes al número Express.",
    ],
  },
  {
    title: "Personalización del perfil (WhatsApp Manager / Meta Business Suite)",
    bullets: [
      "Foto de perfil, nombre visible, descripción, dirección, correo, sitio web y redes.",
      "El nombre visible puede requerir revisión breve de Meta si lo cambias.",
      "Puedes enlazar tu menú digital de Menú al Día e Instagram/Facebook/TikTok.",
    ],
  },
  {
    title: "Dudas frecuentes",
    bullets: [
      "¿Pierdo contactos? No: están en la agenda del teléfono (Google/iCloud), no “dentro” de la app.",
      "Antes de desvincular: WhatsApp → Ajustes → Chats → Copia de seguridad (Drive o iCloud).",
      "Si dejas el bot: desconectas en el panel, reinstalas WhatsApp Business, verificas el SMS y restauras el respaldo. El número sigue siendo tuyo.",
    ],
  },
  {
    title: "Día a día",
    bullets: [
      "Con el bot activo, la app WhatsApp tradicional de ese número no atiende como antes: Meta procesa los mensajes.",
      "Para hablar a mano: app Meta Business Suite (móvil) o el tablero de Pedidos en Menú al Día.",
      "El asistente responde menú y puede tomar pedidos; si un cliente se molesta, puedes pausar el bot para ese chat y atender tú.",
    ],
  },
  {
    title: "Ventajas y aspectos a considerar",
    bullets: [
      "Ventaja: atención automática cuando el cliente escribe (PULL), pedidos al tablero Pro, menos mensajes perdidos en hora pico.",
      "Los comprobantes SPEI se reciben en el panel; la etiqueta automática con IA (Vision) es del módulo Add-On. La aprobación del pago la haces tú.",
      "Si el local está cerrado o no aceptas pedidos, el bot no toma pedidos nuevos.",
      "Consideración: la atención manual de ese número es desde Business Suite o laptop, no desde la app WhatsApp clásica vinculada al mismo número en la API.",
    ],
  },
];
