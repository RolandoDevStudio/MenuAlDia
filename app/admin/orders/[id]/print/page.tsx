import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";
import { can } from "@/lib/plans";
import { parseFulfillment } from "@/lib/fulfillment";
import { publicTransferDetails } from "@/lib/transfer-details";
import { OrderTicket } from "@/components/public/order-ticket";
import type { Order, OrderLogPayload } from "@/lib/types";

export default async function OrderPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireTenantSession();
  const plan = session.restaurant.plan_type || "catalog";
  if (!can(plan, "crm")) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .eq("restaurant_id", session.restaurant.id)
    .maybeSingle();

  if (!data) notFound();

  const order = data as Order;
  const payload = order.payload ?? ({} as OrderLogPayload);

  return (
    <div className="mx-auto max-w-md space-y-4 py-4">
      <p className="text-center text-sm text-muted print:hidden">
        Preparando la comanda para imprimir…
      </p>
      <OrderTicket
        variant="print"
        autoPrint
        data={{
          folio: order.folio ?? null,
          createdAt: order.created_at,
          businessName: session.restaurant.name,
          fulfillment: parseFulfillment(payload.fulfillment) ?? "pickup",
          tableLabel: payload.table_label ?? null,
          address: payload.address ?? null,
          references: payload.references ?? null,
          customerName: payload.customer_name || payload.customerName || "Cliente",
          phone: payload.phone ?? null,
          items: payload.items ?? [],
          subtotal: Number(payload.subtotal ?? 0),
          shipping: Number(payload.shipping ?? 0),
          discount: Number(payload.discount ?? 0),
          couponCode: payload.coupon_code ?? null,
          total: Number(order.total ?? 0),
          paymentMethod:
            (payload.payment_method ?? payload.paymentMethod) === "transfer"
              ? "transfer"
              : "cash",
          cashAmount: payload.cash_amount ?? null,
          status: order.status,
          transfer: publicTransferDetails(session.restaurant),
        }}
      />
    </div>
  );
}
