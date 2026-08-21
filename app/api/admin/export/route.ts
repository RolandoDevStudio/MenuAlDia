import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionRestaurant } from "@/lib/restaurant";
import { can } from "@/lib/plans";
import { getLifecyclePhase } from "@/lib/subscription-lifecycle";
import {
  getAnalyticsBundle,
  resolveAnalyticsRange,
} from "@/lib/analytics-queries";

export async function GET(request: Request) {
  const session = await getSessionRestaurant();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const phase = getLifecyclePhase(session.restaurant);
  const inGraceExport =
    phase === "expired_grace" ||
    phase === "expired_pre_purge" ||
    phase === "purge_due";

  if (!can(session.restaurant.plan_type, "csv_export") && !inGraceExport) {
    return NextResponse.json({ error: "plan required: pro" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "orders";
  const rid = session.restaurant.id;
  const supabase = await createClient();
  const { from, to } = resolveAnalyticsRange(
    searchParams.get("preset"),
    searchParams.get("from"),
    searchParams.get("to"),
  );

  if (type === "customers") {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("restaurant_id", rid)
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
    return csvResponse(header + body, "customers.csv");
  }

  if (type === "traffic") {
    const bundle = await getAnalyticsBundle(rid, from, to);
    const header = "date,views,wa_clicks,orders,conversion_pct\n";
    const body = bundle.series
      .map((p) => {
        const conv =
          p.views > 0
            ? Math.round(((p.waClicks + p.orders) / p.views) * 1000) / 10
            : 0;
        return [p.date, p.views, p.waClicks, p.orders, conv].join(",");
      })
      .join("\n");
    return csvResponse(header + body, `traffic_${from}_${to}.csv`);
  }

  if (type === "coupons") {
    const startIso = `${from}T00:00:00.000Z`;
    const endIso = `${to}T23:59:59.999Z`;
    const { data } = await supabase
      .from("tenant_coupon_redemptions")
      .select(
        "created_at, customer_phone, discount_applied, tenant_coupons(code)",
      )
      .eq("restaurant_id", rid)
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: false });
    const header = "code,redeemed_at,phone,discount\n";
    const body = (data ?? [])
      .map((r) => {
        const nested = r.tenant_coupons as
          | { code?: string }
          | { code?: string }[]
          | null;
        const code = Array.isArray(nested)
          ? nested[0]?.code
          : nested?.code;
        return [
          csv(code),
          r.created_at,
          csv(r.customer_phone),
          r.discount_applied,
        ].join(",");
      })
      .join("\n");
    return csvResponse(header + body, `coupons_${from}_${to}.csv`);
  }

  if (type === "catalog") {
    const { data: engage } = await supabase
      .from("dish_engagement_days")
      .select("dish_id, opens, adds")
      .eq("restaurant_id", rid)
      .gte("view_date", from)
      .lte("view_date", to);
    const agg = new Map<string, { opens: number; adds: number }>();
    for (const r of engage ?? []) {
      const id = String(r.dish_id);
      const cur = agg.get(id) ?? { opens: 0, adds: 0 };
      cur.opens += Number(r.opens ?? 0);
      cur.adds += Number(r.adds ?? 0);
      agg.set(id, cur);
    }
    const ids = [...agg.keys()];
    const { data: dishes } = ids.length
      ? await supabase
          .from("dishes")
          .select("id, name, categories(name)")
          .eq("restaurant_id", rid)
          .in("id", ids)
      : {
          data: [] as {
            id: string;
            name: string;
            categories: { name?: string } | { name?: string }[] | null;
          }[],
        };

    const header = "product,category,opens,adds\n";
    const body = (dishes ?? [])
      .map((d) => {
        const stats = agg.get(d.id) ?? { opens: 0, adds: 0 };
        const catNested = d.categories as
          | { name?: string }
          | { name?: string }[]
          | null;
        const cat = Array.isArray(catNested)
          ? catNested[0]?.name
          : catNested?.name;
        return [
          csv(d.name),
          csv(cat ?? ""),
          stats.opens,
          stats.adds,
        ].join(",");
      })
      .join("\n");
    return csvResponse(header + body, `catalog_${from}_${to}.csv`);
  }

  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("restaurant_id", rid)
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

  return csvResponse(header + body, "orders.csv");
}

function csvResponse(content: string, filename: string) {
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function csv(v: unknown) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
