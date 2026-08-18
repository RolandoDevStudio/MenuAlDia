import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionRestaurant } from "@/lib/restaurant";
import { can } from "@/lib/plans";

export async function GET(request: Request) {
  const session = await getSessionRestaurant();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.restaurant.plan_type, "csv_export")) {
    return NextResponse.json({ error: "plan required: pro" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") === "customers" ? "customers" : "orders";
  const supabase = await createClient();

  if (type === "customers") {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("restaurant_id", session.restaurant.id)
      .order("created_at", { ascending: false });
    const rows = data ?? [];
    const header = "id,name,phone,address,orders_count,last_order_at\n";
    const body = rows
      .map((r) =>
        [
          r.id,
          csv(r.name),
          csv(r.phone),
          csv(r.address),
          r.orders_count,
          r.last_order_at ?? "",
        ].join(","),
      )
      .join("\n");
    return new NextResponse(header + body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="customers.csv"',
      },
    });
  }

  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("restaurant_id", session.restaurant.id)
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  const header = "id,customer,total,status,created_at,items\n";
  const body = rows
    .map((r) => {
      const items = (r.payload?.items ?? [])
        .map((i: { quantity: number; name: string }) => `${i.quantity}x ${i.name}`)
        .join("; ");
      return [
        r.id,
        csv(r.payload?.customer_name),
        r.total,
        r.status,
        r.created_at,
        csv(items),
      ].join(",");
    })
    .join("\n");

  return new NextResponse(header + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="orders.csv"',
    },
  });
}

function csv(v: unknown) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
