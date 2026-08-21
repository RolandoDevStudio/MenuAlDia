import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireTenantSession } from "@/lib/admin-session";
import { MAX_ACTIVE_FAQS } from "@/lib/faq-templates";

export async function GET() {
  const session = await requireTenantSession();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_faqs")
    .select("*")
    .eq("restaurant_id", session.restaurant.id)
    .order("sort_order", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ faqs: data ?? [] });
}

export async function POST(request: Request) {
  const session = await requireTenantSession();
  const body = (await request.json()) as {
    question?: string;
    answer?: string;
    is_active?: boolean;
  };
  const question = (body.question ?? "").trim();
  const answer = (body.answer ?? "").trim();
  if (question.length < 3 || answer.length < 1) {
    return NextResponse.json({ error: "pregunta/respuesta inválida" }, { status: 400 });
  }

  const supabase = await createClient();
  const wantActive = body.is_active !== false;
  if (wantActive) {
    const { count } = await supabase
      .from("restaurant_faqs")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", session.restaurant.id)
      .eq("is_active", true);
    if ((count ?? 0) >= MAX_ACTIVE_FAQS) {
      return NextResponse.json(
        {
          error: `Máximo ${MAX_ACTIVE_FAQS} preguntas activas. Desactiva alguna primero.`,
        },
        { status: 400 },
      );
    }
  }

  const { data: last } = await supabase
    .from("restaurant_faqs")
    .select("sort_order")
    .eq("restaurant_id", session.restaurant.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("restaurant_faqs")
    .insert({
      restaurant_id: session.restaurant.id,
      question,
      answer,
      is_active: wantActive,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ faq: data });
}

export async function PATCH(request: Request) {
  const session = await requireTenantSession();
  const body = (await request.json()) as Record<string, unknown>;
  const id = String(body.id ?? "");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const supabase = await createClient();
  if (body.is_active === true) {
    const { count } = await supabase
      .from("restaurant_faqs")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", session.restaurant.id)
      .eq("is_active", true)
      .neq("id", id);
    if ((count ?? 0) >= MAX_ACTIVE_FAQS) {
      return NextResponse.json(
        { error: `Máximo ${MAX_ACTIVE_FAQS} preguntas activas` },
        { status: 400 },
      );
    }
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.question !== undefined) updates.question = String(body.question).trim();
  if (body.answer !== undefined) updates.answer = String(body.answer).trim();
  if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);
  if (body.sort_order !== undefined) updates.sort_order = Number(body.sort_order);

  const { data, error } = await supabase
    .from("restaurant_faqs")
    .update(updates)
    .eq("id", id)
    .eq("restaurant_id", session.restaurant.id)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ faq: data });
}

export async function DELETE(request: Request) {
  const session = await requireTenantSession();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("restaurant_faqs")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", session.restaurant.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
