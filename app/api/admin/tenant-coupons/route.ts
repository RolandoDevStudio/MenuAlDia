import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";
import {
  endOfCouponDay,
  normalizeCouponCode,
} from "@/lib/coupons";

export async function GET() {
  const session = await requireTenantSession();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_coupons")
    .select("*")
    .eq("restaurant_id", session.restaurant.id)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ coupons: data ?? [] });
}

export async function POST(request: Request) {
  const session = await requireTenantSession();
  const body = (await request.json()) as Record<string, unknown>;
  const code = normalizeCouponCode(String(body.code ?? ""));
  if (code.length < 3) {
    return NextResponse.json({ error: "código inválido" }, { status: 400 });
  }
  const discountType = body.discount_type === "fixed" ? "fixed" : "percent";
  const discountValue = Number(body.discount_value);
  if (!(discountValue > 0)) {
    return NextResponse.json({ error: "valor inválido" }, { status: 400 });
  }
  if (discountType === "percent" && discountValue > 100) {
    return NextResponse.json(
      { error: "el porcentaje no puede superar 100" },
      { status: 400 },
    );
  }

  let endsAt: string | null = null;
  try {
    if (body.ends_on) endsAt = endOfCouponDay(String(body.ends_on));
  } catch {
    return NextResponse.json({ error: "fecha inválida" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_coupons")
    .insert({
      restaurant_id: session.restaurant.id,
      code,
      discount_type: discountType,
      discount_value: discountValue,
      min_subtotal:
        body.min_subtotal === "" || body.min_subtotal == null
          ? null
          : Number(body.min_subtotal),
      ends_at: endsAt,
      max_uses:
        body.max_uses === "" || body.max_uses == null
          ? null
          : Number(body.max_uses),
      max_uses_per_customer:
        body.max_uses_per_customer === "" || body.max_uses_per_customer == null
          ? null
          : Number(body.max_uses_per_customer),
      is_active: body.is_active !== false,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ coupon: data });
}

export async function PATCH(request: Request) {
  const session = await requireTenantSession();
  const body = (await request.json()) as Record<string, unknown>;
  const id = String(body.id ?? "");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.code !== undefined) {
    updates.code = normalizeCouponCode(String(body.code));
  }
  if (body.discount_type === "fixed" || body.discount_type === "percent") {
    updates.discount_type = body.discount_type;
  }
  if (body.discount_value !== undefined) {
    updates.discount_value = Number(body.discount_value);
  }
  if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);
  if (body.min_subtotal !== undefined) {
    updates.min_subtotal =
      body.min_subtotal === "" || body.min_subtotal == null
        ? null
        : Number(body.min_subtotal);
  }
  if (body.max_uses !== undefined) {
    updates.max_uses =
      body.max_uses === "" || body.max_uses == null
        ? null
        : Number(body.max_uses);
  }
  if (body.max_uses_per_customer !== undefined) {
    updates.max_uses_per_customer =
      body.max_uses_per_customer === "" || body.max_uses_per_customer == null
        ? null
        : Number(body.max_uses_per_customer);
  }
  try {
    if (body.ends_on !== undefined) {
      updates.ends_at = body.ends_on
        ? endOfCouponDay(String(body.ends_on))
        : null;
    }
  } catch {
    return NextResponse.json({ error: "fecha inválida" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_coupons")
    .update(updates)
    .eq("id", id)
    .eq("restaurant_id", session.restaurant.id)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ coupon: data });
}

export async function DELETE(request: Request) {
  const session = await requireTenantSession();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenant_coupons")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", session.restaurant.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
