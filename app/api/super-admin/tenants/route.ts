import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";
import { writeAuditLog, logFieldChanges } from "@/lib/audit";
import { normalizeSlug } from "@/lib/plan-templates";

/** List tenants with owner login email (service role for auth lookup). */
export async function GET() {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: restaurants, error } = await supabase
    .from("restaurants")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({
      restaurants: restaurants ?? [],
      owners: {},
      warning: "Sin SERVICE_ROLE_KEY: no se pueden leer emails de login",
    });
  }

  const { data: members } = await admin
    .from("restaurant_members")
    .select("user_id, restaurant_id, role")
    .in("role", ["owner", "super_admin"]);

  const owners: Record<
    string,
    { user_id: string; email: string | null; role: string }
  > = {};

  for (const m of members ?? []) {
    if (owners[m.restaurant_id] && m.role !== "owner") continue;
    if (owners[m.restaurant_id]?.role === "owner" && m.role !== "owner")
      continue;
    const { data } = await admin.auth.admin.getUserById(m.user_id);
    owners[m.restaurant_id] = {
      user_id: m.user_id,
      email: data.user?.email ?? null,
      role: m.role,
    };
  }

  return NextResponse.json({ restaurants: restaurants ?? [], owners });
}

const RESTAURANT_FIELDS = [
  "name",
  "owner_name",
  "slug",
  "phone_whatsapp",
  "plan_type",
  "is_active",
  "subscription_end_date",
  "business_type",
  "city",
  "state",
] as const;

export async function PATCH(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    name?: string;
    owner_name?: string;
    slug?: string;
    phone_whatsapp?: string;
    plan_type?: string;
    is_active?: boolean;
    subscription_end_date?: string | null;
    business_type?: string;
    city?: string;
    state?: string;
    owner_email?: string;
    owner_password?: string;
  };

  if (!body.id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const { data: before, error: loadErr } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", body.id)
    .maybeSingle();

  if (loadErr || !before) {
    return NextResponse.json(
      { error: loadErr?.message ?? "restaurant not found" },
      { status: loadErr ? 500 : 404 },
    );
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.owner_name === "string")
    updates.owner_name = body.owner_name.trim();
  if (typeof body.plan_type === "string") updates.plan_type = body.plan_type;
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
  if (typeof body.business_type === "string")
    updates.business_type = body.business_type;
  if (typeof body.city === "string") updates.city = body.city.trim();
  if (typeof body.state === "string") updates.state = body.state.trim();
  if (body.subscription_end_date !== undefined) {
    updates.subscription_end_date = body.subscription_end_date;
  }
  if (typeof body.phone_whatsapp === "string") {
    updates.phone_whatsapp = body.phone_whatsapp.replace(/\D/g, "");
  }
  if (typeof body.slug === "string") {
    const slug = normalizeSlug(body.slug);
    if (!slug) {
      return NextResponse.json({ error: "slug inválido" }, { status: 400 });
    }
    if (slug !== before.slug) {
      const { data: clash } = await supabase
        .from("restaurants")
        .select("id")
        .eq("slug", slug)
        .neq("id", body.id)
        .maybeSingle();
      if (clash) {
        return NextResponse.json(
          { error: "El slug ya está en uso" },
          { status: 409 },
        );
      }
      updates.slug = slug;
    }
  }

  let after = before;
  if (Object.keys(updates).length > 0) {
    const { data: updated, error: updErr } = await supabase
      .from("restaurants")
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
    after = updated;

    await logFieldChanges({
      restaurantId: body.id,
      actorUserId: actor?.id,
      actorLabel: actor?.email ?? "super_admin",
      before: before as Record<string, unknown>,
      after: after as Record<string, unknown>,
      fields: [...RESTAURANT_FIELDS],
    });
  }

  const password = body.owner_password?.trim();
  const email = body.owner_email?.trim().toLowerCase();

  if (password || email) {
    let admin;
    try {
      admin = createServiceClient();
    } catch (e) {
      return NextResponse.json(
        {
          error:
            e instanceof Error
              ? e.message
              : "Configura SUPABASE_SERVICE_ROLE_KEY",
        },
        { status: 500 },
      );
    }

    const { data: members } = await admin
      .from("restaurant_members")
      .select("user_id, role")
      .eq("restaurant_id", body.id)
      .in("role", ["owner", "super_admin"]);

    const owner =
      members?.find((m) => m.role === "owner") ?? members?.[0] ?? null;

    if (owner) {
      const authUpdates: { password?: string; email?: string } = {};
      if (password) {
        if (password.length < 6) {
          return NextResponse.json(
            { error: "La contraseña debe tener al menos 6 caracteres" },
            { status: 400 },
          );
        }
        authUpdates.password = password;
      }
      if (email) authUpdates.email = email;

      let previousEmail: string | null = null;
      if (email) {
        const { data: existing } = await admin.auth.admin.getUserById(
          owner.user_id,
        );
        previousEmail = existing.user?.email ?? null;
      }

      const { error: updErr } = await admin.auth.admin.updateUserById(
        owner.user_id,
        authUpdates,
      );
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      if (password) {
        await writeAuditLog({
          restaurantId: body.id,
          actorUserId: actor?.id,
          actorLabel: actor?.email ?? "super_admin",
          action: "password_reset",
          fieldName: "owner_password",
          oldValue: null,
          newValue: null,
          summary: "Restableció contraseña del owner",
        });
      }
      if (email && email !== (previousEmail ?? "").toLowerCase()) {
        await writeAuditLog({
          restaurantId: body.id,
          actorUserId: actor?.id,
          actorLabel: actor?.email ?? "super_admin",
          action: "update",
          fieldName: "owner_email",
          oldValue: previousEmail,
          newValue: email,
          summary: "Actualizó email del owner",
        });
      }
    } else if (email && password) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: "La contraseña debe tener al menos 6 caracteres" },
          { status: 400 },
        );
      }
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
      if (createErr || !created.user) {
        return NextResponse.json(
          { error: createErr?.message ?? "No se pudo crear el usuario" },
          { status: 500 },
        );
      }
      const { error: memErr } = await admin.from("restaurant_members").insert({
        user_id: created.user.id,
        restaurant_id: body.id,
        role: "owner",
      });
      if (memErr) {
        return NextResponse.json({ error: memErr.message }, { status: 500 });
      }
      await writeAuditLog({
        restaurantId: body.id,
        actorUserId: actor?.id,
        actorLabel: actor?.email ?? "super_admin",
        action: "create",
        fieldName: "owner",
        oldValue: null,
        newValue: email,
        summary: "Creó owner y acceso",
      });
    } else {
      return NextResponse.json(
        {
          error:
            "Este tenant no tiene owner. Indica email y contraseña para crear el acceso.",
        },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({ ok: true, restaurant: after });
}
