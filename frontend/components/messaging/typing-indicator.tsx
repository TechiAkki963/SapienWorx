"use client";

import { domAnimation, LazyMotion, m, MotionConfig } from "motion/react";

import type { MessagingSenderType } from "@/lib/messaging";

type TypingIndicatorProps = {
  senderType: MessagingSenderType;
};

const container = {
  animate: {
    transition: {
      staggerChildren: 0.14,
      repeat: Infinity,
      repeatDelay: 0.28,
    },
  },
};

const dot = {
  initial: { y: 0, opacity: 0.45 },
  animate: {
    y: [0, -5, 0],
    opacity: [0.45, 1, 0.45],
    transition: {
      duration: 0.72,
      ease: [0.34, 1.56, 0.64, 1],
    },
  },
};

export function TypingIndicator({ senderType }: TypingIndicatorProps) {
  const candidate = senderType === "candidate";

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <m.div
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 260, damping: 22, mass: 0.8 }}
          className={`inline-flex rounded-[1.15rem] px-3.5 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.05)] ${candidate ? "rounded-br-md border border-emerald-100 bg-emerald-50" : "rounded-bl-md border border-violet-100 bg-violet-50"}`}
          aria-label="Typing"
          role="status"
        >
          <m.span variants={container} initial="initial" animate="animate" className="flex items-center gap-1.5">
            {[0, 1, 2].map((index) => (
              <m.span
                // index is stable for the fixed three-dot sequence.
                key={index}
                variants={dot}
                className={`h-1.5 w-1.5 rounded-full ${candidate ? "bg-emerald-500/70" : "bg-violet-500/70"}`}
              />
            ))}
          </m.span>
        </m.div>
      </MotionConfig>
    </LazyMotion>
  );
}
