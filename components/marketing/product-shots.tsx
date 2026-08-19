import { ImageIcon, Smartphone, MessageCircle } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";

const SHOTS = [
  {
    icon: Smartphone,
    title: "Menú público con tu marca",
    body: "Colores, logo y catálogo listos para compartir en Status y listas de difusión.",
  },
  {
    icon: ImageIcon,
    title: "Panel del día en el celular",
    body: "Activa platillos, combos y precio del paquete en segundos, sin diseñador.",
  },
  {
    icon: MessageCircle,
    title: "Pedido estructurado a WhatsApp",
    body: "El cliente arma el carrito; tú recibes el mensaje claro con totales y datos.",
  },
] as const;

export function ProductShots() {
  return (
    <div className="space-y-4">
      <Reveal>
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-brand-dark">
          El producto, no solo la promesa
        </h2>
        <p className="mt-1 text-sm text-muted">
          Tres piezas que usan tus clientes y tu equipo todos los días.
        </p>
      </Reveal>
      <ul className="grid gap-4 sm:grid-cols-3">
        {SHOTS.map(({ icon: Icon, title, body }, i) => (
          <Reveal key={title} as="li" delayMs={i * 80}>
            <div className="landing-card flex h-full flex-col rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <div className="mb-3 flex h-28 items-center justify-center rounded-xl bg-gradient-to-br from-[#f0d4b8]/80 to-[#d4e8dc]/60">
                <Icon className="h-10 w-10 text-brand" aria-hidden />
              </div>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
            </div>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}
