"use client";

import { useEffect, useRef } from "react";

/** Fire-and-forget once per mount when the public menu loads. */
export function MenuViewBeacon({ restaurantId }: { restaurantId: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current || !restaurantId) return;
    sent.current = true;
    void fetch("/api/public/menu-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurant_id: restaurantId }),
      keepalive: true,
    }).catch(() => {});
  }, [restaurantId]);

  return null;
}
