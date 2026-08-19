import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";
import { writeAuditLog } from "@/lib/audit";
import {
  normalizeSlug,
  applySnapshotToRestaurant,
  cloneRestaurantMenu,
} from "@/lib/plan-templates";

export async function POST(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    source_slug?: string;
    template_id?: string;
    new_slug?: string;
    new_name?: string;
    owner_name?: string;
    phone_whatsapp?: string;
    owner_email?: string;
    owner_password?: string;
    business_type?: string;
    plan_type?: string;
  };

  const sourceSlug = body.source_slug?.trim();
  const templateId = body.template_id?.trim();
  const newSlug = normalizeSlug(body.new_slug ?? "");
  const newName = body.new_name?.trim();
  const ownerName = body.owner_name?.trim() ?? "";
  const phone = body.phone_whatsapp?.replace(/\D/g, "") ?? "";
  const ownerEmail = body.owner_email?.trim().toLowerCase();
  const ownerPassword = body.owner_password ?? "";
  const businessType = body.business_type?.trim();
  const planType = body.plan_type?.trim();

  if ((!sourceSlug && !templateId) || !newSlug || !newName) {
    return NextResponse.json(
      { error: "missing fields (source_slug o template_id, new_slug, new_name)" },
      { status: 400 },
    );
  }
  if (!ownerEmail || !ownerPassword) {
    return NextResponse.json(
      { error: "owner_email y owner_password son obligatorios" },
      { status: 400 },
    );
  }
  if (ownerPassword.length < 6) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres" },
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

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const { data: slugClash } = await supabase
    .from("restaurants")
    .select("id")
    .eq("slug", newSlug)
    .maybeSingle();
  if (slugClash) {
    return NextResponse.json(
      { error: "El slug ya está en uso" },
      { status: 409 },
    );
  }

  const subscriptionEnd = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  let created: Record<string, unknown> | null = null;
  let cloneLabel = "";

  if (templateId) {
    const { data: template, error: tplErr } = await supabase
      .from("plan_templates")
      .select("*")
      .eq("id", templateId)
      .maybeSingle();

    if (tplErr || !template) {
      return NextResponse.json(
        { error: tplErr?.message ?? "template not found" },
        { status: tplErr ? 500 : 404 },
      );
    }

    const { data: row, error: createErr } = await supabase
      .from("restaurants")
      .insert({
        slug: newSlug,
        name: newName,
        owner_name: ownerName,
        phone_whatsapp: phone,
        business_type: businessType || template.business_type,
        plan_type: planType || template.plan_type || "catalog",
        is_active: true,
        subscription_end_date: subscriptionEnd,
        theme_config: template.theme_config,
        slogan: "",
        address: "",
        schedule_text: "",
        shipping_cost: 0,
        free_shipping: false,
      })
      .select("*")
      .single();

    if (createErr || !row) {
      return NextResponse.json(
        { error: createErr?.message ?? "create failed" },
        { status: 500 },
      );
    }
    created = row;
    cloneLabel = `template:${template.slug_key}`;

    await applySnapshotToRestaurant(supabase, row.id, template.snapshot);
  } else {
    const { data: source, error: srcErr } = await supabase
      .from("restaurants")
      .select("*")
      .eq("slug", sourceSlug!)
      .maybeSingle();

    if (srcErr || !source) {
      return NextResponse.json({ error: "source not found" }, { status: 404 });
    }

    const { data: row, error: createErr } = await supabase
      .from("restaurants")
      .insert({
        slug: newSlug,
        name: newName,
        owner_name: ownerName || source.owner_name || "",
        slogan: source.slogan,
        logo_url: source.logo_url,
        phone_whatsapp: phone || source.phone_whatsapp,
        address: source.address,
        maps_url: source.maps_url,
        schedule_text: source.schedule_text,
        shipping_cost: source.shipping_cost,
        free_shipping: source.free_shipping,
        plan_type: planType || source.plan_type || "catalog",
        business_type: businessType || source.business_type || "restaurante",
        is_active: true,
        subscription_end_date: subscriptionEnd,
        theme_config: source.theme_config,
      })
      .select("*")
      .single();

    if (createErr || !row) {
      return NextResponse.json(
        { error: createErr?.message ?? "create failed" },
        { status: 500 },
      );
    }
    created = row;
    cloneLabel = `source:${source.slug}`;

    await cloneRestaurantMenu(supabase, source.id, row.id);
  }

  const restaurantId = created!.id as string;

  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: true,
  });

  if (authErr || !authUser.user) {
    return NextResponse.json(
      {
        error: `Tenant creado pero falló el usuario: ${authErr?.message ?? "unknown"}`,
        slug: created!.slug,
        id: restaurantId,
      },
      { status: 500 },
    );
  }

  const { error: memErr } = await admin.from("restaurant_members").insert({
    user_id: authUser.user.id,
    restaurant_id: restaurantId,
    role: "owner",
  });

  if (memErr) {
    return NextResponse.json(
      {
        error: `Usuario creado pero no se vinculó: ${memErr.message}`,
        slug: created!.slug,
        id: restaurantId,
      },
      { status: 500 },
    );
  }

  await writeAuditLog({
    restaurantId,
    actorUserId: actor?.id,
    actorLabel: actor?.email ?? "super_admin",
    action: "clone",
    fieldName: null,
    oldValue: cloneLabel,
    newValue: newSlug,
    summary: `Clonó tenant ${newName} (${cloneLabel} → ${newSlug})`,
  });

  return NextResponse.json({
    ok: true,
    slug: created!.slug,
    id: restaurantId,
    owner_email: ownerEmail,
  });
}
