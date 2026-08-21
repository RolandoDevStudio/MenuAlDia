import type { BusinessType } from "@/lib/types";
import { normalizeBusinessType } from "@/lib/business-labels";

export type FaqTemplate = { question: string; answer: string };

const TEMPLATES: Record<BusinessType, FaqTemplate[]> = {
  restaurante: [
    {
      question: "¿Cuál es el tiempo promedio de entrega a domicilio?",
      answer:
        "Depende de la zona y la demanda del día. Te confirmamos el tiempo estimado por WhatsApp al recibir tu pedido.",
    },
    {
      question: "¿Tienen opciones vegetarianas o veganas?",
      answer:
        "Revisa las descripciones de cada platillo en el menú. Si tienes duda, escríbenos por WhatsApp antes de ordenar.",
    },
    {
      question: "¿Aceptan pagos con tarjeta o transferencia?",
      answer:
        "Al confirmar por WhatsApp te indicamos los métodos disponibles (efectivo, transferencia u otros).",
    },
  ],
  servicios: [
    {
      question: "¿Cuál es el tiempo de tolerancia para llegar a mi cita?",
      answer:
        "Te pedimos puntualidad. Si te retrasas, avísanos por WhatsApp; la tolerancia típica es de unos minutos según agenda.",
    },
    {
      question: "¿Aceptan clientes sin cita previa?",
      answer:
        "Sujeto a disponibilidad del día. Te recomendamos agendar con anticipación desde el menú o por WhatsApp.",
    },
  ],
  productos: [
    {
      question: "¿A partir de qué monto el envío es gratis?",
      answer:
        "Consulta el costo de envío en la cabecera del catálogo. Si aplica envío gratis, lo indicamos ahí o por WhatsApp.",
    },
    {
      question: "¿Cómo se pesan y empacan los productos a granel?",
      answer:
        "Los productos por kilo o litro se preparan según la cantidad que indiques en el pedido y se empacan al momento.",
    },
  ],
};

export function faqTemplatesFor(
  businessType: BusinessType | string | null | undefined,
): FaqTemplate[] {
  return TEMPLATES[normalizeBusinessType(businessType)];
}

export const MAX_ACTIVE_FAQS = 8;
