import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      restaurant_id?: string;
      dish_id?: string;
      kind?: string;
    };
    const restaurantId = body.restaurant_id?.trim();
    const dishId = body.dish_id?.trim();
    const kind = body.kind === "add" ? "add" : "open";
    if (!restaurantId || !dishId) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    const supabase = createPublicClient();
    const { error } = await supabase.rpc("increment_dish_engage", {
      p_restaurant_id: restaurantId,
      p_dish_id: dishId,
      p_kind: kind,
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
