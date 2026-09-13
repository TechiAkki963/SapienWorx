"use client";

import { motion } from "motion/react";

import { cn } from "@/lib/cn";

type HumanJourneyCardProps = {
  title: string;
  body: string;
  image: string;
  alt: string;
  eyebrow: string;
  delay?: number;
  tone?: "blue" | "mint" | "peach";
};

const toneClasses = {
  blue: "bg-[#eef6ff]",
  mint: "bg-[#eefaf5]",
  peach: "bg-[#fff5ef]",
};

export function HumanJourneyCard({
  title,
  body,
  image,
  alt,
  eyebrow,
  delay = 0,
  tone = "blue",
}: HumanJourneyCardProps) {
  return (
    <motion.article
      className="group"
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.28 }}
      transition={{ duration: 0.58, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className={cn("relative aspect-[4/3] overflow-hidden rounded-[2rem]", toneClasses[tone])}
        whileHover={{ y: -4 }}
        transition={{ duration: 0.25 }}
      >
        <motion.img
          src={image}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          initial={{ scale: 1.06 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: delay + 0.05, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#061b3a]/30 to-transparent" aria-hidden="true" />
        <motion.span
          className="absolute bottom-4 left-4 rounded-full border border-white/70 bg-white/92 px-4 py-2 text-xs font-bold text-navy shadow-sm backdrop-blur"
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: delay + 0.28 }}
        >
          {eyebrow}
        </motion.span>
      </motion.div>
      <div className="px-1 pt-5">
        <h3 className="text-2xl font-bold tracking-[-0.035em] text-navy">{title}</h3>
        <p className="mt-2 max-w-sm text-sm leading-6 text-ink-muted">{body}</p>
      </div>
    </motion.article>
  );
}
