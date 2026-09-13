import Link from "next/link";

import { Surface } from "@/components/ui/surface";
import { CandidateJob, experienceLabel, humanize, jobLocation, salaryLabel } from "@/lib/candidate";

export function JobCard({ job, compact = false, hrefBase = "/jobs" }: { job: CandidateJob; compact?: boolean; hrefBase?: string }) {
  const salary = salaryLabel(job);
  return (
    <Surface className="group relative h-full p-5 transition duration-200 hover:-translate-y-0.5 hover:border-indigo/15 hover:shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo">{job.company_name}</p>
          <h3 className="mt-2 text-xl font-bold tracking-[-0.025em] text-ink"><Link className="outline-none after:absolute after:inset-0 focus-visible:underline" href={`${hrefBase}/${job.id}`}>{job.title}</Link></h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {typeof job.match_score === "number" && <span className="rounded-full bg-mint px-3 py-1 text-xs font-extrabold text-navy">{job.match_score}% skill match</span>}
          <span className="rounded-full bg-indigo-soft/65 px-3 py-1 text-xs font-semibold text-violet-ink">{humanize(job.work_mode)}</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-ink-muted">
        <span className="rounded-full bg-canvas px-3 py-1.5">{jobLocation(job)}</span>
        <span className="rounded-full bg-canvas px-3 py-1.5">{experienceLabel(job)}</span>
        <span className="rounded-full bg-canvas px-3 py-1.5">{humanize(job.employment_type)}</span>
      </div>
      {job.required_skills?.length ? <p className="mt-4 text-xs font-semibold text-ink-muted">Skills: {job.required_skills.join(" · ")}</p> : null}
      {!compact && <p className="mt-4 line-clamp-2 text-sm leading-6 text-ink-muted">{job.description}</p>}
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-line/60 pt-4">
        <span className="text-sm font-semibold text-ink">{salary ?? `${job.openings} opening${job.openings === 1 ? "" : "s"}`}</span>
        <span className="text-sm font-bold text-indigo transition group-hover:translate-x-0.5">View role →</span>
      </div>
    </Surface>
  );
}
