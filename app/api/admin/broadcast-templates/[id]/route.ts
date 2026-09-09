import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantSession } from "@/lib/admin-session";
import { createClient } from "@/lib/supabase/server";
import { ANNOUNCEMENT_TYPES } from "@/lib/broadcast-ai-prompt";

const patchSchema = z.object({
  title: z.string().max(80).optional(),
  body: z.string().min(8).max(4000).optional(),
  announcementType: z.enum(ANNOUNCEMENT_TYPES).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await requireTenantSession();
  const { id } = await ctx.params;
  const supabase = await createClient();

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Datos inválidos." },
      { status: 400 },
    );
  }

  const patch: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };
  if (body.title !== undefined) patch.title = body.title.trim();
  if (body.body !== undefined) patch.body = body.body.trim();
  if (body.announcementType !== undefined) {
    patch.announcement_type = body.announcementType;
  }

  const { data, error } = await supabase
    .from("broadcast_templates")
    .update(patch)
    .eq("id", id)
    .eq("restaurant_id", session.restaurant.id)
    .select("id, title, body, announcement_type, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "db_error", message: error.message },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "not_found", message: "Plantilla no encontrada." },
      { status: 404 },
    );
  }

  return NextResponse.json({ template: data });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await requireTenantSession();
  const { id } = await ctx.params;
  const supabase = await createClient();

  const { error, count } = await supabase
    .from("broadcast_templates")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("restaurant_id", session.restaurant.id);

  if (error) {
    return NextResponse.json(
      { error: "db_error", message: error.message },
      { status: 500 },
    );
  }
  if (!count) {
    return NextResponse.json(
      { error: "not_found", message: "Plantilla no encontrada." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
