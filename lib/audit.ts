import { createClient } from "@/lib/supabase/server";

export type AuditAction =
  | "update"
  | "create"
  | "password_reset"
  | "payment"
  | "clone"
  | "sync_template";

export async function writeAuditLog(params: {
  restaurantId: string;
  actorUserId?: string | null;
  actorLabel?: string;
  action: AuditAction;
  fieldName?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  summary?: string;
}) {
  const supabase = await createClient();
  await supabase.from("audit_logs").insert({
    restaurant_id: params.restaurantId,
    actor_user_id: params.actorUserId ?? null,
    actor_label: params.actorLabel ?? "",
    action: params.action,
    field_name: params.fieldName ?? null,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
    summary: params.summary ?? "",
  });
}

export async function logFieldChanges(params: {
  restaurantId: string;
  actorUserId?: string | null;
  actorLabel?: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  fields: string[];
  action?: AuditAction;
}) {
  for (const field of params.fields) {
    const oldV = params.before[field];
    const newV = params.after[field];
    const oldS = oldV == null ? "" : String(oldV);
    const newS = newV == null ? "" : String(newV);
    if (oldS === newS) continue;
    await writeAuditLog({
      restaurantId: params.restaurantId,
      actorUserId: params.actorUserId,
      actorLabel: params.actorLabel,
      action: params.action ?? "update",
      fieldName: field,
      oldValue: oldS.slice(0, 2000),
      newValue: newS.slice(0, 2000),
      summary: `Actualizó ${field}`,
    });
  }
}
