"use client";

import Image from "next/image";
import { domAnimation, LazyMotion, m, MotionConfig } from "motion/react";
import { useState } from "react";

import { apiRequest } from "@/lib/api";
import type { PipelineRow } from "@/lib/recruiter";
import { experience } from "@/lib/recruiter";

type PipelineCandidateCardProps = {
  candidate: PipelineRow;
  portraitSrc?: string;
  techStack?: string[];
  signalLabel?: string;
  onSelect?: (candidate: PipelineRow) => void;
  className?: string;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "C";
}

function candidateMeta(candidate: PipelineRow) {
  const parts = [candidate.city, experience(candidate.experience_months), candidate.job_title].filter(Boolean);
  return parts.join(" · ");
}

export function PipelineCandidateCard({
  candidate,
  portraitSrc,
  techStack = [],
  signalLabel = "Sapien Signal",
  onSelect,
  className = "",
}: PipelineCandidateCardProps) {
  const stack = techStack.slice(0, 4);
  const fallbackHeadline = candidate.headline?.trim();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function saveToPool() {
    if (saved || saving) return;
    setSaving(true);
    try {
      await apiRequest(`/api/v1/recruiter/talent-pool/${candidate.candidate_id}`, {
        method: "PUT",
        body: JSON.stringify({ tags: [] }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <m.article
          whileHover={{ y: -2 }}
          transition={{ type: "spring", stiffness: 280, damping: 24, mass: 0.72 }}
          className={`group relative rounded-[1.35rem] border border-[#dfeee9] bg-white shadow-[0_8px_24px_rgba(36,164,127,0.10)] transition-[border-color,box-shadow,background-color] hover:border-[#24A47F]/28 hover:shadow-[0_13px_30px_rgba(36,164,127,0.14)] ${className}`}
        >
          <m.button
            type="button"
            onClick={() => onSelect?.(candidate)}
            whileTap={{ scale: 0.985 }}
            className="grid min-h-[5.75rem] w-full grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.35rem] px-3.5 py-3 pr-12 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#24A47F]/38 focus-visible:ring-offset-2 sm:grid-cols-[3.75rem_minmax(0,1fr)_auto] sm:px-4 sm:pr-14"
            aria-label={`Open actions for ${candidate.candidate_name}`}
          >
            <span className="relative h-14 w-14 shrink-0 overflow-hidden bg-[linear-gradient(145deg,#eefaf5,#f1edfb)] shadow-[0_5px_16px_rgba(36,164,127,0.12)] sm:h-[3.75rem] sm:w-[3.75rem]" style={{ borderRadius: "43% 57% 55% 45% / 48% 42% 58% 52%" }}>
              {portraitSrc ? <Image src={portraitSrc} alt="" fill sizes="60px" className="object-cover" /> : <span className="flex h-full w-full items-center justify-center text-sm font-extrabold text-[#18775e]">{initials(candidate.candidate_name)}</span>}
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-100/18 via-transparent to-violet-100/24 mix-blend-overlay" aria-hidden="true" />
            </span>

            <span className="min-w-0">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[0.95rem] font-extrabold tracking-[-0.018em] text-navy sm:text-base">{candidate.candidate_name}</span>
                <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-ink-muted sm:inline-flex">{candidate.stage.replaceAll("_", " ")}</span>
              </span>

              {stack.length > 0 ? <span className="mt-1.5 flex min-w-0 flex-wrap gap-1.5">{stack.map((skill) => <span key={skill} className="rounded-full border border-[#dcebe6] bg-[#f3faf7] px-2 py-0.5 text-[10px] font-bold text-[#276f5d]">{skill}</span>)}</span> : fallbackHeadline ? <span className="mt-1 block truncate text-xs font-medium text-ink-muted sm:text-[13px]">{fallbackHeadline}</span> : null}

              <span className="mt-1.5 block truncate text-[10px] font-medium text-ink-muted/90 sm:text-xs">{candidateMeta(candidate)}</span>
            </span>

            <span className="flex shrink-0 flex-col items-end gap-2 pl-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#24A47F]/18 bg-[#eefaf5] px-2.5 py-1.5 text-[10px] font-extrabold text-[#18775e] shadow-[0_3px_10px_rgba(36,164,127,0.08)] sm:text-[11px]">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[1.8]"><path d="M12 3.5c-3.4 0-6.2 2.7-6.2 6.1 0 4.6 3.6 8.4 6.2 10.9 2.6-2.5 6.2-6.3 6.2-10.9 0-3.4-2.8-6.1-6.2-6.1Z" /><path d="M9.3 10.1 11 11.8l3.8-4" /></svg>
                <span className="hidden sm:inline">{signalLabel}</span><span className="sm:hidden">Signal</span>
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-sm font-bold text-ink-muted transition group-hover:bg-[#eefaf5] group-hover:text-[#18775e]" aria-hidden="true">→</span>
            </span>
          </m.button>

          <m.button
            type="button"
            onClick={saveToPool}
            whileTap={{ scale: 0.86 }}
            animate={saved ? { scale: [1, 1.18, 1] } : { scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 20 }}
            disabled={saving || saved}
            aria-label={saved ? `${candidate.candidate_name} saved to talent pool` : `Save ${candidate.candidate_name} to talent pool`}
            title={saved ? "Saved to talent pool" : "Save to talent pool"}
            className={`absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-xl border outline-none transition focus-visible:ring-2 focus-visible:ring-[#24A47F]/38 focus-visible:ring-offset-2 ${saved ? "border-[#24A47F]/20 bg-[#24A47F] text-white" : "border-line bg-white/95 text-ink-muted hover:border-[#24A47F]/30 hover:bg-[#eefaf5] hover:text-[#18775e]"}`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-[17px] w-[17px] stroke-current stroke-[1.9] ${saved ? "fill-current" : "fill-none"}`}><path d="M7 4.5h10a1 1 0 0 1 1 1v15l-6-3.6-6 3.6v-15a1 1 0 0 1 1-1Z" /></svg>
          </m.button>
        </m.article>
      </MotionConfig>
    </LazyMotion>
  );
}
