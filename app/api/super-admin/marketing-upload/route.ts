import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";
import type { CanonicalDemoId } from "@/lib/canonical-demos";

const GIROS: CanonicalDemoId[] = ["restaurante", "servicios", "tienda"];

export async function POST(request: Request) {
  const ok = await isCurrentUserSuperAdmin();
  if (!ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await request.formData();
  const giro = String(form.get("giro") ?? "");
  const file = form.get("file");

  if (!GIROS.includes(giro as CanonicalDemoId)) {
    return NextResponse.json({ error: "giro inválido" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "archivo requerido" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "máx 5MB" }, { status: 400 });
  }

  const type = file.type || "image/webp";
  if (!["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(type)) {
    return NextResponse.json({ error: "tipo no permitido" }, { status: 400 });
  }

  try {
    const admin = createServiceClient();
    const ext = type.includes("png")
      ? "png"
      : type.includes("jpeg") || type.includes("jpg")
        ? "jpg"
        : "webp";
    const path = `marketing/${giro}-${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage.from("dish-photos").upload(path, buffer, {
      upsert: true,
      contentType: type,
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
