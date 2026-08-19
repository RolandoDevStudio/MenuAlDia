"use client";

import { useState } from "react";
import type { Restaurant } from "@/lib/types";
import { formatMxn } from "@/lib/money";
import { MapPin, Clock, Truck, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function RestaurantHeader({
  restaurant,
  placeLine,
}: {
  restaurant: Restaurant;
  placeLine?: string;
}) {
  const [open, setOpen] = useState(false);
  const shippingLabel =
    restaurant.free_shipping || Number(restaurant.shipping_cost) === 0
      ? "Envío gratis"
      : `Envío ${formatMxn(Number(restaurant.shipping_cost))}`;
  const place =
    placeLine ||
    [restaurant.city, restaurant.state].filter(Boolean).join(", ");

  return (
    <header className="border-b border-black/5 bg-surface/80 px-4 py-5 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-start gap-3">
        {restaurant.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurant.logo_url}
            alt={restaurant.name}
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 font-[family-name:var(--font-display)] text-xl text-brand">
            {restaurant.name.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-[family-name:var(--font-display)] text-3xl leading-none text-brand">
            {restaurant.name}
          </h1>
          <p className="mt-1 text-sm font-medium text-brand-dark">
            {restaurant.slogan || "Sabor casero"}
          </p>
          {place ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {place}
            </p>
          ) : null}
          <button
            type="button"
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-muted"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            Más info
            <ChevronDown
              className={cn("h-4 w-4 transition", open && "rotate-180")}
            />
          </button>
          {open ? (
            <div className="mt-2 space-y-1.5 text-xs text-muted">
              {restaurant.schedule_text ? (
                <p className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  {restaurant.schedule_text}
                </p>
              ) : null}
              {restaurant.address ? (
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
              <p className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 shrink-0" />
                {shippingLabel}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted">{shippingLabel}</p>
          )}
        </div>
      </div>
    </header>
  );
}
