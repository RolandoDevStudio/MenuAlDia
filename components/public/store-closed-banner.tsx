export function StoreClosedBanner({
  acceptingOrders,
  message,
}: {
  acceptingOrders: boolean;
  message?: string | null;
}) {
  if (acceptingOrders !== false) return null;
  const text =
    String(message ?? "").trim() ||
    "Cerrado por hoy — puedes ver el catálogo; los pedidos pueden no atenderse.";
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">
      {text}
    </div>
  );
}
