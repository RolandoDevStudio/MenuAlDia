import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";
import { deleteStoragePublicUrl } from "@/lib/storage-cleanup";
import type { CanonicalDemoId } from "@/lib/canonical-demos";

const GIROS: CanonicalDemoId[] = ["restaurante", "servicios", "tienda"];
const MAX_COMPRESSED_BYTES = 220 * 1024;

export async function POST(request: Request) {
  const ok = await isCurrentUserSuperAdmin();
  if (!ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await request.formData();
  const giro = String(form.get("giro") ?? "");
  const previousUrl = String(form.get("previousUrl") ?? "") || null;
  const file = form.get("file");

  if (!GIROS.includes(giro as CanonicalDemoId)) {
    return NextResponse.json({ error: "giro inválido" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "archivo requerido" }, { status: 400 });
  }
  if (file.size > MAX_COMPRESSED_BYTES) {
    return NextResponse.json(
      { error: "archivo demasiado grande (comprime a WebP ≤140KB)" },
      { status: 400 },
    );
  }

  const type = file.type || "image/webp";
  if (type !== "image/webp") {
    return NextResponse.json(
      { error: "solo WebP comprimido desde el cliente" },
      { status: 400 },
    );
  }

  try {
    const admin = createServiceClient();
    const path = `marketing/${giro}-${crypto.randomUUID()}.webp`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage.from("dish-photos").upload(path, buffer, {
      upsert: true,
      contentType: "image/webp",
      cacheControl: "31536000",
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { data } = admin.storage.from("dish-photos").getPublicUrl(path);
    void deleteStoragePublicUrl(admin, previousUrl);
    return NextResponse.json({ url: data.publicUrl });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "upload failed" },
      { status: 500 },
    );
  }
}

/** Best-effort purge when clearing a poster URL without replacing. */
export async function DELETE(request: Request) {
  const ok = await isCurrentUserSuperAdmin();
  if (!ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { url?: string };
  try {
    const admin = createServiceClient();
    await deleteStoragePublicUrl(admin, body.url);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
