"use client";

import { useEffect, useRef, useState } from "react";
import type { Dish, Restaurant } from "@/lib/types";
import { FlyerCanvas } from "@/components/flyer/flyer-canvas";
import {
  FLYER_ASPECT_SIZE,
  type FlyerEditorOptions,
} from "@/lib/flyer-types";

type Props = {
  restaurant: Restaurant;
  dishes: Dish[];
  sides: Dish[];
  packagePrice: number;
  options: FlyerEditorOptions;
  sidesTitle?: string;
};

export function FlyerPreview({
  restaurant,
  dishes,
  sides,
  packagePrice,
  options,
  sidesTitle,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const { w, h } = FLYER_ASPECT_SIZE[options.aspect];

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      setScale(Math.min(1, el.clientWidth / w));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);

  const previewHeight = h * scale;

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
          options={options}
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
              width: w,
              transform: `scale(${scale})`,
            }}
          >
            <FlyerCanvas
              restaurant={restaurant}
              dishes={dishes}
              sides={sides}
              packagePrice={packagePrice}
              options={options}
              sidesTitle={sidesTitle}
              id="flyer-preview"
            />
          </div>
        </div>
      </div>
    </>
  );
}
