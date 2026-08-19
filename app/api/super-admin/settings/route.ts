import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";

export async function GET() {
  const ok = await isCurrentUserSuperAdmin();
  if (!ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("platform_settings").select("*");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const map: Record<string, unknown> = {};
  for (const row of data ?? []) {
    map[row.key] = row.value;
  }
  return NextResponse.json(map);
}

export async function PATCH(request: Request) {
  const ok = await isCurrentUserSuperAdmin();
  if (!ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await request.json()) as {
    key?: string;
    value?: unknown;
  };
  if (!body.key || body.value === undefined) {
    return NextResponse.json({ error: "key and value required" }, { status: 400 });
  }
  if (!["landing_content", "plan_prices"].includes(body.key)) {
    return NextResponse.json({ error: "invalid key" }, { status: 400 });
  }
  try {
    const admin = createServiceClient();
    const { error } = await admin.from("platform_settings").upsert({
      key: body.key,
      value: body.value,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "admin client missing" },
      { status: 500 },
    );
  }
}
