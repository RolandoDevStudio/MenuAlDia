"use client";

import { useEffect } from "react";

/** Registers the admin Service Worker only under /admin. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (!window.location.pathname.startsWith("/admin")) return;
    if (window.location.pathname.startsWith("/admin/login")) return;

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/admin" })
      .catch(() => {
        /* ignore — installability still works via manifest on some browsers */
      });
  }, []);

  return null;
}
