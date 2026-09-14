"use client";

import { AnimatePresence, domAnimation, LazyMotion, m, MotionConfig } from "motion/react";
import { useEffect } from "react";

import type { PipelineRow } from "@/lib/recruiter";

type CandidateActionDrawerProps = {
  candidate: PipelineRow | null;
  open: boolean;
  onClose: () => void;
  onProgressTechnical?: (candidate: PipelineRow) => void;
  onMoveOffer?: (candidate: PipelineRow) => void;
  onDecline?: (candidate: PipelineRow) => void;
  onSendInMail?: (candidate: PipelineRow) => void;
};

const spring = { type: "spring" as const, damping: 20, stiffness: 100 };

function ActionButton({
  label,
  description,
  tone = "default",
  onClick,
}: {
  label: string;
  description: string;
  tone?: "default" | "danger" | "mail";
  onClick?: () => void;
}) {
  const toneClass =
    tone === "danger"
      ? "border-rose-100 bg-rose-50/70 text-rose-800 hover:bg-rose-50"
      : tone === "mail"
        ? "border-violet-100 bg-violet-50/75 text-violet-900 hover:bg-violet-50"
        : "border-[#dcebe6] bg-[#f3faf7] text-[#195f4e] hover:bg-[#edf8f4]";

  return (
    <m.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={`min-h-14 w-full rounded-2xl border px-4 py-3 text-left shadow-[0_6px_18px_rgba(16,33,63,0.045)] outline-none transition focus-visible:ring-2 focus-visible:ring-[#24A47F]/35 focus-visible:ring-offset-2 ${toneClass}`}
    >
      <span className="block text-sm font-extrabold">{label}</span>
      <span className="mt-1 block text-xs leading-5 opacity-75">{description}</span>
    </m.button>
  );
}

export function CandidateActionDrawer({
  candidate,
  open,
  onClose,
  onProgressTechnical,
  onMoveOffer,
  onDecline,
  onSendInMail,
}: CandidateActionDrawerProps) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <AnimatePresence>
          {open && candidate ? (
            <div className="fixed inset-0 z-[70]">
              <m.button
                type="button"
                aria-label="Close candidate actions"
                className="absolute inset-0 bg-[#071d49]/24 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={onClose}
              />

              <m.section
                role="dialog"
                aria-modal="true"
                aria-labelledby="candidate-action-title"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={spring}
                className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-hidden rounded-t-[2rem] border border-[#dfeee9] bg-white shadow-[0_-24px_70px_rgba(7,29,73,0.18)] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[28rem] md:rounded-none md:rounded-l-[2rem] md:border-y-0 md:border-r-0 md:border-l md:shadow-[-24px_0_70px_rgba(7,29,73,0.16)]"
              >
                <m.div
                  className="h-full overflow-y-auto"
                  initial={{ x: 0 }}
                  animate={{ x: 0 }}
                >
                  <div className="sticky top-0 z-10 border-b border-line/70 bg-white/96 px-5 pb-4 pt-3 backdrop-blur md:px-6 md:pt-5">
                    <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200 md:hidden" aria-hidden="true" />

                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#24A47F]">Candidate actions</p>
                        <h2 id="candidate-action-title" className="mt-1 truncate text-xl font-extrabold tracking-[-0.03em] text-navy">
                          {candidate.candidate_name}
                        </h2>
                        <p className="mt-1 truncate text-xs text-ink-muted">
                          {candidate.headline || candidate.job_title}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={onClose}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-lg text-ink-muted transition hover:bg-slate-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24A47F]/35"
                        aria-label="Close"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-5 px-5 py-5 md:px-6 md:py-6">
                    <div className="rounded-[1.4rem] border border-[#e1eaf0] bg-[linear-gradient(135deg,rgba(238,250,245,0.92),rgba(248,247,255,0.96))] p-4 shadow-[0_10px_28px_rgba(36,164,127,0.06)]">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">Current context</p>
                      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <dt className="text-ink-muted">Stage</dt>
                          <dd className="mt-0.5 font-bold capitalize text-ink">{candidate.stage.replaceAll("_", " ")}</dd>
                        </div>
                        <div>
                          <dt className="text-ink-muted">Role</dt>
                          <dd className="mt-0.5 truncate font-bold text-ink">{candidate.job_title}</dd>
                        </div>
                      </dl>
                    </div>

                    <div>
                      <p className="mb-2.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Quick actions</p>
                      <div className="grid gap-2.5">
                        <ActionButton
                          label="Progress to Technical Screen"
                          description="Advance this candidate into the technical interview stage."
                          onClick={onProgressTechnical ? () => onProgressTechnical(candidate) : undefined}
                        />
                        <ActionButton
                          label="Move to Offer"
                          description="Move the candidate directly into the offer stage."
                          onClick={onMoveOffer ? () => onMoveOffer(candidate) : undefined}
                        />
                        <ActionButton
                          label="Decline Candidate"
                          description="Mark the application as rejected from the active pipeline."
                          tone="danger"
                          onClick={onDecline ? () => onDecline(candidate) : undefined}
                        />
                        <ActionButton
                          label="Send InMail"
                          description="Open SapienMail and start or continue the candidate conversation."
                          tone="mail"
                          onClick={onSendInMail ? () => onSendInMail(candidate) : undefined}
                        />
                      </div>
                    </div>
                  </div>
                </m.div>
              </m.section>

              <style jsx>{`
                @media (min-width: 768px) {
                  section[role='dialog'] {
                    transform-origin: right center;
                  }
                }
              `}</style>
            </div>
          ) : null}
        </AnimatePresence>
      </MotionConfig>
    </LazyMotion>
  );
}
