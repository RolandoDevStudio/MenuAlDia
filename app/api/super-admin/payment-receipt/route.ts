import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";

const MAX_BYTES = 220 * 1024;

/** Upload SPEI/bank receipt (WebP) for a tenant payment. SA only. */
export async function POST(request: Request) {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await request.formData();
  const restaurantId = String(form.get("restaurant_id") ?? "").trim();
  const file = form.get("file");

  if (!restaurantId) {
    return NextResponse.json({ error: "restaurant_id required" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "archivo requerido" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "archivo demasiado grande (máx ~220KB)" },
      { status: 400 },
    );
  }

  const type = file.type || "image/webp";
  if (!["image/webp", "image/jpeg", "image/png"].includes(type)) {
    return NextResponse.json({ error: "formato no soportado" }, { status: 400 });
  }

  try {
    const admin = createServiceClient();
    const ext = type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : "webp";
    const path = `payments/${restaurantId}/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage.from("dish-photos").upload(path, buffer, {
      upsert: true,
      contentType: type,
      cacheControl: "31536000",
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { data } = admin.storage.from("dish-photos").getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "upload failed" },
      { status: 500 },
    );
  }
}
