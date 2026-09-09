"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, MessageCircle, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#beneficios", label: "Beneficios" },
  { href: "#ia", label: "IA" },
  { href: "#comparar", label: "Comparar" },
  { href: "#demo-stage", label: "Demos" },
  { href: "#precios", label: "Precios" },
  { href: "#contacto", label: "Contacto" },
] as const;

type Props = {
  onContactClick?: () => void;
  onWhatsAppClick?: () => void;
  whatsAppLabel?: string;
};

export function LandingNav({
  onContactClick,
  onWhatsAppClick,
  whatsAppLabel = "Hablar por WhatsApp",
}: Props) {
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
    el?.scrollIntoView({
      behavior: "smooth",
      block: href === "#demo-stage" ? "center" : "start",
    });
  }

  function openWhatsApp() {
    setOpen(false);
    onWhatsAppClick?.();
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
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
        <BrandLogo variant="lockup" size="sm" href="/" className="min-w-0" />

        {/* Full link row only when there's room (avoids crushing the WA CTA) */}
        <nav className="hidden items-center gap-4 text-sm font-semibold lg:flex xl:gap-5">
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

        <div className="hidden items-center gap-2 lg:flex">
          <Button asChild variant="ghost" size="sm" className="px-2.5">
            <Link href="/admin/login">Entrar</Link>
          </Button>
          <Button
            type="button"
            size="sm"
            className="landing-cta h-10 gap-1.5 px-3.5 text-sm"
            onClick={openWhatsApp}
          >
            <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
            <span className="xl:hidden">WhatsApp</span>
            <span className="hidden xl:inline">{whatsAppLabel}</span>
          </Button>
        </div>

        {/* Tablet: WhatsApp without crowding the logo */}
        <div className="hidden items-center gap-1.5 md:flex lg:hidden">
          <Button
            type="button"
            size="sm"
            className="landing-cta h-10 gap-1.5 px-3 text-sm"
            onClick={openWhatsApp}
          >
            <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
            WhatsApp
          </Button>
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-black/5"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>

        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-black/5 md:hidden"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      <div
        className={cn(
          "grid overflow-hidden border-black/5 bg-background transition-[grid-template-rows,opacity,border-width] duration-300 ease-out lg:hidden",
          open
            ? "grid-rows-[1fr] border-t opacity-100"
            : "grid-rows-[0fr] border-t-0 opacity-0",
        )}
      >
        <div className="min-h-0">
          <nav className="flex flex-col gap-1 px-4 py-3 pb-4">
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
              type="button"
              className="landing-cta mt-2 min-h-11 w-full gap-2"
              onClick={openWhatsApp}
            >
              <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
              {whatsAppLabel}
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
}
