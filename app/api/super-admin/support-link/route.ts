import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";
import {
  SUPPORT_LINK_TTL_MS,
} from "@/lib/support-session";

export async function POST(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { restaurant_id?: string };
  const restaurantId = body.restaurant_id?.trim();
  if (!restaurantId) {
    return NextResponse.json({ error: "missing restaurant_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: restaurant, error: restErr } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("id", restaurantId)
    .maybeSingle();
  if (restErr || !restaurant) {
    return NextResponse.json(
      { error: restErr?.message ?? "restaurant not found" },
      { status: restErr ? 500 : 404 },
    );
  }

  const raw = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + SUPPORT_LINK_TTL_MS).toISOString();

  const { error } = await supabase.from("support_access_tokens").insert({
    restaurant_id: restaurantId,
    actor_user_id: user?.id ?? null,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  return NextResponse.json({
    url: `${origin}/admin/soporte?token=${raw}`,
    restaurant_name: restaurant.name,
  });
}
