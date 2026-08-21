"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "mad-pwa-install-dismissed";

export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [hidden, setHidden] = useState(true);
  const [iosTip, setIosTip] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      Boolean(window.navigator.standalone);
    if (standalone) {
      setHidden(true);
      return;
    }
    if (localStorage.getItem(DISMISS_KEY) === "1") {
      setHidden(true);
      return;
    }

    const isIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !("MSStream" in window);
    if (isIos) {
      setIosTip(true);
      setHidden(false);
      return;
    }

    function onBip(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    }
    window.addEventListener("beforeinstallprompt", onBip);
    setHidden(false);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (hidden) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
    setHidden(true);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  }

  return (
    <div className="mt-2 flex items-start gap-2 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2 text-xs">
      <Download className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">
          Instala la app en tu teléfono
        </p>
        <p className="mt-0.5 text-muted">
          {iosTip
            ? "En Safari: Compartir → Añadir a pantalla de inicio."
            : "Acceso rápido al panel, como una app nativa."}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {deferred ? (
            <Button type="button" size="sm" className="h-8" onClick={() => void install()}>
              Instalar
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={dismiss}
          >
            Ahora no
          </Button>
        </div>
      </div>
    </div>
  );
}
