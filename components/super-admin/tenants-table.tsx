"use client";

import { useMemo, useState } from "react";
import {
  Award,
  ExternalLink,
  Mail,
  MessageCircle,
  Pencil,
  Sparkles,
  StickyNote,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import type { BusinessType, Restaurant } from "@/lib/types";
import type { PlanType } from "@/lib/plans";
import { PLAN_LABELS } from "@/lib/plans";
import { BUSINESS_TYPE_LABELS } from "@/lib/business-labels";
import { formatSalesWhatsAppDisplay } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { RemindPaymentButton } from "@/components/super-admin/remind-payment-button";
import { cn } from "@/lib/utils";

const PLAN_SHORT: Record<PlanType, string> = {
  catalog: "Catálogo",
  daily: "Diario",
  pro: "Pro",
};

const GIRO_ICON = {
  restaurante: UtensilsCrossed,
  servicios: Sparkles,
  productos: Store,
} as const;

function hasInternalNotes(r: Restaurant) {
  return Boolean(r.internal_notes?.trim());
}

function expiryMeta(iso: string | null | undefined) {
  if (!iso) return { label: "—", tone: "muted" as const };
  const end = new Date(iso);
  const label = end.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
  const days = Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return { label, tone: "danger" as const };
  if (days <= 7) return { label, tone: "warn" as const };
  return { label, tone: "ok" as const };
}

function giroOf(r: Restaurant): BusinessType {
  return (r.business_type || "restaurante") as BusinessType;
}

function FounderMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950",
        className,
      )}
      title="Socio fundador"
    >
      <Award className="h-3 w-3" aria-hidden />
      Fundador
    </span>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold",
        active ? "text-accent" : "text-red-600",
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          active ? "bg-accent" : "bg-red-500",
        )}
        aria-hidden
      />
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

export type OwnerInfo = { user_id: string; email: string | null; role: string };

