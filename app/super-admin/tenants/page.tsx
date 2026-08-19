"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BusinessType, Restaurant } from "@/lib/types";
import type { PlanType } from "@/lib/plans";
import { PLAN_LABELS } from "@/lib/plans";
import {
  BUSINESS_TYPE_LABELS,
  BUSINESS_TYPES,
} from "@/lib/business-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TenantsTable, type OwnerInfo } from "@/components/super-admin/tenants-table";
import { CreateAdminModal } from "@/components/super-admin/create-admin-modal";
import { TenantEditModal } from "@/components/super-admin/tenant-edit-modal";

const selectClass =
  "h-11 rounded-lg border border-black/10 bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand";

export default function TenantsPage() {
  const [rows, setRows] = useState<Restaurant[]>([]);
  const [owners, setOwners] = useState<Record<string, OwnerInfo>>({});
  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [giroFilter, setGiroFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Restaurant | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/super-admin/tenants");
    const json = (await res.json()) as {
      restaurants?: Restaurant[];
      owners?: Record<string, OwnerInfo>;
      error?: string;
      warning?: string;
    };
    if (!res.ok) {
      setError(json.error ?? "No se pudieron cargar suscriptores");
      return;
    }
    setRows(json.restaurants ?? []);
    setOwners(json.owners ?? {});
    if (json.warning) setMessage(json.warning);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (planFilter !== "all" && r.plan_type !== planFilter) return false;
      if (giroFilter !== "all" && r.business_type !== giroFilter) return false;
      if (
        cityFilter.trim() &&
        !(r.city ?? "").toLowerCase().includes(cityFilter.toLowerCase()) &&
        !(r.state ?? "").toLowerCase().includes(cityFilter.toLowerCase())
      ) {
        return false;
      }
      if (activeFilter === "active" && r.is_active === false) return false;
      if (activeFilter === "inactive" && r.is_active !== false) return false;
      if (!q.trim()) return true;
      const s = q.toLowerCase();
      return (
        r.name.toLowerCase().includes(s) ||
        r.slug.toLowerCase().includes(s) ||
        (r.owner_name ?? "").toLowerCase().includes(s) ||
        (r.phone_whatsapp ?? "").includes(s) ||
        (owners[r.id]?.email ?? "").toLowerCase().includes(s)
      );
    });
  }, [rows, q, planFilter, giroFilter, cityFilter, activeFilter, owners]);

  function handleSaved(updated?: Restaurant) {
    if (updated) {
      setRows((prev) =>
        prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
      );
      setEditing(updated);
    }
    void load();
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Tenants</h1>
          <p className="text-sm text-muted">
            El slug es la URL pública; el acceso al admin es con email +
            contraseña.
          </p>
        </div>
        <Button type="button" className="shrink-0" onClick={() => setCreateOpen(true)}>
          Crear Nuevo Admin
        </Button>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Input
          placeholder="Buscar nombre, slug, dueño, email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full min-w-0 sm:max-w-xs"
        />
        <select
          className={`${selectClass} w-full sm:w-auto`}
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
        >
          <option value="all">Todos los planes</option>
          {(Object.keys(PLAN_LABELS) as PlanType[]).map((p) => (
            <option key={p} value={p}>
              {PLAN_LABELS[p]}
            </option>
          ))}
        </select>
        <select
          className={`${selectClass} w-full sm:w-auto`}
          value={giroFilter}
          onChange={(e) => setGiroFilter(e.target.value)}
        >
          <option value="all">Todos los giros</option>
          {BUSINESS_TYPES.map((bt: BusinessType) => (
            <option key={bt} value={bt}>
              {BUSINESS_TYPE_LABELS[bt]}
            </option>
          ))}
        </select>
        <select
          className={`${selectClass} w-full sm:w-auto`}
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
        >
          <option value="all">Activos e inactivos</option>
          <option value="active">Solo activos</option>
          <option value="inactive">Solo inactivos</option>
        </select>
        <Input
          placeholder="Ciudad / estado…"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="w-full min-w-0 sm:max-w-[10rem]"
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-accent">{message}</p> : null}

      <TenantsTable
        restaurants={filtered}
        owners={owners}
        onEdit={setEditing}
      />

      <CreateAdminModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingSlugs={rows.map((r) => r.slug)}
        onCreated={() => {
          setMessage("Admin creado");
          void load();
        }}
      />

      <TenantEditModal
        restaurant={editing}
        ownerEmail={editing ? (owners[editing.id]?.email ?? null) : null}
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSaved={handleSaved}
      />
    </div>
  );
}
