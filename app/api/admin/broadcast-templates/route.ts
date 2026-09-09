import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantSession } from "@/lib/admin-session";
import { createClient } from "@/lib/supabase/server";
import {
  ANNOUNCEMENT_TYPES,
  MAX_BROADCAST_TEMPLATES,
} from "@/lib/broadcast-ai-prompt";

const createSchema = z.object({
  title: z.string().max(80).default(""),
  body: z.string().min(8).max(4000),
  announcementType: z.enum(ANNOUNCEMENT_TYPES).default("menu_dia"),
});

export async function GET() {
  const session = await requireTenantSession();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("broadcast_templates")
    .select("id, title, body, announcement_type, created_at, updated_at")
    .eq("restaurant_id", session.restaurant.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "db_error", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    templates: data ?? [],
    limit: MAX_BROADCAST_TEMPLATES,
  });
}

export async function POST(request: Request) {
  const session = await requireTenantSession();
  const supabase = await createClient();

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Datos inválidos." },
      { status: 400 },
    );
  }

  const { count, error: countError } = await supabase
    .from("broadcast_templates")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", session.restaurant.id);

  if (countError) {
    return NextResponse.json(
      { error: "db_error", message: countError.message },
      { status: 500 },
    );
  }

  if ((count ?? 0) >= MAX_BROADCAST_TEMPLATES) {
    return NextResponse.json(
      {
        error: "limit",
        message: `Límite de ${MAX_BROADCAST_TEMPLATES} plantillas. Elimina una para guardar otra.`,
        limit: MAX_BROADCAST_TEMPLATES,
      },
      { status: 403 },
    );
  }

  const title =
    body.title.trim() ||
    `${body.announcementType} · ${new Date().toLocaleDateString("es-MX")}`;

  const { data, error } = await supabase
    .from("broadcast_templates")
    .insert({
      restaurant_id: session.restaurant.id,
      title,
      body: body.body.trim(),
      announcement_type: body.announcementType,
      updated_at: new Date().toISOString(),
    })
    .select("id, title, body, announcement_type, created_at, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "db_error", message: error?.message ?? "No se guardó." },
      { status: 500 },
    );
  }

  return NextResponse.json({ template: data, limit: MAX_BROADCAST_TEMPLATES });
}
