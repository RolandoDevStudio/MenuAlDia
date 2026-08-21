import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      restaurant_id?: string;
      flyer_id?: string;
    };
    const restaurantId = body.restaurant_id?.trim();
    const flyerId = body.flyer_id?.trim();
    if (!restaurantId || !flyerId) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    const supabase = createPublicClient();
    const { error } = await supabase.rpc("increment_flyer_landing", {
      p_restaurant_id: restaurantId,
      p_flyer_id: flyerId,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error" },
      { status: 500 },
    );
  }
}
