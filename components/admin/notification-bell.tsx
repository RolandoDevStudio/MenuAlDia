"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/lib/notifications/types";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [pushHint, setPushHint] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications");
      const json = (await res.json()) as {
        notifications?: AppNotification[];
        unread?: number;
      };
      if (res.ok) {
        setItems(json.notifications ?? []);
        setUnread(json.unread ?? 0);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("mad-push-hint-dismissed") === "1") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission === "default") setPushHint(true);
  }, []);

  async function markRead(id?: string) {
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : { all: true }),
    });
    await load();
  }

  async function enablePush() {
    setBusy(true);
    try {
      const keyRes = await fetch("/api/admin/push-subscribe");
      const keyJson = (await keyRes.json()) as { publicKey?: string | null };
      if (!keyJson.publicKey) {
        setPushHint(false);
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyJson.publicKey),
      });
      await fetch("/api/admin/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      localStorage.setItem("mad-push-hint-dismissed", "1");
      setPushHint(false);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Notificaciones"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-0.5 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 z-40 mt-1 w-[min(100vw-2rem,20rem)] rounded-xl border border-black/10 bg-background shadow-lg">
          <div className="flex items-center justify-between border-b border-black/5 px-3 py-2">
            <p className="text-sm font-semibold">Notificaciones</p>
            {unread > 0 ? (
              <button
                type="button"
                className="text-[11px] font-medium text-brand"
                onClick={() => void markRead()}
              >
                Marcar leídas
              </button>
            ) : null}
          </div>
          {pushHint ? (
            <div className="border-b border-black/5 bg-brand/5 px-3 py-2 text-[11px]">
              <p className="text-muted">Activa alertas del navegador.</p>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  className="font-semibold text-brand"
                  disabled={busy}
                  onClick={() => void enablePush()}
                >
                  Activar
                </button>
                <button
                  type="button"
                  className="text-muted"
                  onClick={() => {
                    localStorage.setItem("mad-push-hint-dismissed", "1");
                    setPushHint(false);
                  }}
                >
                  Ahora no
                </button>
              </div>
            </div>
          ) : null}
          <ul className="max-h-72 overflow-auto">
            {items.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-muted">
                Sin notificaciones
              </li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href || "/admin"}
                    className={cn(
                      "block px-3 py-2.5 text-left hover:bg-surface",
                      !n.read_at && "bg-brand/5",
                    )}
                    onClick={() => {
                      setOpen(false);
                      if (!n.read_at) void markRead(n.id);
                    }}
                  >
                    <p className="text-xs font-semibold">{n.title}</p>
                    {n.body ? (
                      <p className="mt-0.5 text-[11px] text-muted line-clamp-2">
                        {n.body}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-[10px] text-muted">
                      {new Date(n.created_at).toLocaleString("es-MX")}
                    </p>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
