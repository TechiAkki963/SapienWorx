import Link from "next/link";

import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { experience } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

type TalentPoolCandidate = {
  candidate_id: string;
  full_name: string;
  headline?: string;
  current_city?: string;
  experience_months: number;
  notice_period_days?: number;
  tags: string[];
  saved_at: string;
};

export default async function TalentPoolPage() {
  await requireRole("recruiter");

  const { items } = await recruiterAPI<{ items: TalentPoolCandidate[] }>("/api/v1/recruiter/talent-pool");

  return (
    <RecruiterShell>
      <div className="grid gap-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-indigo">Private talent workspace</p>
            <h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] sm:text-3xl">Talent Pool</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">Bookmark passive candidates worth revisiting later. No social graph, no feed, just durable recruiting context.</p>
          </div>
          <div className="rounded-xl border border-[#dfeee9] bg-[#eefaf5] px-4 py-2 text-sm font-bold text-[#18775e]">{items.length} saved candidate{items.length === 1 ? "" : "s"}</div>
        </header>

        {items.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-[#cfe8df] bg-[linear-gradient(145deg,#f4fbf8,#f7f5ff)] p-8 text-center">
            <p className="text-sm font-bold text-navy">Your talent pool is empty.</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-muted">Save promising candidates from the pipeline and they will appear here for future roles.</p>
            <Link href="/recruiter/pipeline" className="mt-5 inline-flex rounded-xl bg-[#24A47F] px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(36,164,127,0.18)]">Browse pipeline</Link>
          </section>
        ) : (
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((candidate) => (
              <article key={candidate.candidate_id} className="rounded-2xl border border-line/70 bg-white p-4 shadow-[0_8px_24px_rgba(36,164,127,0.07)] transition hover:-translate-y-0.5 hover:border-[#24A47F]/25 hover:shadow-[0_12px_28px_rgba(36,164,127,0.10)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[42%_58%_54%_46%/46%_40%_60%_54%] bg-[linear-gradient(145deg,#eefaf5,#f1edfb)] text-xs font-extrabold text-[#18775e]">
                    {candidate.full_name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/recruiter/candidates/${candidate.candidate_id}`} className="truncate text-base font-extrabold tracking-[-0.02em] text-navy hover:text-indigo">{candidate.full_name}</Link>
                    <p className="mt-1 truncate text-xs font-medium text-ink-muted">{candidate.headline ?? "Candidate"}</p>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50/80 p-3 text-xs">
                  <div><dt className="text-ink-muted">Experience</dt><dd className="mt-0.5 font-bold text-ink">{experience(candidate.experience_months)}</dd></div>
                  <div><dt className="text-ink-muted">Notice</dt><dd className="mt-0.5 font-bold text-ink">{candidate.notice_period_days == null ? "—" : candidate.notice_period_days === 0 ? "Immediate" : `${candidate.notice_period_days} days`}</dd></div>
                  <div className="col-span-2"><dt className="text-ink-muted">Location</dt><dd className="mt-0.5 truncate font-bold text-ink">{candidate.current_city ?? "Not specified"}</dd></div>
                </dl>

                <div className="mt-3 flex min-h-7 flex-wrap gap-1.5">
                  {candidate.tags.length ? candidate.tags.map((tag) => <span key={tag} className="rounded-full border border-[#dcebe6] bg-[#f3faf7] px-2 py-1 text-[10px] font-bold text-[#276f5d]">{tag}</span>) : <span className="text-xs text-ink-muted">No tags yet</span>}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-line/60 pt-3">
                  <span className="text-[10px] font-semibold text-ink-muted">Saved {new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(candidate.saved_at))}</span>
                  <Link href={`/recruiter/candidates/${candidate.candidate_id}`} className="text-xs font-extrabold text-indigo hover:underline">View profile →</Link>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </RecruiterShell>
  );
}
