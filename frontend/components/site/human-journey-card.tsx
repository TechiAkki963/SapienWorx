"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";

import { cn } from "@/lib/cn";

type HumanJourneyCardProps = {
  title: string;
  body: string;
  image: string;
  alt: string;
  eyebrow: string;
  href: string;
  action: string;
  delay?: number;
  tone?: "blue" | "mint" | "peach";
};

const toneClasses = {
  blue: "bg-[#eef6ff]",
  mint: "bg-[#eefaf5]",
  peach: "bg-[#fff5ef]",
};

export function HumanJourneyCard({
  title, body, image, alt, eyebrow, href, action, delay = 0, tone = "blue",
}: HumanJourneyCardProps) {
  return (
    <motion.article
      className="group h-full"
      initial={{ opacity: 1, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
    >
      <Link href={href} className="flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-line/70 bg-white shadow-[0_12px_32px_rgb(16_44_86_/_0.065)] transition hover:-translate-y-1 hover:shadow-card focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo">
        <div className={cn("relative aspect-[2.3/1] overflow-hidden sm:aspect-[1.55/1]", toneClasses[tone])}>
          <Image src={image} alt={alt} fill sizes="(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 33vw" className="object-cover object-center transition duration-300 group-hover:scale-[1.025]" />
        </div>
        <div className="flex flex-1 flex-col px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-indigo">{eyebrow}</span>
          <h3 className="mt-2 font-serif text-[1.9rem] font-semibold leading-none tracking-[-0.035em] text-navy">{title}</h3>
          <p className="mt-3 text-sm leading-6 text-ink-muted">{body}</p>
          <span className="mt-auto inline-flex items-center pt-5 text-sm font-bold text-indigo">{action} <span aria-hidden="true" className="ml-1.5">→</span></span>
        </div>
      </Link>
    </motion.article>
  );
}
