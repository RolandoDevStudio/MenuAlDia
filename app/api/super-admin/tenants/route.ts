import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";
import { writeAuditLog, logFieldChanges } from "@/lib/audit";
import { normalizeSlug } from "@/lib/plan-templates";
import { isMxStateCode, normalizeLegacyState } from "@/lib/mx-locations";
import { CANONICAL_DEMOS } from "@/lib/canonical-demos";
import { purgeRestaurantStorageFolder } from "@/lib/storage-cleanup";
import { menuCacheTag } from "@/lib/restaurant";
import { revalidateTag } from "next/cache";

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

  // Only real owners — never surface super_admin as the tenant login.
  const { data: members } = await admin
    .from("restaurant_members")
    .select("user_id, restaurant_id, role")
    .eq("role", "owner");

  const owners: Record<
    string,
    { user_id: string; email: string | null; role: string }
  > = {};

  for (const m of members ?? []) {
    if (owners[m.restaurant_id]) continue;
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
  if (typeof body.state === "string") {
    const code =
      normalizeLegacyState(body.state) || body.state.trim().toUpperCase();
    if (code && !isMxStateCode(code)) {
      return NextResponse.json(
        { error: "estado inválido" },
        { status: 400 },
      );
    }
    updates.state = code;
  }
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

    // Never fall back to super_admin — that would rewrite the platform login.
    const { data: ownerRow } = await admin
      .from("restaurant_members")
      .select("user_id, role")
      .eq("restaurant_id", body.id)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    if (ownerRow) {
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
          ownerRow.user_id,
        );
        previousEmail = existing.user?.email ?? null;
      }

      const { error: updErr } = await admin.auth.admin.updateUserById(
        ownerRow.user_id,
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

      let userId: string | null = null;
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (created?.user) {
        userId = created.user.id;
      } else {
        // Auth user may already exist (e.g. created in Dashboard) — link it.
        const { data: listed } = await admin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        const existing = listed.users.find(
          (u) => (u.email ?? "").toLowerCase() === email,
        );
        if (!existing) {
          return NextResponse.json(
            {
              error:
                createErr?.message ??
                "No se pudo crear ni encontrar el usuario Auth",
            },
            { status: 500 },
          );
        }
        userId = existing.id;
        if (password) {
          const { error: pwErr } = await admin.auth.admin.updateUserById(
            userId,
            { password, email_confirm: true },
          );
          if (pwErr) {
            return NextResponse.json({ error: pwErr.message }, { status: 500 });
          }
        }
      }

      const { error: memErr } = await admin.from("restaurant_members").insert({
        user_id: userId,
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
        summary: "Creó o enlazó owner y acceso",
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

/**
 * Permanent tenant delete. Requires confirmSlug === restaurant.slug.
 * Cascades app data; deletes Auth users only if they have no other memberships
 * and are not super_admin elsewhere.
 */
export async function DELETE(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    confirmSlug?: string;
    forceDemo?: boolean;
  };

  if (!body.id || !body.confirmSlug?.trim()) {
    return NextResponse.json(
      { error: "id y confirmSlug requeridos" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const { data: restaurant, error: loadErr } = await supabase
    .from("restaurants")
    .select("id, slug, name")
    .eq("id", body.id)
    .maybeSingle();

  if (loadErr || !restaurant) {
    return NextResponse.json(
      { error: loadErr?.message ?? "restaurant not found" },
      { status: loadErr ? 500 : 404 },
    );
  }

  if (restaurant.slug !== body.confirmSlug.trim()) {
    return NextResponse.json(
      { error: "El slug no coincide. Escribe el slug exacto para confirmar." },
      { status: 400 },
    );
  }

  const isDemo = CANONICAL_DEMOS.some((d) => d.slug === restaurant.slug);
  if (isDemo && !body.forceDemo) {
    return NextResponse.json(
      {
        error:
          "No se pueden borrar demos canónicos. Usa forceDemo solo en casos excepcionales.",
      },
      { status: 400 },
    );
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

  const { data: members } = await admin
    .from("restaurant_members")
    .select("user_id, role")
    .eq("restaurant_id", restaurant.id);

  const memberIds = [...new Set((members ?? []).map((m) => m.user_id))];

  console.info("[tenant-delete]", {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    actor: actor?.email ?? actor?.id,
    memberCount: memberIds.length,
  });

  await writeAuditLog({
    restaurantId: restaurant.id,
    actorUserId: actor?.id,
    actorLabel: actor?.email ?? "super_admin",
    action: "delete",
    fieldName: "restaurant",
    oldValue: `${restaurant.slug}:${restaurant.name}`,
    newValue: null,
    summary: `Eliminación permanente de /${restaurant.slug}`,
  });

  await purgeRestaurantStorageFolder(admin, restaurant.id);

  const { error: delErr } = await admin
    .from("restaurants")
    .delete()
    .eq("id", restaurant.id);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  const deletedUsers: string[] = [];
  for (const userId of memberIds) {
    if (actor?.id && userId === actor.id) continue;

    const { data: other } = await admin
      .from("restaurant_members")
      .select("restaurant_id, role")
      .eq("user_id", userId);

    if ((other ?? []).length > 0) continue;

    const { error: userErr } = await admin.auth.admin.deleteUser(userId);
    if (userErr) {
      console.warn("[tenant-delete] auth user", userId, userErr.message);
    } else {
      deletedUsers.push(userId);
    }
  }

  try {
    revalidateTag(menuCacheTag(restaurant.slug), "max");
  } catch {
    /* ignore */
  }

  return NextResponse.json({
    ok: true,
    deletedSlug: restaurant.slug,
    deletedAuthUsers: deletedUsers.length,
  });
}
