"use client";

import { ScheduleInterviewForm } from "@/components/recruiter/schedule-interview-form";
import { SaveProfileButton } from "@/components/recruiter/save-profile-button";
import type { PipelineRow } from "@/lib/recruiter";

export function CandidateHeaderActions({
  candidateID,
  initialSaved,
  applications,
}: {
  candidateID: string;
  initialSaved: boolean;
  applications: PipelineRow[];
}) {
  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-2 xl:w-auto">
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("sapienworx:open-candidate-inmail"))}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-indigo px-3.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(8,102,255,0.16)] transition hover:bg-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/35 focus-visible:ring-offset-2 max-sm:flex-1 max-sm:px-3"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[17px] w-[17px] fill-none stroke-current stroke-[1.8]">
          <path d="M4 5.5h16v11H9l-5 3v-14Z" />
          <path d="M7.5 9h9M7.5 12.5h6" />
        </svg>
        <span className="sm:hidden">InMail</span><span className="max-sm:hidden">Send InMail</span>
      </button>

      {applications.length > 0 && <ScheduleInterviewForm applications={applications} compactTrigger />}
      <SaveProfileButton candidateID={candidateID} initialSaved={initialSaved} compact />
    </div>
  );
}
