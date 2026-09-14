import Link from "next/link";

import { JobSaveButton } from "@/components/candidate/job-save-button";
import { Surface } from "@/components/ui/surface";
import { CandidateJob, experienceLabel, humanize, jobLocation } from "@/lib/candidate";

const tagTones = [
  "bg-blue-50 text-blue-700 border-blue-100",
  "bg-emerald-50 text-emerald-700 border-emerald-100",
  "bg-violet-50 text-violet-700 border-violet-100",
  "bg-amber-50 text-amber-800 border-amber-100",
  "bg-rose-50 text-rose-700 border-rose-100",
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "SW";
}

function postedAgo(value?: string) {
  if (!value) return "Recently posted";
  const published = new Date(value).getTime();
  if (Number.isNaN(published)) return "Recently posted";
  const days = Math.max(0, Math.floor((Date.now() - published) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function JobCard({
  job,
  compact = false,
  hrefBase = "/jobs",
  initialSaved = false,
  canSave = false,
}: {
  job: CandidateJob;
  compact?: boolean;
  hrefBase?: string;
  initialSaved?: boolean;
  canSave?: boolean;
}) {
  const detailHref = `${hrefBase}/${job.id}`;
  const skills = job.required_skills?.slice(0, 5) ?? [];

  return (
    <Surface className="group relative h-full overflow-hidden border-line/80 bg-white p-5 shadow-[0_8px_28px_rgba(16,33,63,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-indigo/20 hover:shadow-card">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="pr-1 text-lg font-extrabold leading-6 tracking-[-0.025em] text-navy sm:text-xl">
            <Link href={detailHref} target="_blank" rel="noopener noreferrer" className="outline-none after:absolute after:inset-0 focus-visible:underline">
              {job.title}
            </Link>
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-muted">
            <span className="font-bold text-ink">{job.company_name}</span>
            {typeof job.match_score === "number" && <><span aria-hidden="true">·</span><span className="text-emerald-700">{job.match_score}% skill match</span></>}
          </div>
        </div>

        <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          {job.company_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={job.company_logo_url} alt={`${job.company_name} logo`} className="h-full w-full object-contain p-2" />
          ) : (
            <span className="text-sm font-black tracking-tight text-navy">{initials(job.company_name)}</span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-ink-muted">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true">▣</span>{experienceLabel(job)}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true">⌖</span>{humanize(job.work_mode)} · {jobLocation(job)}</span>
      </div>

      {!compact && <p className="mt-3 line-clamp-1 text-sm leading-6 text-ink-muted">{job.description}</p>}

      {skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {skills.map((skill, index) => <span key={skill} className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${tagTones[index % tagTones.length]}`}>{skill}</span>)}
        </div>
      )}

      <div className="relative z-10 mt-5 flex items-center justify-between gap-3 border-t border-line/60 pt-3">
        <span className="text-xs font-semibold text-ink-muted">{postedAgo(job.published_at)}</span>
        {canSave ? <JobSaveButton jobId={job.id} initialSaved={initialSaved} /> : <span className="text-xs font-bold text-indigo">View role ↗</span>}
      </div>
    </Surface>
  );
}
