export function StoreClosedBanner({ acceptingOrders }: { acceptingOrders: boolean }) {
  if (acceptingOrders !== false) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">
      Cerrado por hoy — puedes ver el catálogo; los pedidos pueden no atenderse.
    </div>
  );
}
