import Link from "next/link";

import { PipelineTable } from "@/components/recruiter/pipeline-table";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { label, PipelineList, RecruiterJob, stages } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ q?: string; stage?: string; job_id?: string; page?: string }> };

function pageHref(params: Awaited<Props["searchParams"]>, page: number) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.stage) query.set("stage", params.stage);
  if (params.job_id) query.set("job_id", params.job_id);
  query.set("page", String(page));
  return `/recruiter/pipeline?${query}`;
}

export default async function PipelinePage({ searchParams }: Props) {
  await requireRole("recruiter");
  const params = await searchParams;
  const requestedPage = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.stage) query.set("stage", params.stage);
  if (params.job_id) query.set("job_id", params.job_id);
  query.set("page", String(requestedPage));
  query.set("limit", "10");
  const [pipeline, { items: jobs }] = await Promise.all([
    recruiterAPI<PipelineList>(`/api/v1/recruiter/pipeline?${query}`),
    recruiterAPI<{ items: RecruiterJob[] }>("/api/v1/recruiter/jobs"),
  ]);
  const pageCount = Math.max(1, Math.ceil(pipeline.total / pipeline.limit));
  const start = pipeline.total ? (pipeline.page - 1) * pipeline.limit + 1 : 0;
  const end = Math.min(pipeline.total, pipeline.page * pipeline.limit);

  return <RecruiterShell><div className="grid gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-indigo">Dense candidate pipeline</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] sm:text-3xl">Pipeline</h1><p className="mt-1 text-sm text-ink-muted">Rows, persistent filters and explicit stage controls. No Kanban.</p></div><div className="grid gap-4 xl:grid-cols-[15rem_minmax(0,1fr)]"><aside className="xl:sticky xl:top-6 xl:self-start"><form className="grid gap-3 rounded-2xl border border-line/70 bg-white p-3"><div><p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">Filters</p><p className="mt-1 text-xs leading-5 text-ink-muted">Narrow the list without losing row context.</p></div><label className="grid gap-1 text-xs font-semibold text-ink-muted">Candidate<input name="q" defaultValue={params.q} placeholder="Name or headline" className="rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-indigo" /></label><label className="grid gap-1 text-xs font-semibold text-ink-muted">Stage<select name="stage" defaultValue={params.stage ?? ""} className="rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-indigo"><option value="">All stages</option>{stages.map(v => <option key={v} value={v}>{label(v)}</option>)}</select></label><label className="grid gap-1 text-xs font-semibold text-ink-muted">Job<select name="job_id" defaultValue={params.job_id ?? ""} className="rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-indigo"><option value="">All jobs</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label><button className="rounded-lg bg-indigo px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2">Apply filters</button><Link href="/recruiter/pipeline" className="text-center text-xs font-bold text-indigo hover:underline">Clear filters</Link></form></aside><section className="min-w-0"><div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted"><span>Showing {start}–{end} of {pipeline.total} candidates</span><span>10 candidates per page</span></div><PipelineTable rows={pipeline.items}/><nav aria-label="Pipeline pagination" className="mt-3 flex items-center justify-between gap-3"><Link aria-disabled={pipeline.page <= 1} tabIndex={pipeline.page <= 1 ? -1 : undefined} href={pipeline.page <= 1 ? pageHref(params, 1) : pageHref(params, pipeline.page - 1)} className={`rounded-lg border border-line bg-white px-3 py-2 text-sm font-bold ${pipeline.page <= 1 ? "pointer-events-none opacity-45" : "text-ink hover:border-indigo/30"}`}>← Previous</Link><span className="text-xs font-semibold text-ink-muted">Page {pipeline.page} of {pageCount}</span><Link aria-disabled={pipeline.page >= pageCount} tabIndex={pipeline.page >= pageCount ? -1 : undefined} href={pipeline.page >= pageCount ? pageHref(params, pageCount) : pageHref(params, pipeline.page + 1)} className={`rounded-lg border border-line bg-white px-3 py-2 text-sm font-bold ${pipeline.page >= pageCount ? "pointer-events-none opacity-45" : "text-ink hover:border-indigo/30"}`}>Next →</Link></nav></section></div></div></RecruiterShell>;
}
