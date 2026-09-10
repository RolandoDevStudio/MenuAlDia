import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createPublicClient } from "@/lib/supabase/public";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";
import { isLandingEventKey } from "@/lib/landing-events";

function isBotUa(ua: string): boolean {
  return /bot|crawl|spider|slurp|preview|facebookexternalhit/i.test(ua);
}

/** Supabase SSR session cookies look like sb-<ref>-auth-token. */
async function hasLikelyAuthSession(): Promise<boolean> {
  const store = await cookies();
  return store.getAll().some((c) => /auth-token/i.test(c.name));
}

export async function POST(request: Request) {
  try {
    const ua = request.headers.get("user-agent") ?? "";
    if (isBotUa(ua)) {
      return NextResponse.json({ ok: true, skipped: "bot" });
    }

    if ((await hasLikelyAuthSession()) && (await isCurrentUserSuperAdmin())) {
      return NextResponse.json({ ok: true, skipped: "superadmin" });
    }

    const body = (await request.json()) as {
      type?: string;
      key?: string;
    };
    const type = body.type?.trim();
    const supabase = createPublicClient();

    if (type === "view") {
      const { error } = await supabase.rpc("increment_landing_view");
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (type === "event") {
      const key = body.key?.trim() ?? "";
      if (!isLandingEventKey(key)) {
        return NextResponse.json({ ok: true, skipped: "key" });
      }
      const { error } = await supabase.rpc("increment_landing_event", {
        p_key: key,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "type required" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error" },
      { status: 500 },
    );
  }
}
