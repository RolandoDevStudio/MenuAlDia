import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { requireTenantSession } from "@/lib/admin-session";
import { can } from "@/lib/plans";
import type { OrderLogPayload } from "@/lib/types";

/** Signed URL for private SPEI proof (tenant members only). */
export async function GET(request: Request) {
  const session = await requireTenantSession();
  if (!can(session.restaurant.plan_type, "crm")) {
    return NextResponse.json({ error: "plan required: pro" }, { status: 403 });
  }

  const orderId = new URL(request.url).searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, payload")
    .eq("id", orderId)
    .eq("restaurant_id", session.restaurant.id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const payload = (order.payload ?? {}) as OrderLogPayload;
  const path = payload.payment_proof_path;
  if (!path) {
    return NextResponse.json({ error: "no proof" }, { status: 404 });
  }

  const admin = createServiceClient();
  const { data, error } = await admin.storage
    .from("wa-payment-proofs")
    .createSignedUrl(path, 60 * 15);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message || "signed url failed" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(data.signedUrl);
}
