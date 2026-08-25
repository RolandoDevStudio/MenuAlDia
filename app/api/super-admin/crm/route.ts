import { NextResponse } from "next/server";
import { isCurrentUserSuperAdmin } from "@/lib/restaurant";
import { loadSuperAdminCrm } from "@/lib/super-admin-crm-data";

export async function GET() {
  if (!(await isCurrentUserSuperAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const data = await loadSuperAdminCrm();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "crm failed" },
      { status: 500 },
    );
  }
}
