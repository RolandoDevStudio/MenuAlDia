import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionRestaurant } from "@/lib/restaurant";
import {
  effectiveAcceptingOrders,
  parseScheduleHours,
} from "@/lib/store-hours";

export async function POST(request: Request) {
  const session = await getSessionRestaurant();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    accepting?: boolean;
    closed_message?: string;
    clear_override?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const supabase = await createClient();
  const rid = session.restaurant.id;
  const scheduleAuto = Boolean(session.restaurant.schedule_auto);
  const hours = parseScheduleHours(session.restaurant.schedule_hours);

  if (body.clear_override) {
    const accepting = effectiveAcceptingOrders({
      accepting_orders: session.restaurant.accepting_orders,
      schedule_auto: scheduleAuto,
      schedule_hours: hours,
      orders_override: null,
    });
    const { error } = await supabase
      .from("restaurants")
      .update({
        orders_override: null,
        accepting_orders: accepting,
      })
      .eq("id", rid);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      accepting_orders: accepting,
      orders_override: null,
    });
  }

  const accepting = body.accepting !== false;
  const msg =
    typeof body.closed_message === "string"
      ? body.closed_message.trim().slice(0, 160)
      : undefined;

  const updates: Record<string, unknown> = {
    accepting_orders: accepting,
  };

  if (scheduleAuto) {
    updates.orders_override = accepting ? "force_open" : "force_closed";
  } else {
    updates.orders_override = null;
  }

  if (!accepting && msg !== undefined) {
    updates.closed_message = msg;
  }
  if (accepting && msg === "") {
    updates.closed_message = "";
  }

  const { error } = await supabase
    .from("restaurants")
    .update(updates)
    .eq("id", rid);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    accepting_orders: accepting,
    orders_override: updates.orders_override ?? null,
    closed_message:
      !accepting && msg !== undefined
        ? msg
        : session.restaurant.closed_message ?? "",
  });
}
