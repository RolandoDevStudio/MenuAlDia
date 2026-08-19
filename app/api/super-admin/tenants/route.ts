import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";

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

export async function PATCH(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    phone_whatsapp?: string;
    owner_email?: string;
    owner_password?: string;
  };

  if (!body.id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

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

  if (typeof body.phone_whatsapp === "string") {
    const phone = body.phone_whatsapp.replace(/\D/g, "");
    const { error } = await admin
      .from("restaurants")
      .update({ phone_whatsapp: phone })
      .eq("id", body.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const password = body.owner_password?.trim();
  const email = body.owner_email?.trim().toLowerCase();

  if (password || email) {
    const { data: members } = await admin
      .from("restaurant_members")
      .select("user_id, role")
      .eq("restaurant_id", body.id)
      .in("role", ["owner", "super_admin"]);

    const owner =
      members?.find((m) => m.role === "owner") ?? members?.[0] ?? null;

    if (owner) {
      const updates: { password?: string; email?: string } = {};
      if (password) {
        if (password.length < 6) {
          return NextResponse.json(
            { error: "La contraseña debe tener al menos 6 caracteres" },
            { status: 400 },
          );
        }
        updates.password = password;
      }
      if (email) updates.email = email;
      const { error: updErr } = await admin.auth.admin.updateUserById(
        owner.user_id,
        updates,
      );
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
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

  return NextResponse.json({ ok: true });
}
