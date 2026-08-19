import { ImageIcon, Smartphone, MessageCircle } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";

const SHOTS = [
  {
    icon: Smartphone,
    title: "Menú público con tu marca",
    body: "Colores, logo y catálogo listos para compartir.",
  },
  {
    icon: ImageIcon,
    title: "Panel del día en el celular",
    body: "Activa platillos y combos en segundos.",
  },
  {
    icon: MessageCircle,
    title: "Pedido a WhatsApp",
    body: "El cliente arma el carrito; tú recibes el mensaje claro.",
  },
] as const;

export function ProductShots() {
  return (
    <div className="space-y-3">
      <Reveal>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">
          El producto
        </p>
        <p className="mt-1 text-sm text-muted">
          Tres piezas que usan tus clientes y tu equipo todos los días.
        </p>
      </Reveal>
      <ul className="grid gap-3 sm:grid-cols-3">
        {SHOTS.map(({ icon: Icon, title, body }, i) => (
          <Reveal key={title} as="li" delayMs={i * 70}>
            <div className="landing-card flex h-full gap-3 rounded-xl border border-black/5 bg-white/90 px-3 py-3 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                <Icon className="h-5 w-5 text-brand" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  {body}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}
