import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { can } from "@/lib/plans";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp";

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
  const phoneRaw = body.phone?.trim() ?? "";
  const phoneDigits = normalizeWhatsAppPhone(phoneRaw);

  if (!restaurantId) {
    return NextResponse.json({ error: "restaurant_id required" }, { status: 400 });
  }
  if (name.length < 2) {
    return NextResponse.json({ error: "nombre inválido" }, { status: 400 });
  }
  if (phoneDigits.length < 10) {
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

    const { data: existing } = await admin
      .from("customers")
      .select("id, name")
      .eq("restaurant_id", restaurantId)
      .eq("phone", phoneDigits)
      .maybeSingle();

    if (existing) {
      if (!existing.name || existing.name === "Cliente") {
        await admin
          .from("customers")
          .update({ name })
          .eq("id", existing.id);
      }
      return NextResponse.json({ ok: true, customer_id: existing.id });
    }

    const { data: created, error: cErr } = await admin
      .from("customers")
      .insert({
        restaurant_id: restaurantId,
        name,
        phone: phoneDigits,
      })
      .select("id")
      .single();

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, customer_id: created.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
