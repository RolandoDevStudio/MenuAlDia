"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#beneficios", label: "Beneficios" },
  { href: "#demos", label: "Demos" },
  { href: "#precios", label: "Precios" },
  { href: "#contacto", label: "Contacto" },
] as const;

type Props = {
  onContactClick?: () => void;
};

export function LandingNav({ onContactClick }: Props) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function go(href: string) {
    setOpen(false);
    if (href === "#contacto" && onContactClick) {
      onContactClick();
      return;
    }
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-background/90 backdrop-blur transition-[border-color,box-shadow] duration-300",
        scrolled
          ? "border-black/10 shadow-sm shadow-black/5"
          : "border-black/5 shadow-none",
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <BrandLogo variant="lockup" size="sm" href="/" />

        <nav className="hidden items-center gap-6 text-sm font-semibold md:flex">
          {LINKS.map((l) => (
            <button
              key={l.href}
              type="button"
              className="text-muted transition-colors duration-200 hover:text-brand"
              onClick={() => go(l.href)}
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/login">Entrar</Link>
          </Button>
          <Button
            size="sm"
            className="landing-cta"
            onClick={() => go("#contacto")}
          >
            Hablar por WhatsApp
          </Button>
        </div>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-black/5 md:hidden"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={cn(
          "grid overflow-hidden border-black/5 bg-background transition-[grid-template-rows,opacity,border-width] duration-300 ease-out md:hidden",
          open
            ? "grid-rows-[1fr] border-t opacity-100"
            : "grid-rows-[0fr] border-t-0 opacity-0",
        )}
      >
        <div className="min-h-0">
          <nav className="flex flex-col gap-1 px-4 py-3">
            {LINKS.map((l) => (
              <button
                key={l.href}
                type="button"
                className="rounded-lg px-3 py-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-black/5"
                onClick={() => go(l.href)}
              >
                {l.label}
              </button>
            ))}
            <Link
              href="/admin/login"
              className="rounded-lg px-3 py-3 text-sm font-semibold text-muted transition-colors hover:bg-black/5"
              onClick={() => setOpen(false)}
            >
              Entrar al admin
            </Link>
            <Button
              className="mt-2 w-full landing-cta"
              onClick={() => go("#contacto")}
            >
              Hablar por WhatsApp
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
}
