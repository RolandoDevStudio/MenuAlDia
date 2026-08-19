"use client";

import { useEffect, useRef, useState } from "react";
import type { Dish, Restaurant } from "@/lib/types";
import { FlyerCanvas } from "@/components/flyer/flyer-canvas";

type Props = {
  restaurant: Restaurant;
  dishes: Dish[];
  sides: Dish[];
  packagePrice: number;
  headline?: string;
  sidesTitle?: string;
};

export function FlyerPreview({
  restaurant,
  dishes,
  sides,
  packagePrice,
  headline,
  sidesTitle,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      setScale(Math.min(1, w / 1080));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const previewHeight = 1350 * scale;

  return (
    <>
      <div
        className="pointer-events-none fixed left-[-10000px] top-0"
        aria-hidden
      >
        <FlyerCanvas
          restaurant={restaurant}
          dishes={dishes}
          sides={sides}
          packagePrice={packagePrice}
          headline={headline}
          sidesTitle={sidesTitle}
        />
      </div>

      <div
        ref={containerRef}
        className="overflow-hidden rounded-xl border border-black/10 bg-black/5 p-2"
      >
        <div style={{ height: previewHeight }} className="relative w-full">
          <div
            className="origin-top-left"
            style={{
              width: 1080,
              transform: `scale(${scale})`,
            }}
          >
            <FlyerCanvas
              restaurant={restaurant}
              dishes={dishes}
              sides={sides}
              packagePrice={packagePrice}
              headline={headline}
              sidesTitle={sidesTitle}
              id="flyer-preview"
            />
          </div>
        </div>
      </div>
    </>
  );
}
