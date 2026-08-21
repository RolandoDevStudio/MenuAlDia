/* MenuAlDía Admin — registered only from /admin (not public pages) */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {
    title: "MenuAlDía",
    body: "Tienes una nueva notificación",
    href: "/admin",
  };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "MenuAlDía", {
      body: data.body || "",
      icon: "/brand/menualdia-icon.svg",
      badge: "/brand/menualdia-mark.svg",
      data: { href: data.href || "/admin" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw =
    (event.notification.data && event.notification.data.href) || "/admin";
  let target = "/admin";
  try {
    target = new URL(raw, self.location.origin).pathname +
      new URL(raw, self.location.origin).search;
    if (!target.startsWith("/admin")) {
      target = "/admin";
    }
  } catch {
    target = "/admin";
  }
  const absolute = new URL(target, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of all) {
        if ("focus" in client) {
          try {
            if ("navigate" in client && typeof client.navigate === "function") {
              await client.navigate(absolute);
            }
            return client.focus();
          } catch {
            try {
              return client.focus();
            } catch {
              /* continue */
            }
          }
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(absolute);
      }
    })(),
  );
});
