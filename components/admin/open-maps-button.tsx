"use client";

import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  url: string;
  className?: string;
};

export function OpenMapsButton({ url, className }: Props) {
  if (!url?.trim()) return null;
  const href = url.trim();

  return (
    <Button asChild size="sm" variant="secondary" className={className}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <MapPin className="h-4 w-4" />
        Abrir en Maps
      </a>
    </Button>
  );
}
