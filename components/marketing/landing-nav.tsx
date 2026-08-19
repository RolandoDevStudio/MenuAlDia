"use client";

import { useState } from "react";
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
    <header className="sticky top-0 z-40 border-b border-black/5 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <BrandLogo variant="lockup" size="sm" href="/" />

        <nav className="hidden items-center gap-6 text-sm font-semibold md:flex">
          {LINKS.map((l) => (
            <button
              key={l.href}
              type="button"
              className="text-muted hover:text-brand"
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
          <Button size="sm" onClick={() => go("#contacto")}>
            Hablar por WhatsApp
          </Button>
        </div>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-black/5 md:hidden"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={cn(
          "border-t border-black/5 bg-background px-4 py-3 md:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav className="flex flex-col gap-1">
          {LINKS.map((l) => (
            <button
              key={l.href}
              type="button"
              className="rounded-lg px-3 py-3 text-left text-sm font-semibold text-foreground hover:bg-black/5"
              onClick={() => go(l.href)}
            >
              {l.label}
            </button>
          ))}
          <Link
            href="/admin/login"
            className="rounded-lg px-3 py-3 text-sm font-semibold text-muted hover:bg-black/5"
            onClick={() => setOpen(false)}
          >
            Entrar al admin
          </Link>
          <Button className="mt-2 w-full" onClick={() => go("#contacto")}>
            Hablar por WhatsApp
          </Button>
        </nav>
      </div>
    </header>
  );
}
