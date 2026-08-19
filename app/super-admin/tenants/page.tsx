"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Restaurant } from "@/lib/types";
import type { PlanType } from "@/lib/plans";
import { PLAN_LABELS, PLAN_PRICES_MXN } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type OwnerInfo = { user_id: string; email: string | null; role: string };

export default function TenantsPage() {
  const [rows, setRows] = useState<Restaurant[]>([]);
  const [owners, setOwners] = useState<Record<string, OwnerInfo>>({});
  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [cloneSource, setCloneSource] = useState("");
  const [cloneSlug, setCloneSlug] = useState("");
  const [cloneName, setCloneName] = useState("");
  const [clonePhone, setClonePhone] = useState("");
  const [cloneEmail, setCloneEmail] = useState("");
  const [clonePassword, setClonePassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [credDrafts, setCredDrafts] = useState<
    Record<string, { phone: string; email: string; password: string }>
  >({});

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
      // fallback client load
      const supabase = createClient();
      const { data } = await supabase
        .from("restaurants")
        .select("*")
        .order("created_at", { ascending: false });
      setRows((data ?? []) as Restaurant[]);
      return;
    }
    const list = (json.restaurants ?? []) as Restaurant[];
    setRows(list);
    setOwners(json.owners ?? {});
    if (json.warning) setMessage(json.warning);
    setCredDrafts((prev) => {
      const next = { ...prev };
      for (const r of list) {
        if (!next[r.id]) {
          next[r.id] = {
            phone: r.phone_whatsapp ?? "",
            email: json.owners?.[r.id]?.email ?? "",
            password: "",
          };
        } else {
          next[r.id] = {
            ...next[r.id],
            phone: next[r.id].phone || r.phone_whatsapp || "",
            email: next[r.id].email || json.owners?.[r.id]?.email || "",
          };
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (planFilter !== "all" && r.plan_type !== planFilter) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        r.name.toLowerCase().includes(s) ||
        r.slug.toLowerCase().includes(s) ||
        (owners[r.id]?.email ?? "").toLowerCase().includes(s)
      );
    });
  }, [rows, q, planFilter, owners]);

  async function patch(
    id: string,
    patch: Partial<
      Pick<Restaurant, "plan_type" | "is_active" | "subscription_end_date">
    >,
  ) {
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("restaurants")
      .update(patch)
      .eq("id", id);
    if (err) setError(err.message);
    else await load();
  }

  async function saveCredentials(id: string) {
    const draft = credDrafts[id];
    if (!draft) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/super-admin/tenants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        phone_whatsapp: draft.phone,
        owner_email: draft.email || undefined,
        owner_password: draft.password || undefined,
      }),
    });
    const json = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "No se pudieron guardar credenciales");
      return;
    }
    setMessage("Credenciales actualizadas");
    setCredDrafts((d) => ({
      ...d,
      [id]: { ...d[id], password: "" },
    }));
    await load();
  }

  async function cloneTenant() {
    setBusy(true);
    setMessage(null);
    setError(null);
    const res = await fetch("/api/super-admin/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_slug: cloneSource,
        new_slug: cloneSlug,
        new_name: cloneName,
        phone_whatsapp: clonePhone,
        owner_email: cloneEmail,
        owner_password: clonePassword,
      }),
    });
    const json = (await res.json()) as {
      error?: string;
      slug?: string;
      owner_email?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Error al clonar");
      return;
    }
    setMessage(
      `Clonado: /${json.slug} · login ${json.owner_email ?? cloneEmail}`,
    );
    setCloneSlug("");
    setCloneName("");
    setClonePhone("");
    setCloneEmail("");
    setClonePassword("");
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Suscriptores</h1>
        <p className="text-sm text-muted">
          El <strong>slug</strong> es la URL pública (`/mi-fonda`), no el usuario
          de login. El acceso al admin es con <strong>email + contraseña</strong>.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar nombre, slug o email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="h-11 rounded-lg border border-black/10 bg-surface px-3 text-sm"
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
        >
          <option value="all">Todos los planes</option>
          <option value="catalog">Catálogo</option>
          <option value="daily">Menú al Día</option>
          <option value="pro">Pro</option>
        </select>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-accent">{message}</p> : null}

      <ul className="space-y-3">
        {filtered.map((r) => {
          const draft = credDrafts[r.id] ?? {
            phone: r.phone_whatsapp ?? "",
            email: owners[r.id]?.email ?? "",
            password: "",
          };
          return (
            <li
              key={r.id}
              className="space-y-3 rounded-2xl border border-black/5 bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-xs text-muted">
                    Slug público: /{r.slug}
                  </p>
                  {owners[r.id]?.email ? (
                    <p className="text-xs text-muted">
                      Login: {owners[r.id].email}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700">
                      Sin usuario owner vinculado
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">Activo</span>
                  <Switch
                    checked={r.is_active !== false}
                    onCheckedChange={(on) => patch(r.id, { is_active: on })}
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Plan</Label>
                  <select
                    className="h-11 w-full rounded-lg border border-black/10 bg-background px-3 text-sm"
                    value={r.plan_type || "catalog"}
                    onChange={(e) =>
                      patch(r.id, { plan_type: e.target.value as PlanType })
                    }
                  >
                    {(Object.keys(PLAN_LABELS) as PlanType[]).map((p) => (
                      <option key={p} value={p}>
                        {PLAN_LABELS[p]} (${PLAN_PRICES_MXN[p]})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Vence</Label>
                  <Input
                    type="date"
                    value={r.subscription_end_date?.slice(0, 10) ?? ""}
                    onChange={(e) =>
                      patch(r.id, {
                        subscription_end_date: new Date(
                          e.target.value + "T23:59:59",
                        ).toISOString(),
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-black/5 bg-background/50 p-3">
                <p className="text-xs font-semibold text-muted">
                  Acceso admin (email ≠ slug)
                </p>
                <div className="space-y-1.5">
                  <Label>WhatsApp del negocio</Label>
                  <Input
                    value={draft.phone}
                    onChange={(e) =>
                      setCredDrafts((d) => ({
                        ...d,
                        [r.id]: { ...draft, phone: e.target.value },
                      }))
                    }
                    placeholder="52155…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email de login</Label>
                  <Input
                    type="email"
                    value={draft.email}
                    onChange={(e) =>
                      setCredDrafts((d) => ({
                        ...d,
                        [r.id]: { ...draft, email: e.target.value },
                      }))
                    }
                    placeholder="dueno@negocio.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nueva contraseña</Label>
                  <Input
                    type="password"
                    value={draft.password}
                    onChange={(e) =>
                      setCredDrafts((d) => ({
                        ...d,
                        [r.id]: { ...draft, password: e.target.value },
                      }))
                    }
                    placeholder="Dejar vacío para no cambiar"
                    autoComplete="new-password"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="w-full min-h-11"
                  disabled={busy}
                  onClick={() => saveCredentials(r.id)}
                >
                  Guardar teléfono / acceso
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="space-y-3 rounded-2xl border border-black/10 bg-surface p-4">
        <h2 className="text-sm font-semibold">Clonar plantilla</h2>
        <p className="text-xs text-muted">
          Crea el menú clonado y un usuario owner con email + contraseña para
          entrar a /admin/login.
        </p>
        <div className="space-y-1.5">
          <Label>Origen (slug público)</Label>
          <Input
            list="seed-slugs"
            value={cloneSource}
            onChange={(e) => setCloneSource(e.target.value)}
            placeholder="demo-fonda"
          />
          <datalist id="seed-slugs">
            {rows.map((r) => (
              <option key={r.id} value={r.slug} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label>Nuevo slug (URL pública)</Label>
          <Input
            value={cloneSlug}
            onChange={(e) => setCloneSlug(e.target.value)}
            placeholder="mi-fonda"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Nombre del negocio</Label>
          <Input
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
            placeholder="Mi Fonda"
          />
        </div>
        <div className="space-y-1.5">
          <Label>WhatsApp del negocio</Label>
          <Input
            value={clonePhone}
            onChange={(e) => setClonePhone(e.target.value)}
            placeholder="52155…"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Email de login (owner)</Label>
          <Input
            type="email"
            value={cloneEmail}
            onChange={(e) => setCloneEmail(e.target.value)}
            placeholder="dueno@negocio.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Contraseña de login</Label>
          <Input
            type="password"
            value={clonePassword}
            onChange={(e) => setClonePassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
          />
        </div>
        <Button
          className="w-full"
          disabled={
            busy ||
            !cloneSource ||
            !cloneSlug ||
            !cloneName ||
            !cloneEmail ||
            !clonePassword
          }
          onClick={cloneTenant}
        >
          {busy ? "Clonando…" : "Clonar tenant"}
        </Button>
      </section>
    </div>
  );
}
