import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function RecruiterProductHeader({
  eyebrow,
  title,
  description,
  actions,
  tone = "plain",
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  tone?: "plain" | "soft";
}) {
  return (
    <header
      className={cn(
        "swx-recruiter-product-header flex min-w-0 flex-wrap items-end justify-between gap-4",
        tone === "soft" && "rounded-2xl border border-indigo/10 bg-[linear-gradient(120deg,#f2f6ff,#f4faf8)] p-5 sm:p-6",
      )}
    >
      <div className="min-w-0 max-w-4xl">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-indigo">{eyebrow}</p>
        <h1 className="swx-recruiter-display mt-1.5 text-[1.8rem] font-semibold leading-[1.02] tracking-[-0.035em] text-navy sm:text-[2.2rem]">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