type SortKey =
  | "name"
  | "plan"
  | "business_type"
  | "is_active"
  | "subscription_end_date";

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
        case "plan":
          av = a.plan_type || "catalog";
          bv = b.plan_type || "catalog";
          break;
        case "business_type":
          av = giroOf(a);
          bv = giroOf(b);
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
      }
      return cmp(av, bv) * dir;
    });
    return list;
  }, [restaurants, sortKey, sortDir]);

  const header = (key: SortKey, label: string, className?: string) => (
    <th
      className={cn(
        "whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold",
        className,
      )}
    >
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

  function ContactLinks({ r }: { r: Restaurant }) {
    const email = owners[r.id]?.email;
    const phone = r.phone_whatsapp?.trim();
    const digits = phone ? phone.replace(/\D/g, "") : "";
    return (
      <div className="flex items-center gap-1">
        {digits ? (
          <a
            href={`https://wa.me/${digits}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#128C7E] hover:bg-black/5"
            title={`WhatsApp ${formatSalesWhatsAppDisplay(phone!)}`}
            aria-label="WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        ) : (
          <span className="inline-flex h-9 w-9 items-center justify-center text-muted/40">
            <MessageCircle className="h-4 w-4" />
          </span>
        )}
        {email ? (
          <a
            href={`mailto:${email}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-black/5 hover:text-foreground"
            title={email}
            aria-label="Email"
          >
            <Mail className="h-4 w-4" />
          </a>
        ) : (
          <span className="inline-flex h-9 w-9 items-center justify-center text-muted/40">
            <Mail className="h-4 w-4" />
          </span>
        )}
      </div>
    );
  }

  function Identity({
    r,
    showEmail = true,
  }: {
    r: Restaurant;
    showEmail?: boolean;
  }) {
    const email = owners[r.id]?.email;
    return (
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate font-semibold text-foreground">{r.name}</p>
          {r.is_founding_partner ? <FounderMark /> : null}
          {hasInternalNotes(r) ? (
            <StickyNote
              className="h-3.5 w-3.5 shrink-0 text-muted"
              aria-label="Tiene notas internas"
            />
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted">
          {r.owner_name || "Sin dueño"}
          <span className="text-muted/50"> · </span>
          <span className="font-mono">/{r.slug}</span>
          {showEmail && email ? (
            <>
              <span className="text-muted/50"> · </span>
              <span>{email}</span>
            </>
          ) : null}
        </p>
      </div>
    );
  }

  function PlanChip({ plan }: { plan: PlanType }) {
    return (
      <span
        className="inline-flex rounded-md bg-brand/10 px-1.5 py-0.5 text-[11px] font-semibold text-brand-dark"
        title={PLAN_LABELS[plan]}
      >
        {PLAN_SHORT[plan] ?? plan}
      </span>
    );
  }

  function GiroMark({ giro }: { giro: BusinessType }) {
    const Icon = GIRO_ICON[giro] ?? Store;
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-foreground"
        title={BUSINESS_TYPE_LABELS[giro]}
      >
        <Icon className="h-3.5 w-3.5 text-muted" aria-hidden />
        {BUSINESS_TYPE_LABELS[giro] ?? giro}
      </span>
    );
  }

  return (
    <div className="w-full min-w-0">
      <ul className="space-y-3 lg:hidden">
        {sorted.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-muted">
            No hay tenants con esos filtros.
          </li>
        ) : (
          sorted.map((r) => {
            const plan = (r.plan_type || "catalog") as PlanType;
            const giro = giroOf(r);
            const exp = expiryMeta(r.subscription_end_date);
            const active = r.is_active !== false;
            return (
              <li
                key={r.id}
                className="rounded-2xl border border-black/10 bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <Identity r={r} showEmail={false} />
                  <StatusDot active={active} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <PlanChip plan={plan} />
                  <GiroMark giro={giro} />
                  <span
                    className={cn(
                      "text-xs font-medium",
                      exp.tone === "danger" && "text-red-600",
                      exp.tone === "warn" && "text-amber-700",
                      exp.tone === "ok" && "text-muted",
                      exp.tone === "muted" && "text-muted",
                    )}
                  >
                    Vence {exp.label}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/5 pt-3">
                  <ContactLinks r={r} />
                  <div className="flex items-center gap-1.5">
                    <Button asChild size="sm" variant="outline" className="min-h-10 w-10 px-0">
                      <a
                        href={`/${r.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ver menú público"
                        aria-label="Ver menú público"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <RemindPaymentButton restaurant={r} compact />
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-10"
                      onClick={() => onEdit(r)}
                    >
                      Editar
                    </Button>
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>

      <div className="hidden w-full min-w-0 overflow-x-auto rounded-2xl border border-black/10 bg-surface lg:block">
        <table className="w-full text-sm">
          <thead className="border-b border-black/10 text-muted">
            <tr>
              {header("name", "Negocio")}
              {header("plan", "Plan")}
              {header("business_type", "Giro")}
              {header("is_active", "Estado")}
              {header("subscription_end_date", "Vence")}
              <th className="px-3 py-2.5 text-left text-xs font-semibold">
                Contacto
              </th>
              <th className="sticky right-0 bg-surface px-3 py-2.5 text-right text-xs font-semibold shadow-[-6px_0_8px_rgba(0,0,0,0.04)]">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-sm text-muted"
                >
                  No hay tenants con esos filtros.
                </td>
              </tr>
            ) : (
              sorted.map((r) => {
                const plan = (r.plan_type || "catalog") as PlanType;
                const giro = giroOf(r);
                const exp = expiryMeta(r.subscription_end_date);
                const active = r.is_active !== false;
                return (
                  <tr
                    key={r.id}
                    className="border-t border-black/5 hover:bg-black/[0.02]"
                  >
                    <td className="max-w-[18rem] px-3 py-3">
                      <Identity r={r} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <PlanChip plan={plan} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <GiroMark giro={giro} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <StatusDot active={active} />
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-3 py-3 text-xs font-medium",
                        exp.tone === "danger" && "text-red-600",
                        exp.tone === "warn" && "text-amber-700",
                        exp.tone === "ok" && "text-foreground",
                        exp.tone === "muted" && "text-muted",
                      )}
                    >
                      {exp.label}
                    </td>
                    <td className="px-3 py-3">
                      <ContactLinks r={r} />
                    </td>
                    <td className="sticky right-0 bg-surface px-3 py-3 shadow-[-6px_0_8px_rgba(0,0,0,0.04)]">
                      <div className="flex justify-end gap-1">
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="min-h-10 w-10 px-0"
                        >
                          <a
                            href={`/${r.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Ver menú público"
                            aria-label="Ver menú público"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <RemindPaymentButton restaurant={r} compact />
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="min-h-10 gap-1.5"
                          onClick={() => onEdit(r)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          Editar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
