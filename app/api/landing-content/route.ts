import { NextResponse } from "next/server";
import {
  DEFAULT_LANDING_CONTENT,
  DEFAULT_LANDING_FAQ,
  getLandingContent,
} from "@/lib/landing-content";

export async function GET() {
  try {
    const content = await getLandingContent();
    return NextResponse.json(content);
  } catch {
    return NextResponse.json({
      ...DEFAULT_LANDING_CONTENT,
      faq: [...DEFAULT_LANDING_FAQ],
    });
  }
}
