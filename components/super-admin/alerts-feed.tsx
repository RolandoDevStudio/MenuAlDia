"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { AppNotification } from "@/lib/notifications/types";
import { Button } from "@/components/ui/button";
import { formatMexicoCityDateTime } from "@/lib/dates";

export function AlertsFeed() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/notifications");
      const json = (await res.json()) as { notifications?: AppNotification[] };
      if (res.ok) setItems(json.notifications ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markAll() {
    await fetch("/api/super-admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    await load();
  }

  return (
    <div className="rounded-xl border border-black/5 bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Alertas</h2>
          <p className="text-xs text-muted">
            Comprobantes, altas y solicitudes recientes
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
            Actualizar
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void markAll()}>
            Marcar leídas
          </Button>
        </div>
      </div>
      {loading ? (
        <p className="text-xs text-muted">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted">Sin alertas por ahora.</p>
      ) : (
        <ul className="divide-y divide-black/5">
          {items.slice(0, 15).map((n) => (
            <li key={n.id} className="py-2">
              {n.href ? (
                <Link
                  href={n.href}
                  className="text-sm font-medium text-brand hover:underline"
                >
                  {n.title}
                </Link>
              ) : (
                <p className="text-sm font-medium">{n.title}</p>
              )}
              {n.body ? (
                <p className="text-xs text-muted">{n.body}</p>
              ) : null}
              <p className="text-[10px] text-muted">
                {formatMexicoCityDateTime(n.created_at)}
                {!n.read_at ? " · nueva" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
