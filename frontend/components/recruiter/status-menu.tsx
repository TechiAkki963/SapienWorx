"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { label } from "@/lib/recruiter";

type Tone = "neutral" | "blue" | "amber" | "green" | "red" | "slate";

const tones: Record<Tone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  red: "border-rose-200 bg-rose-50 text-rose-700",
  slate: "border-slate-300 bg-slate-100 text-slate-600",
};

export function statusTone(value: string): Tone {
  if (["hired", "active", "completed"].includes(value)) return "green";
  if (["offer", "shortlisted", "scheduled"].includes(value)) return "blue";
  if (["screening", "technical_interview", "hr_round", "final_interview", "paused"].includes(value)) return "amber";
  if (["rejected", "cancelled", "no_show"].includes(value)) return "red";
  if (["closed", "expired", "archived", "withdrawn"].includes(value)) return "slate";
  return "neutral";
}

export function StatusPill({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("inline-flex min-h-7 items-center rounded-full border px-2.5 text-[11px] font-extrabold tracking-[0.01em]", tones[statusTone(value)], className)}>
      {label(value)}
    </span>
  );
}

export function StatusMenu({
  value,
  options,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: string;
  options: readonly string[];
  disabled?: boolean;
  ariaLabel: string;
  onChange: (next: string) => Promise<void> | void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);

  async function choose(next: string) {
    if (next === value || busy || disabled) {
      detailsRef.current?.removeAttribute("open");
      return;
    }
    setBusy(true);
    try {
      await onChange(next);
      detailsRef.current?.removeAttribute("open");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details ref={detailsRef} className="relative inline-block">
      <summary
        aria-label={ariaLabel}
        className={cn(
          "flex cursor-pointer list-none items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-extrabold outline-none transition hover:brightness-[0.98] focus-visible:ring-2 focus-visible:ring-indigo/30",
          tones[statusTone(value)],
          (busy || disabled) && "pointer-events-none opacity-60",
        )}
      >
        <span>{label(value)}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3 fill-none stroke-current stroke-[1.7]"><path d="m4 6 4 4 4-4" /></svg>
      </summary>
      <div className="absolute right-0 z-30 mt-2 min-w-52 overflow-hidden rounded-xl border border-line bg-white p-1.5 shadow-[0_14px_40px_rgba(16,33,63,0.16)]">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={busy}
            onClick={() => choose(option)}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-ink transition hover:bg-slate-50",
              option === value && "bg-indigo-soft/60",
            )}
          >
            <StatusPill value={option} />
            {option === value && <span aria-hidden="true" className="text-indigo">✓</span>}
          </button>
        ))}
      </div>
    </details>
  );
}
