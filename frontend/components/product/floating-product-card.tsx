"use client";

import { motion } from "motion/react";

import { cn } from "@/lib/cn";

type FloatingProductCardProps = {
  className?: string;
  eyebrow: string;
  metric?: string;
  title: string;
  tone?: "lavender" | "mint" | "peach";
};

const tones = {
  lavender: "bg-lavender/90",
  mint: "bg-mint/90",
  peach: "bg-peach/90",
};

export function FloatingProductCard({
  className,
  eyebrow,
  metric,
  title,
  tone = "lavender",
}: FloatingProductCardProps) {
  return (
    <motion.div
      className={cn(
        "w-48 rounded-[1.35rem] border border-white/80 p-4 shadow-card backdrop-blur-md",
        tones[tone],
        className,
      )}
      whileHover={{ y: -5, rotate: -0.5 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-muted">{eyebrow}</p>
      <p className="mt-2 text-sm font-semibold leading-snug text-ink">{title}</p>
      {metric && <p className="mt-3 text-2xl font-bold tracking-tight text-violet-ink">{metric}</p>}
    </motion.div>
  );
}
