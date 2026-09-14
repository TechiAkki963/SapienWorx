"use client";

import { domAnimation, LazyMotion, m, MotionConfig } from "motion/react";
import { useState } from "react";

import { apiRequest } from "@/lib/api";

type WatchCompanyButtonProps = {
  companyId: string;
  companyName?: string;
  initialWatching?: boolean;
  className?: string;
};

const spring = { type: "spring" as const, stiffness: 320, damping: 22, mass: 0.72 };

export function WatchCompanyButton({
  companyId,
  companyName,
  initialWatching = false,
  className = "",
}: WatchCompanyButtonProps) {
  const [watching, setWatching] = useState(initialWatching);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function toggleWatch() {
    if (pending) return;

    const nextWatching = !watching;
    setPending(true);
    setMessage("");

    // Optimistic state makes the interaction feel immediate; failures roll back.
    setWatching(nextWatching);

    try {
      await apiRequest(`/api/v1/candidate/company-watchlist/${companyId}`, {
        method: nextWatching ? "PUT" : "DELETE",
      });
      setMessage(
        nextWatching
          ? `You’ll be notified when ${companyName ?? "this company"} posts new roles.`
          : `You stopped watching ${companyName ?? "this company"}.`,
      );
    } catch (cause) {
      setWatching(!nextWatching);
      setMessage(cause instanceof Error ? cause.message : "Could not update your company watchlist.");
    } finally {
      setPending(false);
    }
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div className={`inline-grid gap-2 ${className}`}>
          <m.button
            type="button"
            onClick={toggleWatch}
            disabled={pending}
            aria-pressed={watching}
            aria-label={`${watching ? "Stop watching" : "Watch"} ${companyName ?? "company"}`}
            whileTap={{ scale: 0.96 }}
            animate={watching ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={spring}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-extrabold shadow-sm outline-none transition-[background-color,border-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-[#24A47F]/35 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70 ${
              watching
                ? "border-[#24A47F] bg-[#24A47F] text-white shadow-[0_8px_22px_rgba(36,164,127,0.22)]"
                : "border-[#24A47F]/45 bg-white text-[#18775e] shadow-[0_6px_18px_rgba(36,164,127,0.08)] hover:border-[#24A47F] hover:bg-[#f2fbf8]"
            }`}
          >
            <m.span
              aria-hidden="true"
              animate={watching ? { rotate: [0, -10, 10, 0], scale: [1, 1.14, 1] } : { rotate: 0, scale: 1 }}
              transition={spring}
              className="flex h-5 w-5 items-center justify-center"
            >
              {watching ? "✓" : "+"}
            </m.span>
            <span>{pending ? "Updating…" : watching ? "Watching" : "Watch Company"}</span>
          </m.button>

          {message ? (
            <p className="max-w-xs text-xs leading-5 text-ink-muted" role="status" aria-live="polite">
              {message}
            </p>
          ) : null}
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
