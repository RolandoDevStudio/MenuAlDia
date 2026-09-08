import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicOrderTicketClient } from "@/components/public/public-order-ticket-client";
import {
  fetchPublicOrderByToken,
  PUBLIC_ORDER_TOKEN_RE,
} from "@/lib/public-order";
import { publicOrderTicketUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const order = await fetchPublicOrderByToken(token);
  if (!order) return { title: "Comprobante no encontrado" };
  const title =
    order.folio != null
      ? `Pedido #${order.folio} — ${order.restaurantName}`
      : `Pedido — ${order.restaurantName}`;
  return {
    title,
    description: `Comprobante de ${order.restaurantName}`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicOrderTicketPage({ params }: Props) {
  const { token } = await params;
  if (!PUBLIC_ORDER_TOKEN_RE.test(token)) notFound();

  const order = await fetchPublicOrderByToken(token);
  if (!order) notFound();

  const ticketUrl = publicOrderTicketUrl(token);

  return (
    <main className="min-h-full bg-background px-4 py-8">
      <PublicOrderTicketClient
        token={token}
        initial={order}
        ticketUrl={ticketUrl}
      />
    </main>
  );
}
