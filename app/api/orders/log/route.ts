import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { can } from "@/lib/plans";
import type { OrderLogPayload, Restaurant } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      restaurant_id?: string;
      payload?: OrderLogPayload;
    };
    if (!body.restaurant_id || !body.payload) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    const supabase = createPublicClient();
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("id, plan_type")
      .eq("id", body.restaurant_id)
      .maybeSingle();

    if (!restaurant) {
      return NextResponse.json({ error: "restaurant not found" }, { status: 404 });
    }

    const plan = (restaurant as Restaurant).plan_type || "catalog";
    const payload = body.payload;

    // Always best-effort log
    await supabase.from("order_logs").insert({
      restaurant_id: body.restaurant_id,
      payload,
    });

    if (can(plan, "crm")) {
      const name = payload.customer_name?.trim() || "Cliente";
      const phone = payload.phone?.trim() || null;
      const address = payload.address || "";

      let customerId: string | null = null;

      if (phone) {
        const { data: existing } = await supabase
          .from("customers")
          .select("id, orders_count")
          .eq("restaurant_id", body.restaurant_id)
          .eq("phone", phone)
          .limit(1)
          .maybeSingle();
        if (existing) {
          customerId = existing.id;
          await supabase
            .from("customers")
            .update({
              name,
              address,
              orders_count: (existing.orders_count ?? 0) + 1,
              last_order_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        }
      }

      if (!customerId) {
        const { data: created } = await supabase
          .from("customers")
          .insert({
            restaurant_id: body.restaurant_id,
            name,
            phone,
            address,
            orders_count: 1,
            last_order_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        customerId = created?.id ?? null;
      }

      await supabase.from("orders").insert({
        restaurant_id: body.restaurant_id,
        customer_id: customerId,
        payload,
        total: payload.total ?? 0,
        status: "submitted",
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
}
