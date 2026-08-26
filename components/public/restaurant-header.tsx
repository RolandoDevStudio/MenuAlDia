"use client";

import { useState } from "react";
import type { Restaurant } from "@/lib/types";
import { formatPlaceLine } from "@/lib/mx-locations";
import { normalizeBusinessType } from "@/lib/business-labels";
import {
  offersPublicDelivery,
  offersPublicVenue,
  publicFulfillmentHint,
} from "@/lib/fulfillment";
import {
  MapPin,
  Clock,
  Truck,
  ChevronDown,
  Navigation,
  HelpCircle,
} from "lucide-react";
import { StorageImage } from "@/components/ui/storage-image";
import { cn } from "@/lib/utils";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2 6.34 6.34 0 0 0 9.49 21.5a6.34 6.34 0 0 0 6.34-6.34V8.83a8.19 8.19 0 0 0 4.76 1.52V6.9a4.85 4.85 0 0 1-.99-.21z" />
    </svg>
  );
}

export function RestaurantHeader({
  restaurant,
  placeLine,
  hasFaqs = false,
}: {
  restaurant: Restaurant;
  placeLine?: string | null;
  hasFaqs?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const shippingLabel = publicFulfillmentHint(restaurant);
  const showVenue = offersPublicVenue(restaurant);
  const showDelivery = offersPublicDelivery(restaurant);
  const place =
    placeLine ||
    formatPlaceLine(restaurant.city, restaurant.state);

  const socials = [
    restaurant.instagram_url
      ? { href: restaurant.instagram_url, label: "Instagram", Icon: InstagramIcon }
      : null,
    restaurant.facebook_url
      ? { href: restaurant.facebook_url, label: "Facebook", Icon: FacebookIcon }
      : null,
    restaurant.tiktok_url
      ? { href: restaurant.tiktok_url, label: "TikTok", Icon: TikTokIcon }
      : null,
  ].filter(Boolean) as {
    href: string;
    label: string;
    Icon: typeof InstagramIcon;
  }[];

  const sloganFallback =
    normalizeBusinessType(restaurant.business_type) === "servicios"
      ? "Agenda y reserva fácil"
      : normalizeBusinessType(restaurant.business_type) === "productos"
        ? "Catálogo al día"
        : "Sabor casero";
  const showShippingChip =
    showDelivery &&
    (restaurant.free_shipping || Number(restaurant.shipping_cost) === 0);

  const chipClass =
    "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-black/10 bg-white/90 px-3 py-1.5 text-xs font-semibold text-brand shadow-sm";

  return (
    <header className="border-b border-black/5 bg-surface/80 px-4 py-5 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-start gap-3">
        {restaurant.logo_url ? (
          <StorageImage
            src={restaurant.logo_url}
            alt={restaurant.name}
            width={80}
            height={80}
            sizes="80px"
            className="h-20 w-20 rounded-full"
            priority
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand/10 font-[family-name:var(--font-display)] text-2xl text-brand">
            {restaurant.name.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-[family-name:var(--font-display)] text-3xl leading-none text-brand">
            {restaurant.name}
          </h1>
          <p className="mt-1 text-sm font-medium text-brand-dark">
            {restaurant.slogan || sloganFallback}
          </p>
          {place ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {place}
            </p>
          ) : null}

          {socials.length > 0 || hasFaqs ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {socials.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-brand/10 text-brand transition hover:bg-brand/15"
                  aria-label={label}
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
              {hasFaqs ? (
                <a
                  href="#faqs"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-brand/10 text-brand transition hover:bg-brand/15"
                  aria-label="Preguntas frecuentes"
                >
                  <HelpCircle className="h-5 w-5" />
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {showVenue && restaurant.maps_url ? (
              <a
                href={restaurant.maps_url}
                target="_blank"
                rel="noreferrer"
                className={chipClass}
              >
                <Navigation className="h-3.5 w-3.5" aria-hidden />
                Cómo llegar
              </a>
            ) : null}
            <button
              type="button"
              className={cn(chipClass, "text-muted")}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              Más info
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition", open && "rotate-180")}
              />
            </button>
            {showShippingChip ? (
              <span className={cn(chipClass, "border-accent/20 text-accent")}>
                <Truck className="h-3.5 w-3.5" aria-hidden />
                Envío gratis
              </span>
            ) : null}
          </div>

          {open ? (
            <div className="mt-3 space-y-1.5 rounded-xl border border-black/5 bg-background/60 px-3 py-2.5 text-xs text-muted">
              {restaurant.schedule_text ? (
                <p className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  {restaurant.schedule_text}
                </p>
              ) : null}
              {showVenue && restaurant.address ? (
                <p className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {restaurant.maps_url ? (
                    <a
                      href={restaurant.maps_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline-offset-2 hover:underline"
                    >
                      {restaurant.address}
                    </a>
                  ) : (
                    restaurant.address
                  )}
                </p>
              ) : null}
              {showDelivery ? (
                <p className="flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 shrink-0" />
                  {shippingLabel}
                </p>
              ) : null}
              {socials.length > 0 ? (
                <div className="flex flex-wrap gap-3 pt-1">
                  {socials.map(({ href, label }) => (
                    <a
                      key={`info-${label}`}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-brand underline-offset-2 hover:underline"
                    >
                      {label}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
