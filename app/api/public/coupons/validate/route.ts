import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  clampDiscount,
  missingMinSubtotalMessage,
  normalizeCouponCode,
  type CouponDiscountType,
} from "@/lib/coupons";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    restaurant_id?: string;
    code?: string;
    subtotal?: number;
    phone?: string;
  };
  const restaurantId = body.restaurant_id?.trim();
  const code = normalizeCouponCode(body.code ?? "");
  const subtotal = Number(body.subtotal ?? 0);
  if (!restaurantId || code.length < 3) {
    return NextResponse.json({ error: "datos inválidos" }, { status: 400 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "servicio no disponible" }, { status: 500 });
  }

  const { data: coupon } = await admin
    .from("tenant_coupons")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("code", code)
    .maybeSingle();

  if (!coupon || !coupon.is_active) {
    return NextResponse.json(
      { error: "invalid", message: "Cupón no válido" },
      { status: 404 },
    );
  }
  if (coupon.ends_at && new Date(coupon.ends_at).getTime() < Date.now()) {
    return NextResponse.json(
      { error: "expired", message: "Cupón expirado" },
      { status: 400 },
    );
  }
  if (
    coupon.max_uses != null &&
    Number(coupon.use_count) >= Number(coupon.max_uses)
  ) {
    return NextResponse.json(
      { error: "exhausted", message: "Cupón agotado" },
      { status: 400 },
    );
  }

  const minSub = coupon.min_subtotal != null ? Number(coupon.min_subtotal) : 0;
  if (minSub > 0 && subtotal < minSub) {
    const missing = minSub - subtotal;
    return NextResponse.json(
      {
        error: "min_subtotal",
        message: missingMinSubtotalMessage(missing),
        missing,
        min_subtotal: minSub,
      },
      { status: 422 },
    );
  }

  const phone = normalizeWhatsAppPhone(body.phone ?? "");
  if (coupon.max_uses_per_customer != null && phone.length >= 10) {
    const { count } = await admin
      .from("tenant_coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", coupon.id)
      .eq("customer_phone", phone);
    if ((count ?? 0) >= Number(coupon.max_uses_per_customer)) {
      return NextResponse.json(
        {
          error: "per_customer",
          message: "Ya usaste este cupón el máximo de veces",
        },
        { status: 400 },
      );
    }
  }

  const discount = clampDiscount({
    type: coupon.discount_type as CouponDiscountType,
    value: Number(coupon.discount_value),
    base: subtotal,
  });

  return NextResponse.json({
    ok: true,
    code,
    discount,
    newSubtotal: Math.max(0, subtotal - discount),
    requires_phone: Boolean(coupon.max_uses_per_customer),
  });
}
