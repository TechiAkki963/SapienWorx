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
  title: ReactNode;
  description: string;
  actions?: ReactNode;
  tone?: "plain" | "soft";
}) {
  return (
    <header
      data-testid="recruiter-product-header"
      className={cn(
        "swx-recruiter-product-header flex min-w-0 flex-wrap items-end justify-between gap-4",
        "border-b border-line/70 pb-5",
      )}
    >
      <div className="min-w-0 max-w-4xl">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-indigo">{eyebrow}</p>
        <h1 className="swx-recruiter-display mt-1 text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-navy sm:text-[2rem]">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
