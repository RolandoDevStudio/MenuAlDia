import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { slug?: string };
    if (!body.slug) {
      return NextResponse.json({ error: "slug required" }, { status: 400 });
    }
    revalidatePath(`/${body.slug}`);
    revalidatePath(`/demo`);
    return NextResponse.json({ revalidated: true });
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
}
