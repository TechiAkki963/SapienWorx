"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";

type Tone = "lavender" | "mint" | "peach";
type SharedProps = { className?: string; tone?: Tone; rotate?: "left" | "right" | "none" };

const tones: Record<Tone, string> = { lavender: "bg-lavender/92", mint: "bg-mint/92", peach: "bg-peach/92" };
const rotations = { left: "-rotate-[1.2deg]", right: "rotate-[1.2deg]", none: "rotate-0" };

function FloatingShell({ className, tone = "lavender", rotate = "none", children }: SharedProps & { children: React.ReactNode }) {
  return (
    <motion.div
      className={cn("w-52 rounded-2xl border border-white/55 p-4 shadow-float backdrop-blur-md", tones[tone], rotations[rotate], className)}
      whileHover={{ y: -4, rotate: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
    >
      {children}
    </motion.div>
  );
}

export function FloatingStatCard({ label, value, ...props }: SharedProps & { label: string; value: string }) {
  return <FloatingShell {...props}><p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-muted">{label}</p><p className="font-display mt-2 text-3xl font-bold tracking-[-0.04em] text-violet-ink">{value}</p></FloatingShell>;
}

export function FloatingChecklistCard({ label = "Status", items, ...props }: SharedProps & { label?: string; items: string[] }) {
  return <FloatingShell {...props}><p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-muted">{label}</p><div className="mt-2 grid gap-1.5">{items.map((item) => <p key={item} className="flex items-center gap-2 text-sm font-semibold text-ink"><span className="grid h-5 w-5 place-items-center rounded-full bg-white/80 text-[0.7rem] text-violet-ink">✓</span>{item}</p>)}</div></FloatingShell>;
}

export function FloatingAvatarCard({ label, initials, ...props }: SharedProps & { label: string; initials: string[] }) {
  return <FloatingShell {...props}><div className="flex -space-x-2">{initials.slice(0, 4).map((initial) => <span key={initial} className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-indigo-soft text-xs font-bold text-violet-ink">{initial}</span>)}</div><p className="mt-3 text-sm font-semibold leading-snug text-ink">{label}</p></FloatingShell>;
}

export function FloatingQuoteCard({ quote, ...props }: SharedProps & { quote: string }) {
  return <FloatingShell {...props}><p className="font-display text-base font-bold italic leading-6 text-ink">“{quote}”</p></FloatingShell>;
}

export function FloatingProductCard({ className, eyebrow, metric, title, tone = "lavender" }: SharedProps & { eyebrow: string; metric?: string; title: string }) {
  return <FloatingShell className={className} tone={tone}><p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink-muted">{eyebrow}</p><p className="mt-2 text-sm font-semibold leading-snug text-ink">{title}</p>{metric && <p className="font-display mt-3 text-2xl font-bold tracking-tight text-violet-ink">{metric}</p>}</FloatingShell>;
}
