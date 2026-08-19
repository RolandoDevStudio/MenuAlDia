"use client";

import { useMemo, useState } from "react";
import type { BusinessType, Restaurant } from "@/lib/types";
import type { PlanType } from "@/lib/plans";
import { PLAN_LABELS } from "@/lib/plans";
import { BUSINESS_TYPE_LABELS } from "@/lib/business-labels";
import { Button } from "@/components/ui/button";
import { RemindPaymentButton } from "@/components/super-admin/remind-payment-button";

export type OwnerInfo = { user_id: string; email: string | null; role: string };

type SortKey =
  | "name"
  | "owner_name"
  | "slug"
  | "plan"
  | "business_type"
  | "is_active"
  | "subscription_end_date"
  | "phone"
  | "email";

type Props = {
  restaurants: Restaurant[];
  owners: Record<string, OwnerInfo>;
  onEdit: (restaurant: Restaurant) => void;
};

function cmp(a: string | number | boolean, b: string | number | boolean) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function TenantsTable({ restaurants, owners, onEdit }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    const list = [...restaurants];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let av: string | number | boolean = "";
      let bv: string | number | boolean = "";
      switch (sortKey) {
        case "name":
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          break;
        case "owner_name":
          av = (a.owner_name ?? "").toLowerCase();
          bv = (b.owner_name ?? "").toLowerCase();
          break;
        case "slug":
          av = a.slug.toLowerCase();
          bv = b.slug.toLowerCase();
          break;
        case "plan":
          av = a.plan_type || "catalog";
          bv = b.plan_type || "catalog";
          break;
        case "business_type":
          av = a.business_type || "restaurante";
          bv = b.business_type || "restaurante";
          break;
        case "is_active":
          av = a.is_active !== false;
          bv = b.is_active !== false;
          break;
        case "subscription_end_date":
          av = a.subscription_end_date
            ? new Date(a.subscription_end_date).getTime()
            : 0;
          bv = b.subscription_end_date
            ? new Date(b.subscription_end_date).getTime()
            : 0;
          break;
        case "phone":
          av = a.phone_whatsapp ?? "";
          bv = b.phone_whatsapp ?? "";
          break;
        case "email":
          av = (owners[a.id]?.email ?? "").toLowerCase();
          bv = (owners[b.id]?.email ?? "").toLowerCase();
          break;
      }
      return cmp(av, bv) * dir;
    });
    return list;
  }, [restaurants, owners, sortKey, sortDir]);

  const header = (key: SortKey, label: string) => (
    <th className="whitespace-nowrap px-2 py-2 text-left font-semibold">
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-brand"
        onClick={() => toggleSort(key)}
      >
        {label}
        {sortKey === key ? (
          <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
        ) : null}
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-black/10 bg-surface">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="border-b border-black/10 text-xs text-muted">
          <tr>
            {header("name", "Nombre")}
            {header("owner_name", "Dueño")}
            {header("slug", "Slug")}
            {header("plan", "Plan")}
            {header("business_type", "Giro")}
            {header("is_active", "Activo")}
            {header("subscription_end_date", "Vence")}
            {header("phone", "Teléfono")}
            {header("email", "Email")}
            <th className="px-2 py-2 text-left font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={10}
                className="px-3 py-8 text-center text-sm text-muted"
              >
                No hay tenants con esos filtros.
              </td>
            </tr>
          ) : (
            sorted.map((r) => {
              const plan = (r.plan_type || "catalog") as PlanType;
              const giro = (r.business_type || "restaurante") as BusinessType;
              return (
                <tr
                  key={r.id}
                  className="border-t border-black/5 hover:bg-black/[0.02]"
                >
                  <td className="px-2 py-2.5 font-medium">{r.name}</td>
                  <td className="px-2 py-2.5 text-muted">
                    {r.owner_name || "—"}
                  </td>
                  <td className="px-2 py-2.5 font-mono text-xs">/{r.slug}</td>
                  <td className="px-2 py-2.5">
                    {PLAN_LABELS[plan] ?? plan}
                  </td>
                  <td className="px-2 py-2.5">
                    {BUSINESS_TYPE_LABELS[giro] ?? giro}
                  </td>
                  <td className="px-2 py-2.5">
                    {r.is_active !== false ? (
                      <span className="text-accent">Sí</span>
                    ) : (
                      <span className="text-red-600">No</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5">
                    {r.subscription_end_date
                      ? new Date(r.subscription_end_date).toLocaleDateString(
                          "es-MX",
                        )
                      : "—"}
                  </td>
                  <td className="px-2 py-2.5 font-mono text-xs">
                    {r.phone_whatsapp || "—"}
                  </td>
                  <td className="max-w-[10rem] truncate px-2 py-2.5 text-xs">
                    {owners[r.id]?.email ?? "—"}
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => onEdit(r)}
                      >
                        Editar
                      </Button>
                      <RemindPaymentButton restaurant={r} />
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
