"use client";

import { useJobSave } from "@/components/candidate/use-job-save";

export function JobSaveButton({
  jobId,
  initialSaved = false,
}: {
  jobId: string;
  initialSaved?: boolean;
}) {
  const { saved, busy, error, toggle } = useJobSave(jobId, initialSaved);
  return (
    <div className="relative z-10 min-w-0 text-right">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={saved}
        aria-label={saved ? "Remove from saved jobs" : "Save job"}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-ink-muted transition hover:bg-indigo-soft/40 hover:text-indigo focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo disabled:opacity-60"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`h-4 w-4 stroke-current stroke-[1.8] ${saved ? "fill-indigo text-indigo" : "fill-none"}`}
        >
          <path d="M6.5 4.5h11v15l-5.5-3.6-5.5 3.6z" />
        </svg>
        {busy ? "Updating…" : saved ? "Saved" : "Save"}
      </button>
      {error && (
        <p
          role="alert"
          className="max-w-xs break-words text-left text-xs leading-5 text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      )}
    </div>
  );
}
