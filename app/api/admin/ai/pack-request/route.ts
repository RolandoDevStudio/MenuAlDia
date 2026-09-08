import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantSession } from "@/lib/admin-session";
import { createClient } from "@/lib/supabase/server";
import { getAiImagePackMeta } from "@/lib/ai-quota";

const bodySchema = z.object({
  notes: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const session = await requireTenantSession();
  const { size, priceMxn } = await getAiImagePackMeta();

  let notes = "";
  try {
    const json = bodySchema.parse(await request.json());
    notes = json.notes?.trim() ?? "";
  } catch {
    // empty body ok
  }

  const supabase = await createClient();
  const { data: pending } = await supabase
    .from("ai_image_pack_requests")
    .select("id")
    .eq("restaurant_id", session.restaurant.id)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (pending) {
    return NextResponse.json(
      {
        error: "already_pending",
        message: "Ya tienes una solicitud de pack pendiente.",
      },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("ai_image_pack_requests")
    .insert({
      restaurant_id: session.restaurant.id,
      pack_size: size,
      amount_mxn: priceMxn,
      notes,
      created_by: session.userId,
      status: "pending",
    })
    .select("id, pack_size, amount_mxn, status, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "insert_failed", message: error?.message ?? "Error" },
      { status: 500 },
    );
  }

  return NextResponse.json({ request: data });
}
