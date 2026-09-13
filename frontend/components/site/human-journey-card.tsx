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
      initial={{ opacity: 0, y: 34 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.24 }}
      transition={{ duration: 0.62, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className={cn("relative aspect-[1.06/1] overflow-hidden rounded-[1.65rem] shadow-[0_14px_40px_rgb(16_44_86_/_0.08)]", toneClasses[tone])}
        whileHover={{ y: -5 }}
        transition={{ duration: 0.25 }}
      >
        <motion.img
          src={image}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          initial={{ scale: 1.075 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: delay + 0.04, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#071d49]/30 to-transparent" aria-hidden="true" />
        <motion.span
          className="absolute bottom-4 left-4 rounded-full border border-white/80 bg-white/94 px-4 py-2 text-xs font-bold text-navy shadow-card backdrop-blur"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.42, delay: delay + 0.28 }}
        >
          {eyebrow}
        </motion.span>
      </motion.div>

      <div className="px-1 pt-5">
        <h3 className="font-serif text-[1.9rem] font-semibold leading-none tracking-[-0.035em] text-navy">{title}</h3>
        <p className="mt-3 max-w-sm text-[15px] leading-6 text-ink-muted">{body}</p>
      </div>
    </motion.article>
  );
}
