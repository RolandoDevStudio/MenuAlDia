import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantSession } from "@/lib/admin-session";
import { decryptSecret, encryptSecret, encryptionConfigured } from "@/lib/crypto-secret";
import { can } from "@/lib/plans";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  exchangeEmbeddedSignupCode,
  fetchPhoneDisplay,
  listWabaPhoneNumbers,
  registerCloudPhoneNumber,
  subscribeAppToWaba,
} from "@/lib/whatsapp-cloud";

export const runtime = "nodejs";

const ACCOUNT_PUBLIC_SELECT =
  "status, display_phone, whatsapp_bot_enabled, pull_menu_enabled, chat_orders_enabled, state_notifications_enabled, upselling_enabled, abandoned_cart_nudge, vip_broadcast_enabled, bot_menu_scope, guide_ack_at, guide_version, whatsapp_ai_marketing_addon, addon_trial_ends_at, templates_status, message_templates_config";

const ConnectSchema = z.object({
  restaurant_id: z.string().uuid(),
  code: z.string().min(8),
  waba_id: z.string().min(1),
  phone_number_id: z.string().min(1).optional(),
});

function metaEnvReady(): boolean {
  return Boolean(
    process.env.META_APP_ID?.trim() &&
      process.env.META_APP_SECRET?.trim() &&
      process.env.META_EMBEDDED_SIGNUP_CONFIG_ID?.trim() &&
      encryptionConfigured(),
  );
}

function generateCloudPin(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function POST(req: Request) {
  const session = await requireTenantSession();
  if (!can(session.restaurant.plan_type, "whatsapp_bot")) {
    return NextResponse.json({ error: "Plan Pro requerido" }, { status: 403 });
  }
  if (!metaEnvReady()) {
    return NextResponse.json(
      {
        error:
          "Conexión Meta no está lista en el servidor. Contacta a soporte de Menú al Día.",
      },
      { status: 503 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = ConnectSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  if (parsed.data.restaurant_id !== session.restaurant.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { code, waba_id: wabaId } = parsed.data;
  let phoneNumberId = parsed.data.phone_number_id?.trim() || "";

  const exchanged = await exchangeEmbeddedSignupCode(code);
  if (!exchanged.ok) {
    return NextResponse.json(
      { error: exchanged.message },
      { status: exchanged.status >= 400 ? exchanged.status : 400 },
    );
  }
  const accessToken = exchanged.data.accessToken;

  if (!phoneNumberId) {
    const listed = await listWabaPhoneNumbers(wabaId, accessToken);
    if (!listed.ok) {
      return NextResponse.json({ error: listed.message }, { status: 400 });
    }
    if (listed.data.length === 0) {
      return NextResponse.json(
        {
          error:
            "Meta no devolvió un número. Completa la verificación del teléfono en el flujo e inténtalo de nuevo.",
        },
        { status: 400 },
      );
    }
    if (listed.data.length > 1) {
      return NextResponse.json(
        {
          error:
            "Hay varios números en esa cuenta WhatsApp. Repite Conectar con Meta eligiendo un solo número.",
        },
        { status: 400 },
      );
    }
    phoneNumberId = listed.data[0].id;
  }

  const admin = createServiceClient();

  const { data: taken } = await admin
    .from("restaurant_whatsapp_accounts")
    .select("restaurant_id")
    .eq("phone_number_id", phoneNumberId)
    .neq("restaurant_id", session.restaurant.id)
    .maybeSingle();
  if (taken?.restaurant_id) {
    return NextResponse.json(
      {
        error:
          "Ese número de WhatsApp ya está vinculado a otro negocio en Menú al Día.",
      },
      { status: 409 },
    );
  }

  const subscribed = await subscribeAppToWaba(wabaId, accessToken);
  if (!subscribed.ok) {
    return NextResponse.json({ error: subscribed.message }, { status: 400 });
  }

  const { data: existing } = await admin
    .from("restaurant_whatsapp_accounts")
    .select("cloud_pin_encrypted")
    .eq("restaurant_id", session.restaurant.id)
    .maybeSingle();

  let pin = generateCloudPin();
  if (existing?.cloud_pin_encrypted) {
    try {
      pin = decryptSecret(existing.cloud_pin_encrypted);
    } catch {
      pin = generateCloudPin();
    }
  }

  const registered = await registerCloudPhoneNumber(
    phoneNumberId,
    accessToken,
    pin,
  );
  if (!registered.ok) {
    return NextResponse.json({ error: registered.message }, { status: 400 });
  }

  let displayPhone: string | null = null;
  const display = await fetchPhoneDisplay(phoneNumberId, accessToken);
  if (display.ok) {
    displayPhone = display.data.displayPhoneNumber;
  }

  const row = {
    restaurant_id: session.restaurant.id,
    waba_id: wabaId,
    phone_number_id: phoneNumberId,
    display_phone: displayPhone,
    access_token_encrypted: encryptSecret(accessToken),
    cloud_pin_encrypted: encryptSecret(pin),
    status: "connected" as const,
    updated_at: new Date().toISOString(),
  };

  const { data: account, error } = await admin
    .from("restaurant_whatsapp_accounts")
    .upsert(row, { onConflict: "restaurant_id" })
    .select(ACCOUNT_PUBLIC_SELECT)
    .single();

  if (error) {
    console.error("[whatsapp/connect]", error);
    return NextResponse.json(
      { error: "No se pudo guardar la conexión. Intenta de nuevo." },
      { status: 500 },
    );
  }

  return NextResponse.json({ account });
}

export async function DELETE(req: Request) {
  const session = await requireTenantSession();
  if (!can(session.restaurant.plan_type, "whatsapp_bot")) {
    return NextResponse.json({ error: "Plan Pro requerido" }, { status: 403 });
  }

  const url = new URL(req.url);
  const restaurantId =
    url.searchParams.get("restaurant_id") ||
    ((await req.json().catch(() => null)) as { restaurant_id?: string } | null)
      ?.restaurant_id;

  if (!restaurantId || restaurantId !== session.restaurant.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createServiceClient();
  const { data: account, error } = await admin
    .from("restaurant_whatsapp_accounts")
    .update({
      waba_id: null,
      phone_number_id: null,
      display_phone: null,
      access_token_encrypted: null,
      cloud_pin_encrypted: null,
      status: "disconnected",
      updated_at: new Date().toISOString(),
    })
    .eq("restaurant_id", session.restaurant.id)
    .select(ACCOUNT_PUBLIC_SELECT)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    account: account ?? {
      status: "disconnected",
      display_phone: null,
    },
  });
}
