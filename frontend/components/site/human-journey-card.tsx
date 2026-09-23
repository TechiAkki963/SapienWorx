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

function JourneyIcon({ title }: { title: string }) {
  if (title === "Discover") {
    return <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4M8.5 11h5M11 8.5v5" /></svg>;
  }
  if (title === "Grow") {
    return <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]" aria-hidden="true"><path d="M5 19V9M10 19V5M15 19v-7M20 19V3" /></svg>;
  }
  return <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></svg>;
}

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
      <Link
        href={href}
        aria-label={`${title}: ${action}`}
        className="flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-line/70 bg-white shadow-[0_12px_32px_rgb(16_44_86_/_0.065)] transition duration-200 hover:-translate-y-1 hover:shadow-card focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo"
      >
        <div className={cn("relative aspect-[2.35/1] overflow-hidden sm:aspect-[1.55/1]", toneClasses[tone])}>
          <Image src={image} alt={alt} fill sizes="(max-width: 767px) 100vw, 33vw" className="object-cover object-[center_38%] transition duration-300 group-hover:scale-[1.025]" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#071d49]/20 to-transparent" aria-hidden="true" />
          <span className="absolute bottom-3 left-3 grid h-9 w-9 sm:bottom-4 sm:left-4 sm:h-10 sm:w-10 place-items-center rounded-full border border-white/90 bg-white text-indigo shadow-card" aria-hidden="true">
            <JourneyIcon title={title} />
          </span>
        </div>
        <div className="flex flex-1 flex-col px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-5">
          <span className="sr-only">{eyebrow}</span>
          <h3 className="font-serif text-[1.6rem] font-semibold sm:text-[1.9rem] leading-none tracking-[-0.035em] text-navy">{title}</h3>
          <p className="mt-2 text-sm leading-5 text-ink-muted sm:mt-3 sm:leading-6">{body}</p>
          <span className="mt-auto inline-flex items-center pt-3 text-sm font-bold text-indigo sm:pt-5">{action} <span aria-hidden="true" className="ml-1.5">→</span></span>
        </div>
      </Link>
    </motion.article>
  );
}
