"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";

import { BulkInMailDrawer } from "@/components/recruiter/bulk-inmail-drawer";
import { experience } from "@/lib/recruiter";

export type TalentPoolCandidate = {
  candidate_id: string;
  full_name: string;
  headline?: string;
  current_city?: string;
  experience_months: number;
  notice_period_days?: number;
  tags: string[];
  saved_at: string;
};

function candidateInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function savedDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function SelectionCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="group relative inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg transition hover:bg-[#e8f6f1] focus-within:ring-2 focus-within:ring-[#24A47F]/30">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={label}
        className="peer h-[18px] w-[18px] cursor-pointer appearance-none rounded-[5px] border-2 border-[#aab9b4] bg-white transition checked:border-[#24A47F] checked:bg-[#24A47F] focus:outline-none"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute h-3 w-3 scale-75 fill-none stroke-white stroke-[2.2] opacity-0 transition peer-checked:scale-100 peer-checked:opacity-100"
      >
        <path d="m3.25 8.2 2.8 2.8 6.7-6.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}

export function TalentPoolSelection({ items }: { items: TalentPoolCandidate[] }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const allSelected = items.length > 0 && selected.size === items.length;
  const selectedCount = selected.size;
  const selectedCandidateIDs = useMemo(() => Array.from(selected), [selected]);

  function toggleCandidate(candidateID: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(candidateID)) next.delete(candidateID);
      else next.add(candidateID);
      return next;
    });
  }

  function toggleAll() {
    setSelected(() => {
      if (allSelected) return new Set();
      return new Set(items.map((candidate) => candidate.candidate_id));
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function requestBulkComposer() {
    window.dispatchEvent(
      new CustomEvent("sapienworx:open-bulk-inmail", {
        detail: { candidateIDs: selectedCandidateIDs },
      }),
    );
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-line/70 bg-white shadow-[0_8px_24px_rgba(16,33,63,0.05)]">
        <div className="flex flex-col gap-3 border-b border-line/70 bg-[#fbfcfe] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="flex items-center gap-2.5">
            <SelectionCheckbox checked={allSelected} onChange={toggleAll} label={allSelected ? "Clear all candidates" : "Select all candidates"} />
            <div>
              <p className="text-sm font-extrabold text-navy">Select candidates</p>
              <p className="text-[11px] leading-4 text-ink-muted">Choose recipients for bulk actions without leaving your talent pool.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedCount > 0 && (
              <button type="button" onClick={clearSelection} className="min-h-9 rounded-lg px-3 text-xs font-bold text-ink-muted transition hover:bg-white hover:text-navy">
                Clear selection
              </button>
            )}
            <span className="rounded-lg border border-[#dcebe6] bg-[#f3faf7] px-3 py-2 text-xs font-extrabold text-[#18775e]">
              {selectedCount} selected
            </span>
          </div>
        </div>

        <div className="grid gap-px bg-line/60 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((candidate) => {
            const isSelected = selected.has(candidate.candidate_id);

            return (
              <article
                key={candidate.candidate_id}
                className={`relative bg-white p-4 transition duration-200 ${isSelected ? "z-10 bg-[#f6fcfa] shadow-[inset_0_0_0_2px_#24A47F]" : "hover:bg-[#fbfdfc]"}`}
              >
                <div className="flex items-start gap-2.5">
                  <SelectionCheckbox
                    checked={isSelected}
                    onChange={() => toggleCandidate(candidate.candidate_id)}
                    label={`${isSelected ? "Deselect" : "Select"} ${candidate.full_name}`}
                  />

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(145deg,#eefaf5,#f1edfb)] text-xs font-extrabold text-[#18775e]">
                    {candidateInitials(candidate.full_name)}
                  </div>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <Link href={`/recruiter/candidates/${candidate.candidate_id}`} className="block truncate text-base font-extrabold tracking-[-0.02em] text-navy hover:text-indigo hover:underline hover:underline-offset-2">
                      {candidate.full_name}
                    </Link>
                    <p className="mt-1 truncate text-xs font-medium text-ink-muted">{candidate.headline ?? "Candidate"}</p>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 rounded-xl bg-slate-50/80 p-3 text-xs">
                  <div>
                    <dt className="text-ink-muted">Experience</dt>
                    <dd className="mt-0.5 font-bold text-ink">{experience(candidate.experience_months)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Notice</dt>
                    <dd className="mt-0.5 font-bold text-ink">
                      {candidate.notice_period_days == null ? "—" : candidate.notice_period_days === 0 ? "Immediate" : `${candidate.notice_period_days} days`}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-ink-muted">Location</dt>
                    <dd className="mt-0.5 truncate font-bold text-ink">{candidate.current_city ?? "Not specified"}</dd>
                  </div>
                </dl>

                <div className="mt-3 flex min-h-7 flex-wrap gap-1.5">
                  {candidate.tags.length ? (
                    candidate.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-[#dcebe6] bg-[#f3faf7] px-2 py-1 text-[10px] font-bold text-[#276f5d]">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-ink-muted">No tags yet</span>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-line/60 pt-3">
                  <span className="text-[10px] font-semibold text-ink-muted">Saved {savedDate(candidate.saved_at)}</span>
                  <Link href={`/recruiter/candidates/${candidate.candidate_id}`} className="text-xs font-extrabold text-indigo hover:underline hover:underline-offset-2">
                    View profile →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 22, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 30, mass: 0.8 }}
            className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-[46rem] sm:inset-x-6 sm:bottom-5"
            role="region"
            aria-label="Bulk candidate actions"
          >
            <div className="flex flex-col gap-3 rounded-2xl border border-[#bde3d7] bg-white/96 p-3 shadow-[0_22px_60px_rgba(16,33,63,0.20)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-3.5">
              <div className="flex min-w-0 items-center gap-3 px-1">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e5f6f0] text-sm font-black text-[#18775e]">{selectedCount}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-navy">
                    {selectedCount} candidate{selectedCount === 1 ? "" : "s"} selected
                  </p>
                  <p className="text-[11px] leading-4 text-ink-muted">Ready for targeted outreach.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button type="button" onClick={clearSelection} className="min-h-10 flex-1 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink-muted transition hover:bg-slate-50 hover:text-navy sm:flex-none">
                  Clear
                </button>
                <button
                  type="button"
                  onClick={requestBulkComposer}
                  className="min-h-10 flex-[1.35] rounded-xl bg-[#24A47F] px-5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(36,164,127,0.24)] transition hover:bg-[#1d8d6d] focus-visible:ring-2 focus-visible:ring-[#24A47F]/35 sm:flex-none"
                >
                  Send Bulk InMail
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BulkInMailDrawer onSent={clearSelection} />
    </>
  );
}
