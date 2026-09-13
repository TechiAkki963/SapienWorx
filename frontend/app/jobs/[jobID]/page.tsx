import { notFound } from "next/navigation";

import { JobActions } from "@/components/candidate/job-actions";
import { Container } from "@/components/layout/container";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { getSessionUser } from "@/lib/auth-server";
import { CandidateJob, experienceLabel, humanize, jobLocation, salaryLabel } from "@/lib/candidate";
import { BackendResponseError, publicAPI } from "@/lib/candidate-server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ jobID: string }> };

export default async function JobDetailPage({ params }: Props) {
  const { jobID } = await params;
  let job: CandidateJob;
  try { job = await publicAPI<CandidateJob>(`/api/v1/jobs/${jobID}`); } catch (error) { if (error instanceof BackendResponseError && error.status === 404) notFound(); throw error; }
  const session = await getSessionUser().catch(() => null);
  const salary = salaryLabel(job);

  return (
    <main id="main-content" className="min-h-screen">
      <PublicHeader />
      <Container className="py-8 sm:py-12">
        <Button href="/jobs" variant="ghost" size="sm">← Back to jobs</Button>
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
          <article className="min-w-0">
            <Surface className="p-6 sm:p-8">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-indigo">{job.company_name}</p>
              <h1 className="mt-3 text-balance text-4xl font-bold leading-tight tracking-[-0.045em] text-ink sm:text-5xl">{job.title}</h1>
              <div className="mt-5 flex flex-wrap gap-2 text-sm font-semibold text-ink-muted"><span className="rounded-full bg-indigo-soft/55 px-3 py-1.5">{jobLocation(job)}</span><span className="rounded-full bg-mint/55 px-3 py-1.5">{humanize(job.work_mode)}</span><span className="rounded-full bg-peach/55 px-3 py-1.5">{experienceLabel(job)}</span><span className="rounded-full bg-lavender/55 px-3 py-1.5">{humanize(job.employment_type)}</span></div>
              <div className="mt-8 grid gap-3 border-y border-line/60 py-5 sm:grid-cols-3"><div><p className="text-xs uppercase tracking-wide text-ink-muted">Openings</p><p className="mt-1 font-bold">{job.openings}</p></div><div><p className="text-xs uppercase tracking-wide text-ink-muted">Salary</p><p className="mt-1 font-bold">{salary ?? "Not disclosed"}</p></div><div><p className="text-xs uppercase tracking-wide text-ink-muted">Department</p><p className="mt-1 font-bold">{job.department ?? "Not specified"}</p></div></div>
              <section className="mt-8"><h2 className="text-2xl font-bold tracking-[-0.03em]">About the role</h2><div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-ink-muted">{job.description}</div></section>
            </Surface>
          </article>
          <aside className="lg:sticky lg:top-24"><Surface className="p-5" tone="mint"><p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo">Your next step</p><h2 className="mt-2 text-xl font-bold">Interested in this role?</h2><p className="mt-2 text-sm leading-6 text-ink-muted">Applications are stored once and appear immediately in your candidate tracker.</p><div className="mt-5"><JobActions jobId={job.id} isCandidate={session?.role === "candidate"} /></div></Surface></aside>
        </div>
      </Container>
      <PublicFooter />
    </main>
  );
}
