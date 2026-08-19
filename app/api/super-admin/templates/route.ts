import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";
import { writeAuditLog } from "@/lib/audit";
import { buildRestaurantSnapshot } from "@/lib/plan-templates";

export async function GET() {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_templates")
    .select("*")
    .order("business_type")
    .order("plan_type");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates: data ?? [] });
}

export async function PATCH(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    name?: string;
    theme_config?: Record<string, unknown>;
    snapshot?: Record<string, unknown>;
    is_active?: boolean;
    sync_from_slug?: string;
  };

  if (!body.id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const { data: before, error: loadErr } = await supabase
    .from("plan_templates")
    .select("*")
    .eq("id", body.id)
    .maybeSingle();

  if (loadErr || !before) {
    return NextResponse.json(
      { error: loadErr?.message ?? "template not found" },
      { status: loadErr ? 500 : 404 },
    );
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.name === "string") updates.name = body.name.trim();
  if (body.theme_config !== undefined) updates.theme_config = body.theme_config;
  if (body.snapshot !== undefined) updates.snapshot = body.snapshot;
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;

  let syncFrom: { id: string; slug: string } | null = null;
  if (typeof body.sync_from_slug === "string" && body.sync_from_slug.trim()) {
    const syncSlug = body.sync_from_slug.trim();
    const { data: source, error: srcErr } = await supabase
      .from("restaurants")
      .select("id, slug")
      .eq("slug", syncSlug)
      .maybeSingle();

    if (srcErr || !source) {
      return NextResponse.json(
        { error: srcErr?.message ?? "restaurant slug not found" },
        { status: srcErr ? 500 : 404 },
      );
    }

    syncFrom = source;
    updates.snapshot = await buildRestaurantSnapshot(supabase, source.id);
  }

  const { data: updated, error: updErr } = await supabase
    .from("plan_templates")
    .update(updates)
    .eq("id", body.id)
    .select("*")
    .single();

  if (updErr || !updated) {
    return NextResponse.json(
      { error: updErr?.message ?? "update failed" },
      { status: 500 },
    );
  }

  if (syncFrom) {
    await writeAuditLog({
      restaurantId: syncFrom.id,
      actorUserId: actor?.id,
      actorLabel: actor?.email ?? "super_admin",
      action: "sync_template",
      fieldName: "snapshot",
      oldValue: syncFrom.slug,
      newValue: updated.slug_key,
      summary: `Sincronizó plantilla ${updated.slug_key} desde /${syncFrom.slug}`,
    });
  }

  return NextResponse.json({ ok: true, template: updated });
}
