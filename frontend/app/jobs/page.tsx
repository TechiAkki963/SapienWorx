import { JobCard } from "@/components/candidate/job-card";
import { Container } from "@/components/layout/container";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { JobList } from "@/lib/candidate";
import { publicAPI } from "@/lib/candidate-server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function single(value: string | string[] | undefined): string { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }

export default async function JobsPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = single(params.q);
  const location = single(params.location);
  const workMode = single(params.work_mode);
  const experience = single(params.experience);
  const page = Math.max(1, Number(single(params.page)) || 1);
  const query = new URLSearchParams({ q, location, page: String(page), limit: "10" });
  if (workMode) query.set("work_mode", workMode);
  if (experience) query.set("experience", experience);
  let result: JobList | null = null;
  let failed = false;
  try { result = await publicAPI<JobList>(`/api/v1/jobs?${query.toString()}`); } catch { failed = true; }

  const pageCount = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;
  const pageHref = (next: number) => { const nextQuery = new URLSearchParams(query); nextQuery.set("page", String(next)); return `/jobs?${nextQuery.toString()}`; };

  return (
    <main id="main-content" className="min-h-screen">
      <PublicHeader />
      <Container className="py-8 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Surface className="p-5">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-indigo">Refine search</p>
              <form className="mt-5 grid gap-4" action="/jobs">
                <label className="grid gap-1.5 text-sm font-semibold text-ink">Keyword<input name="q" defaultValue={q} className="min-h-11 rounded-xl border border-line bg-white px-3 font-normal outline-none focus:border-indigo/40 focus:ring-2 focus:ring-indigo/15" placeholder="Role, skill, company" /></label>
                <label className="grid gap-1.5 text-sm font-semibold text-ink">Location<input name="location" defaultValue={location} className="min-h-11 rounded-xl border border-line bg-white px-3 font-normal outline-none focus:border-indigo/40 focus:ring-2 focus:ring-indigo/15" placeholder="Mumbai, Pune…" /></label>
                <label className="grid gap-1.5 text-sm font-semibold text-ink">Experience<select name="experience" defaultValue={experience} className="min-h-11 rounded-xl border border-line bg-white px-3 font-normal outline-none focus:border-indigo/40 focus:ring-2 focus:ring-indigo/15"><option value="">Any experience</option><option value="0">Fresher / 0 years</option><option value="1">1 year</option><option value="2">2 years</option><option value="3">3 years</option><option value="5">5 years</option><option value="8">8 years</option><option value="10">10+ years</option></select></label>
                <label className="grid gap-1.5 text-sm font-semibold text-ink">Work mode<select name="work_mode" defaultValue={workMode} className="min-h-11 rounded-xl border border-line bg-white px-3 font-normal outline-none focus:border-indigo/40 focus:ring-2 focus:ring-indigo/15"><option value="">Any</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label>
                <Button type="submit">Search jobs</Button>
                {(q || location || workMode || experience) && <Button href="/jobs" variant="ghost">Clear filters</Button>}
              </form>
            </Surface>
          </aside>

          <section aria-labelledby="jobs-title">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-indigo">Live opportunities</p><h1 id="jobs-title" className="mt-2 text-4xl font-bold tracking-[-0.045em] text-navy">Find your next role.</h1></div>
              {result && <p className="text-sm font-semibold text-ink-muted">{result.total} active {result.total === 1 ? "role" : "roles"}</p>}
            </div>

            {failed ? <Surface className="mt-7 p-8 text-center" tone="peach"><h2 className="text-xl font-bold">Live jobs are temporarily unavailable.</h2><p className="mt-2 text-sm text-ink-muted">The public site is working, but the jobs API could not be reached. No placeholder jobs are being substituted.</p></Surface> : result && result.items.length > 0 ? <div className="mt-7 grid gap-4 xl:grid-cols-2">{result.items.map((job) => <JobCard key={job.id} job={job} />)}</div> : <Surface className="mt-7 p-8 text-center" tone="mint"><h2 className="text-xl font-bold">No roles match those filters yet.</h2><p className="mt-2 text-sm text-ink-muted">Try a broader keyword, nearby location, experience level, or another work mode.</p><div className="mt-5"><Button href="/jobs" variant="secondary">Reset search</Button></div></Surface>}

            {result && result.total > result.limit && <nav className="mt-8 flex items-center justify-between gap-4" aria-label="Job result pages"><Button href={pageHref(Math.max(1,page-1))} variant="secondary" size="sm" className={page <= 1 ? "pointer-events-none opacity-50" : undefined}>← Previous</Button><span className="text-sm font-semibold text-ink-muted">Page {page} of {pageCount}</span><Button href={pageHref(Math.min(pageCount,page+1))} variant="secondary" size="sm" className={page >= pageCount ? "pointer-events-none opacity-50" : undefined}>Next →</Button></nav>}
          </section>
        </div>
      </Container>
      <PublicFooter />
    </main>
  );
}
