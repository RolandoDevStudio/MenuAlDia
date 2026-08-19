"use client";

import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

type Base = {
  src: string | null | undefined;
  alt: string;
  sizes: string;
  quality?: number;
  className?: string;
  priority?: boolean;
};

type FillProps = Base & {
  fill: true;
  width?: never;
  height?: never;
};

type FixedProps = Base & {
  fill?: false;
  width: number;
  height: number;
};

export type StorageImageProps = FillProps | FixedProps;

/**
 * Next Image wrapper for Supabase Storage URLs.
 * Default quality=80 to keep the image optimizer light.
 */
export function StorageImage(props: StorageImageProps) {
  const {
    src,
    alt,
    sizes,
    quality = 80,
    className,
    priority,
  } = props;

  if (!src) return null;

  const common: Pick<
    ImageProps,
    "src" | "alt" | "sizes" | "quality" | "className" | "priority"
  > = {
    src,
    alt,
    sizes,
    quality,
    className: cn("object-cover", className),
    priority,
  };

  if (props.fill) {
    return <Image {...common} fill />;
  }

  return (
    <Image {...common} width={props.width} height={props.height} />
  );
}
