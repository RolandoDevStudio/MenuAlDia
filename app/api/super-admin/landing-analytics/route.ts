import { NextResponse } from "next/server";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";
import { getLandingAnalyticsBundle } from "@/lib/landing-analytics";

export async function GET(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const preset = url.searchParams.get("preset") || "7d";
  try {
    const data = await getLandingAnalyticsBundle(preset);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "analytics failed" },
      { status: 500 },
    );
  }
}
