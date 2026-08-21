import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { requireTenantSession } from "@/lib/admin-session";
import { getPlanPrices } from "@/lib/plans";
import {
  clampDiscount,
  DEFAULT_SPEI_INFO,
  normalizeCouponCode,
  type CouponDiscountType,
  type SpeiInfo,
} from "@/lib/coupons";

async function loadSpei(): Promise<SpeiInfo> {
  try {
    const admin = createServiceClient();
    const { data: row } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "spei_info")
      .maybeSingle();
    if (row?.value && typeof row.value === "object") {
      return { ...DEFAULT_SPEI_INFO, ...(row.value as SpeiInfo) };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SPEI_INFO };
}

export async function GET() {
  const session = await requireTenantSession();
  const plan = (session.restaurant.plan_type || "catalog") as
    | "catalog"
    | "daily"
    | "pro";
  const prices = await getPlanPrices();
  return NextResponse.json({
    plan,
    listAmount: prices[plan]?.monthly ?? 0,
    spei: await loadSpei(),
  });
}

/** Preview only — does not redeem. */
export async function POST(request: Request) {
  const session = await requireTenantSession();
  const body = (await request.json()) as { code?: string };
  const code = normalizeCouponCode(body.code ?? "");
  if (code.length < 3) {
    return NextResponse.json({ error: "código inválido" }, { status: 400 });
  }

  const plan = (session.restaurant.plan_type || "catalog") as
    | "catalog"
    | "daily"
    | "pro";
  const prices = await getPlanPrices();
  const listAmount = prices[plan]?.monthly ?? 0;

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "servicio no disponible" }, { status: 500 });
  }

  const { data: coupon } = await admin
    .from("platform_coupons")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (!coupon || coupon.is_active === false) {
    return NextResponse.json({ error: "Cupón no válido" }, { status: 404 });
  }
  const now = Date.now();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    return NextResponse.json({ error: "Cupón aún no vigente" }, { status: 400 });
  }
  if (coupon.ends_at && new Date(coupon.ends_at).getTime() < now) {
    return NextResponse.json({ error: "Cupón expirado" }, { status: 400 });
  }
  if (coupon.plan_scope !== "all" && coupon.plan_scope !== plan) {
    return NextResponse.json(
      { error: "Este cupón no aplica a tu plan actual" },
      { status: 400 },
    );
  }
  if (
    coupon.max_redemptions != null &&
    Number(coupon.redemption_count) >= Number(coupon.max_redemptions)
  ) {
    return NextResponse.json({ error: "Cupón agotado" }, { status: 400 });
  }

  const discount = clampDiscount({
    type: coupon.discount_type as CouponDiscountType,
    value: Number(coupon.discount_value),
    base: listAmount,
  });

  return NextResponse.json({
    ok: true,
    code,
    discount,
    listAmount,
    payAmount: Math.max(0, listAmount - discount),
    plan,
    label: coupon.label || code,
    spei: await loadSpei(),
  });
}
