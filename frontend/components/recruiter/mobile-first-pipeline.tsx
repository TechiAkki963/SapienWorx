"use client";

import { AnimatePresence, domAnimation, LazyMotion, m, MotionConfig } from "motion/react";
import { useMemo, useState } from "react";

import type { PipelineRow } from "@/lib/recruiter";

export type PipelineSegment = "applied" | "screening" | "interview" | "offer";

type SegmentDefinition = {
  id: PipelineSegment;
  label: string;
  backendStages: readonly string[];
};

export const pipelineSegments: readonly SegmentDefinition[] = [
  {
    id: "applied",
    label: "Applied",
    backendStages: ["new_application"],
  },
  {
    id: "screening",
    label: "Screening",
    backendStages: ["screening", "shortlisted"],
  },
  {
    id: "interview",
    label: "Interview",
    backendStages: ["technical_interview", "hr_round", "final_interview"],
  },
  {
    id: "offer",
    label: "Offer",
    backendStages: ["offer", "hired"],
  },
] as const;

type MobileFirstPipelineProps = {
  candidates: PipelineRow[];
  initialSegment?: PipelineSegment;
  renderCandidate: (candidate: PipelineRow) => React.ReactNode;
  emptyState?: React.ReactNode;
  className?: string;
};

function segmentForStage(stage: string): PipelineSegment | null {
  return pipelineSegments.find((segment) => segment.backendStages.includes(stage))?.id ?? null;
}

export function MobileFirstPipeline({
  candidates,
  initialSegment = "applied",
  renderCandidate,
  emptyState,
  className = "",
}: MobileFirstPipelineProps) {
  const [activeSegment, setActiveSegment] = useState<PipelineSegment>(initialSegment);

  const grouped = useMemo(() => {
    const result: Record<PipelineSegment, PipelineRow[]> = {
      applied: [],
      screening: [],
      interview: [],
      offer: [],
    };

    for (const candidate of candidates) {
      const segment = segmentForStage(candidate.stage);
      if (segment) result[segment].push(candidate);
    }

    return result;
  }, [candidates]);

  const visibleCandidates = grouped[activeSegment];
  const activeLabel = pipelineSegments.find((segment) => segment.id === activeSegment)?.label ?? "Pipeline";

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <section className={`min-w-0 ${className}`} aria-label="Candidate pipeline">
          <div className="sticky top-[4.25rem] z-30 -mx-4 border-y border-line/70 bg-[#f5f7fb]/94 px-4 py-2.5 shadow-[0_7px_22px_rgba(16,33,63,0.035)] backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-[4.25rem] lg:mx-0 lg:rounded-2xl lg:border lg:bg-white/94 lg:px-3">
            <div
              className="scrollbar-none flex snap-x snap-mandatory gap-1.5 overflow-x-auto overscroll-x-contain"
              role="tablist"
              aria-label="Pipeline stages"
            >
              {pipelineSegments.map((segment) => {
                const active = activeSegment === segment.id;
                const count = grouped[segment.id].length;

                return (
                  <button
                    key={segment.id}
                    id={`pipeline-tab-${segment.id}`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls="pipeline-feed"
                    onClick={() => setActiveSegment(segment.id)}
                    className={`relative min-h-11 shrink-0 snap-start overflow-hidden rounded-full px-4 py-2 text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-[#24A47F]/45 focus-visible:ring-offset-2 ${
                      active ? "text-white" : "text-ink-muted hover:bg-white hover:text-navy"
                    }`}
                  >
                    {active && (
                      <m.span
                        layoutId="pipeline-active-segment"
                        className="absolute inset-0 rounded-full bg-[#24A47F] shadow-[0_8px_20px_rgba(36,164,127,0.18)]"
                        transition={{ type: "spring", damping: 24, stiffness: 220, mass: 0.85 }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <span>{segment.label}</span>
                      <span
                        className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-extrabold tabular-nums ${
                          active ? "bg-white/20 text-white" : "bg-slate-100 text-ink-muted"
                        }`}
                        aria-label={`${count} candidates`}
                      >
                        {count}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 px-0.5">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Current segment</p>
              <h2 className="mt-0.5 text-lg font-bold tracking-[-0.025em] text-navy">{activeLabel}</h2>
            </div>
            <span className="rounded-full border border-[#24A47F]/15 bg-[#24A47F]/8 px-3 py-1.5 text-xs font-bold tabular-nums text-[#18775e]">
              {visibleCandidates.length} {visibleCandidates.length === 1 ? "candidate" : "candidates"}
            </span>
          </div>

          <div
            id="pipeline-feed"
            role="tabpanel"
            aria-labelledby={`pipeline-tab-${activeSegment}`}
            className="mt-3 min-h-48"
          >
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={activeSegment}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ type: "spring", damping: 26, stiffness: 240, mass: 0.8 }}
                className="grid gap-2.5 sm:gap-3"
              >
                {visibleCandidates.length > 0 ? (
                  visibleCandidates.map((candidate) => (
                    <div key={candidate.application_id}>{renderCandidate(candidate)}</div>
                  ))
                ) : (
                  emptyState ?? (
                    <div className="rounded-[1.35rem] border border-dashed border-[#24A47F]/25 bg-[linear-gradient(135deg,rgba(238,250,245,0.9),rgba(248,247,255,0.92))] px-5 py-9 text-center shadow-[0_10px_28px_rgba(36,164,127,0.055)]">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[46%_54%_58%_42%/48%_42%_58%_52%] bg-white text-[#24A47F] shadow-sm" aria-hidden="true">✓</div>
                      <p className="mt-3 text-sm font-bold text-navy">No candidates in {activeLabel.toLowerCase()} yet.</p>
                      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-ink-muted">Candidates will appear here as they move through your hiring process.</p>
                    </div>
                  )
                )}
              </m.div>
            </AnimatePresence>
          </div>
        </section>
      </MotionConfig>
    </LazyMotion>
  );
}
