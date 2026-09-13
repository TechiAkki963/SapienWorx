"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

type OrganicPortraitProps = {
  alt: string;
  className?: string;
  src: string;
  shape?: "blob-a" | "blob-b" | "blob-c";
  frame?: "clay" | "indigo" | "none";
  priority?: boolean;
};

const masks = {
  "blob-a": "organic-mask-a",
  "blob-b": "organic-mask-b",
  "blob-c": "organic-mask-c",
};

const frames = {
  clay: "bg-clay/70",
  indigo: "bg-indigo-soft",
  none: "hidden",
};

export function OrganicPortrait({ alt, className, src, shape = "blob-a", frame = "clay", priority = false }: OrganicPortraitProps) {
  const mask = masks[shape];
  return (
    <motion.figure
      className={cn("relative aspect-[4/5]", className)}
      initial={false}
      whileInView={{ scale: 1.012 }}
      viewport={{ once: false, amount: 0.35 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div aria-hidden="true" className={cn("absolute inset-0 translate-x-2 translate-y-2", mask, frames[frame])} />
      <div className={cn("relative h-full w-full overflow-hidden bg-stone shadow-float", mask)}>
        <Image alt={alt} className="object-cover" fill priority={priority} sizes="(max-width: 768px) 82vw, 38vw" src={src} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/10 via-transparent to-white/10" />
      </div>
    </motion.figure>
  );
}
