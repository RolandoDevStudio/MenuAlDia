"use client";

import { useEffect, useMemo, useState } from "react";
import { Cake, Plus, Search, Trash2, MessageCircle } from "lucide-react";
import type { Customer, CustomerPhoto } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import {
  type CampaignFilter,
  filterCampaignCustomers,
  buildCampaignMessage,
  openCampaignWhatsApp,
  templateKindForFilter,
  isBirthdayWithinDays,
} from "@/lib/crm-campaigns";
import { CampaignPanel } from "@/components/admin/campaign-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const TAG_OPTIONS = ["VIP", "Para llevar", "Frecuente", "Familiar"] as const;
const MAX_PHOTOS = 5;

type Props = {
  restaurantId: string;
  restaurantName: string;
  initialCustomers: Customer[];
  loyaltyGoal: number;
  loyaltyRewardLabel: string;
};

function isBirthdayToday(birthday: string | null | undefined) {
  if (!birthday) return false;
  const d = new Date(birthday + "T12:00:00");
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function CustomersCrm({
  restaurantId,
  restaurantName,
  initialCustomers,
  loyaltyGoal: initialGoal,
  loyaltyRewardLabel: initialReward,
}: Props) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [q, setQ] = useState("");
  const [campaignFilter, setCampaignFilter] = useState<CampaignFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [goal, setGoal] = useState(initialGoal || 10);
  const [rewardLabel, setRewardLabel] = useState(
    initialReward || "Recompensa gratis",
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [rewardOpen, setRewardOpen] = useState<Customer | null>(null);
  const [photos, setPhotos] = useState<CustomerPhoto[]>([]);
  const [busy, setBusy] = useState(false);

  const selected = customers.find((c) => c.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const byCampaign = filterCampaignCustomers(customers, campaignFilter);
    const s = q.trim().toLowerCase();
    if (!s) return byCampaign;
    return byCampaign.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        (c.phone ?? "").includes(s) ||
        (c.tags ?? []).some((t) => t.toLowerCase().includes(s)),
    );
  }, [customers, q, campaignFilter]);

  function sendCampaignWa(c: Customer) {
    if (!c.phone?.trim()) {
      setMsg("Agrega un teléfono al cliente para WhatsApp");
      return;
    }
    const msg = buildCampaignMessage({
      kind: templateKindForFilter(campaignFilter),
      customerName: c.name,
      businessName: restaurantName,
    });
    openCampaignWhatsApp(c.phone, msg);
  }

  useEffect(() => {
    if (!selectedId) {
      setPhotos([]);
      return;
    }
    void loadPhotos(selectedId);
  }, [selectedId]);

  async function loadPhotos(customerId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("customer_photos")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as CustomerPhoto[];
    const withUrls: CustomerPhoto[] = [];
    for (const row of rows) {
      const { data: signed } = await supabase.storage
        .from("crm-photos")
        .createSignedUrl(row.storage_path, 3600);
      withUrls.push({ ...row, signed_url: signed?.signedUrl ?? null });
    }
    setPhotos(withUrls);
  }

  async function saveLoyaltySettings() {
    const supabase = createClient();
    const { error } = await supabase
      .from("restaurants")
      .update({
        loyalty_goal: Math.max(1, Number(goal) || 10),
        loyalty_reward_label: rewardLabel.trim() || "Recompensa gratis",
      })
      .eq("id", restaurantId);
    setMsg(error ? error.message : "Meta de lealtad guardada");
  }

  async function createCustomer() {
    const phone = window.prompt("Teléfono (WhatsApp) del cliente");
    if (!phone?.trim()) return;
    const name = window.prompt("Nombre", "Cliente") || "Cliente";
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("customers")
      .insert({
        restaurant_id: restaurantId,
        name: name.trim(),
        phone: phone.trim(),
      })
      .select("*")
      .single();
    setBusy(false);
    if (error || !data) {
      setMsg(error?.message ?? "No se pudo crear");
      return;
    }
    setCustomers((list) => [data as Customer, ...list]);
    setSelectedId(data.id);
    setMsg("Cliente creado");
  }

  async function patchCustomer(id: string, patch: Partial<Customer>) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("customers")
      .update(patch)
      .eq("id", id)
      .eq("restaurant_id", restaurantId)
      .select("*")
      .single();
    if (error || !data) {
      setMsg(error?.message ?? "No se pudo guardar");
      return;
    }
    setCustomers((list) =>
      list.map((c) => (c.id === id ? (data as Customer) : c)),
    );
  }

  async function addVisit(c: Customer) {
    setBusy(true);
    const supabase = createClient();
    const goalN = Math.max(1, Number(goal) || 10);
    const toward = (c.visits_toward_reward ?? 0) + 1;
    const visitCount = (c.visit_count ?? 0) + 1;
    const now = new Date().toISOString();
    await supabase.from("customer_visits").insert({
      restaurant_id: restaurantId,
      customer_id: c.id,
    });
    const { data, error } = await supabase
      .from("customers")
      .update({
        visit_count: visitCount,
        visits_toward_reward: toward,
        last_visit_at: now,
      })
      .eq("id", c.id)
      .select("*")
      .single();
    setBusy(false);
    if (error || !data) {
      setMsg(error?.message ?? "No se registró la visita");
      return;
    }
    const updated = data as Customer;
    setCustomers((list) => list.map((x) => (x.id === c.id ? updated : x)));
    if (toward >= goalN) setRewardOpen(updated);
    else setMsg(`Visita registrada (${toward}/${goalN})`);
  }

  async function redeemReward(c: Customer) {
    setBusy(true);
    const toward = c.visits_toward_reward ?? 0;
    const goalN = Math.max(1, Number(goal) || 10);
    const leftover = Math.max(0, toward - goalN);
    await patchCustomer(c.id, {
      visits_toward_reward: leftover,
      rewards_redeemed: (c.rewards_redeemed ?? 0) + 1,
    } as Partial<Customer>);
    setBusy(false);
    setRewardOpen(null);
    setMsg("Recompensa canjeada");
  }

  async function uploadPhoto(file: File | null) {
    if (!selected || !file) return;
    if (photos.length >= MAX_PHOTOS) {
      setMsg(`Máximo ${MAX_PHOTOS} fotos`);
      return;
    }
    setBusy(true);
    try {
      const compressed = await compressImage(file, "product");
      const path = `${restaurantId}/crm/${selected.id}/${crypto.randomUUID()}.webp`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("crm-photos")
        .upload(path, compressed, {
          contentType: "image/webp",
          upsert: false,
        });
      if (upErr) throw upErr;
      const { error } = await supabase.from("customer_photos").insert({
        restaurant_id: restaurantId,
        customer_id: selected.id,
        storage_path: path,
      });
      if (error) throw error;
      await loadPhotos(selected.id);
      setMsg("Foto agregada");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al subir foto");
    }
    setBusy(false);
  }

  async function deletePhoto(photo: CustomerPhoto) {
    if (!confirm("¿Eliminar esta foto?")) return;
    const supabase = createClient();
    await supabase.storage.from("crm-photos").remove([photo.storage_path]);
    await supabase.from("customer_photos").delete().eq("id", photo.id);
    setPhotos((list) => list.filter((p) => p.id !== photo.id));
  }

  function toggleTag(tag: string) {
    if (!selected) return;
    const tags = new Set(selected.tags ?? []);
    if (tags.has(tag)) tags.delete(tag);
    else tags.add(tag);
    void patchCustomer(selected.id, { tags: [...tags] } as Partial<Customer>);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand/20 bg-brand/5 px-3 py-2 text-xs text-muted">
        Tip: pide autorización verbal antes de tomar fotos del servicio. Las
        fichas y fotos son privadas; solo tú las ves en tu panel. Enfoca el
        trabajo (corte, uñas, platillo), no rostros completos cuando sea
        posible.
      </div>

      <CampaignPanel
        customers={customers}
        businessName={restaurantName}
        activeFilter={campaignFilter}
        onFilterChange={setCampaignFilter}
      />

      <div className="grid gap-3 rounded-xl border border-black/5 bg-surface p-3 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1">
          <Label htmlFor="loyalty-goal">Meta de visitas</Label>
          <Input
            id="loyalty-goal"
            type="number"
            min={1}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value) || 10)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="loyalty-reward">Recompensa</Label>
          <Input
            id="loyalty-reward"
            value={rewardLabel}
            onChange={(e) => setRewardLabel(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 w-full"
            onClick={() => void saveLoyaltySettings()}
          >
            Guardar meta
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o teléfono"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button
          type="button"
          className="min-h-11"
          disabled={busy}
          onClick={() => void createCustomer()}
        >
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </Button>
      </div>

      {msg ? (
        <p className="text-xs text-accent" role="status">
          {msg}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <ul className="max-h-[70vh] space-y-2 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="rounded-xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-muted">
              {campaignFilter === "all"
                ? "No hay clientes. Crea uno por teléfono."
                : "Nadie en este filtro. Cambia el filtro de campañas."}
            </li>
          ) : (
            filtered.map((c) => {
              const toward = c.visits_toward_reward ?? 0;
              const goalN = Math.max(1, goal);
              const pct = Math.min(100, Math.round((toward / goalN) * 100));
              return (
                <li key={c.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(c.id);
                      }
                    }}
                    className={cn(
                      "w-full cursor-pointer rounded-xl border px-3 py-3 text-left transition",
                      selectedId === c.id
                        ? "border-brand bg-brand/5"
                        : "border-black/5 bg-surface",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-medium">
                          {c.name}
                          {isBirthdayToday(c.birthday) ? (
                            <span className="inline-flex items-center gap-0.5 text-xs text-brand">
                              <Cake className="h-3.5 w-3.5" /> Hoy
                            </span>
                          ) : isBirthdayWithinDays(c.birthday, 7) ? (
                            <span className="inline-flex items-center gap-0.5 text-xs text-brand">
                              <Cake className="h-3.5 w-3.5" /> Pronto
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted">
                          {c.phone || "Sin teléfono"} · {c.visit_count ?? 0}{" "}
                          visitas
                        </p>
                        {(c.tags ?? []).length > 0 ? (
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-brand">
                            {(c.tags ?? []).join(" · ")}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="shrink-0"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          void addVisit(c);
                        }}
                      >
                        +1 visita
                      </Button>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      Lealtad {toward}/{goalN}
                      {toward >= goalN ? " · ¡Listo para canjear!" : ""}
                    </p>
                  </div>
                </li>
              );
            })
          )}
        </ul>

        <div className="rounded-xl border border-black/5 bg-surface p-4">
          {!selected ? (
            <p className="text-sm text-muted">
              Selecciona un cliente para ver su ficha.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-semibold">{selected.name}</h2>
                <p className="text-xs text-muted">
                  Ficha privada · {restaurantName}
                </p>
                {selected.phone ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-2"
                    onClick={() => sendCampaignWa(selected)}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp campaña
                  </Button>
                ) : null}
              </div>

              {selected.allergies_alert ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  Alerta: {selected.allergies_alert}
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Nombre</Label>
                  <Input
                    defaultValue={selected.name}
                    key={`name-${selected.id}`}
                    onBlur={(e) =>
                      void patchCustomer(selected.id, {
                        name: e.target.value.trim() || selected.name,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Teléfono</Label>
                  <Input
                    defaultValue={selected.phone ?? ""}
                    key={`phone-${selected.id}`}
                    onBlur={(e) =>
                      void patchCustomer(selected.id, {
                        phone: e.target.value.trim() || null,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Lo de siempre / favorito</Label>
                <Input
                  defaultValue={selected.favorite_service ?? ""}
                  key={`fav-${selected.id}`}
                  placeholder="Ej. Fade 1.5 con navaja"
                  onBlur={(e) =>
                    void patchCustomer(selected.id, {
                      favorite_service: e.target.value,
                    } as Partial<Customer>)
                  }
                />
              </div>

              <div className="space-y-1">
                <Label>Alergias / alertas</Label>
                <Input
                  defaultValue={selected.allergies_alert ?? ""}
                  key={`all-${selected.id}`}
                  placeholder="Ej. Piel sensible / sin mariscos"
                  onBlur={(e) =>
                    void patchCustomer(selected.id, {
                      allergies_alert: e.target.value,
                    } as Partial<Customer>)
                  }
                />
              </div>

              <div className="space-y-1">
                <Label>Notas de preferencia</Label>
                <Textarea
                  defaultValue={selected.notes ?? ""}
                  key={`notes-${selected.id}`}
                  rows={3}
                  onBlur={(e) =>
                    void patchCustomer(selected.id, {
                      notes: e.target.value,
                    } as Partial<Customer>)
                  }
                />
              </div>

              <div className="space-y-1">
                <Label>Cumpleaños</Label>
                <Input
                  type="date"
                  defaultValue={selected.birthday ?? ""}
                  key={`bday-${selected.id}`}
                  onBlur={(e) =>
                    void patchCustomer(selected.id, {
                      birthday: e.target.value || null,
                    } as Partial<Customer>)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Etiquetas</Label>
                <div className="flex flex-wrap gap-2">
                  {TAG_OPTIONS.map((tag) => {
                    const on = (selected.tags ?? []).includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          "min-h-9 rounded-lg border px-3 text-sm font-medium",
                          on
                            ? "border-brand bg-brand/10 text-brand"
                            : "border-black/10",
                        )}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Galería privada ({photos.length}/{MAX_PHOTOS})</Label>
                  <label className="cursor-pointer text-sm font-semibold text-brand">
                    Subir
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={busy || photos.length >= MAX_PHOTOS}
                      onChange={(e) => {
                        void uploadPhoto(e.target.files?.[0] ?? null);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {photos.length === 0 ? (
                  <p className="text-xs text-muted">Sin fotos aún.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((p) => (
                      <div
                        key={p.id}
                        className="relative aspect-square overflow-hidden rounded-lg bg-black/5"
                      >
                        {p.signed_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.signed_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                        <button
                          type="button"
                          className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white"
                          onClick={() => void deletePhoto(p)}
                          aria-label="Eliminar foto"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  className="min-h-11 flex-1"
                  disabled={busy}
                  onClick={() => void addVisit(selected)}
                >
                  +1 visita
                </Button>
                {(selected.visits_toward_reward ?? 0) >= goal ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11 flex-1"
                    onClick={() => setRewardOpen(selected)}
                  >
                    Canjear recompensa
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {rewardOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-background p-5 shadow-xl">
            <p className="text-lg font-semibold text-brand-dark">
              ¡Recompensa lista!
            </p>
            <p className="text-sm text-muted">
              {rewardOpen.name} completó {goal} visitas. Entrega:{" "}
              <strong>{rewardLabel}</strong>
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 flex-1"
                onClick={() => setRewardOpen(null)}
              >
                Después
              </Button>
              <Button
                type="button"
                className="min-h-11 flex-1"
                disabled={busy}
                onClick={() => void redeemReward(rewardOpen)}
              >
                Canjear ahora
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
