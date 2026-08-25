import { NextResponse } from "next/server";
import { getSessionRestaurant } from "@/lib/restaurant";

export async function GET() {
  const session = await getSessionRestaurant();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    restaurant: session.restaurant,
    supportMode: session.supportMode === true,
  });
}
