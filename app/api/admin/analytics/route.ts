import { NextResponse } from "next/server";
import { getSessionRestaurant } from "@/lib/restaurant";
import { can } from "@/lib/plans";
import {
  getAnalyticsBundle,
  resolveAnalyticsRange,
} from "@/lib/analytics-queries";

export async function GET(request: Request) {
  const session = await getSessionRestaurant();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.restaurant.plan_type, "analytics")) {
    return NextResponse.json({ error: "plan required: pro" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const { from, to } = resolveAnalyticsRange(
    searchParams.get("preset"),
    searchParams.get("from"),
    searchParams.get("to"),
  );

  try {
    const bundle = await getAnalyticsBundle(
      session.restaurant.id,
      from,
      to,
    );
    return NextResponse.json(bundle);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error" },
      { status: 500 },
    );
  }
}
