import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { can } from "@/lib/plans";
import { normalizeMxPhone } from "@/lib/phone";

/**
 * Public lead from Cita Express: upsert customer when tenant is Pro.
 * No auth — validated by restaurant_id + Pro plan.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    restaurant_id?: string;
    name?: string;
    phone?: string;
  };

  const restaurantId = body.restaurant_id?.trim();
  const name = body.name?.trim() ?? "";
  const phoneDigits = normalizeMxPhone(body.phone?.trim() ?? "");

  if (!restaurantId) {
    return NextResponse.json({ error: "restaurant_id required" }, { status: 400 });
  }
  if (name.length < 2) {
    return NextResponse.json({ error: "nombre inválido" }, { status: 400 });
  }
  if (!phoneDigits) {
    return NextResponse.json({ error: "teléfono inválido" }, { status: 400 });
  }

  try {
    const admin = createServiceClient();
    const { data: restaurant, error: rErr } = await admin
      .from("restaurants")
      .select("id, plan_type")
      .eq("id", restaurantId)
      .maybeSingle();

    if (rErr || !restaurant) {
      return NextResponse.json({ error: "negocio no encontrado" }, { status: 404 });
    }
    if (!can(restaurant.plan_type, "crm")) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const { data: customerId, error: upErr } = await admin.rpc(
      "upsert_customer_by_phone",
      {
        p_restaurant_id: restaurantId,
        p_name: name,
        p_phone: phoneDigits,
        p_bump_order: false,
      },
    );
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    try {
      const { emitTenantNotification } = await import(
        "@/lib/notifications/emit"
      );
      await emitTenantNotification({
        restaurantId,
        type: "appointment_lead",
        title: "Nueva solicitud de cita",
        body: `${name} · ${phoneDigits}`,
        href: "/admin/customers",
        payload: { customer_id: customerId, name, phone: phoneDigits },
      });
    } catch {
      /* non-fatal */
    }
    return NextResponse.json({ ok: true, customer_id: customerId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
