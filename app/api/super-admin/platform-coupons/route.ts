import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";
import {
  endOfCouponDay,
  normalizeCouponCode,
  startOfCouponDay,
} from "@/lib/coupons";

export async function GET() {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_coupons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ coupons: data ?? [] });
}

export async function POST(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
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
  const planScope = ["all", "catalog", "daily", "pro"].includes(
    String(body.plan_scope),
  )
    ? String(body.plan_scope)
    : "all";

  let startsAt: string | null = null;
  let endsAt: string | null = null;
  try {
    if (body.starts_on) startsAt = startOfCouponDay(String(body.starts_on));
    if (body.ends_on) endsAt = endOfCouponDay(String(body.ends_on));
  } catch {
    return NextResponse.json({ error: "fechas inválidas" }, { status: 400 });
  }

  const maxRedemptions =
    body.max_redemptions === null || body.max_redemptions === ""
      ? null
      : Number(body.max_redemptions);
  if (maxRedemptions != null && !(maxRedemptions > 0)) {
    return NextResponse.json({ error: "límite de usos inválido" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_coupons")
    .insert({
      code,
      discount_type: discountType,
      discount_value: discountValue,
      plan_scope: planScope,
      starts_at: startsAt,
      ends_at: endsAt,
      max_redemptions: maxRedemptions,
      is_active: body.is_active !== false,
      label: String(body.label ?? "").trim().slice(0, 120),
      notes: String(body.notes ?? "").trim().slice(0, 500),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ coupon: data });
}

export async function PATCH(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
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
  if (body.plan_scope !== undefined) updates.plan_scope = body.plan_scope;
  if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);
  if (body.label !== undefined) updates.label = String(body.label).trim();
  if (body.notes !== undefined) updates.notes = String(body.notes).trim();
  if (body.max_redemptions !== undefined) {
    updates.max_redemptions =
      body.max_redemptions === null || body.max_redemptions === ""
        ? null
        : Number(body.max_redemptions);
  }
  try {
    if (body.starts_on !== undefined) {
      updates.starts_at = body.starts_on
        ? startOfCouponDay(String(body.starts_on))
        : null;
    }
    if (body.ends_on !== undefined) {
      updates.ends_at = body.ends_on
        ? endOfCouponDay(String(body.ends_on))
        : null;
    }
  } catch {
    return NextResponse.json({ error: "fechas inválidas" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_coupons")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ coupon: data });
}

export async function DELETE(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const supabase = await createClient();
  const { error } = await supabase.from("platform_coupons").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
