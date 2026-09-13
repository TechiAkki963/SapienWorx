import { JobCard } from "@/components/candidate/job-card";
import { WorkspaceError } from "@/components/candidate/workspace-error";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { CandidateJob } from "@/lib/candidate";
import { candidateAPI } from "@/lib/candidate-server";

export default async function SavedJobsPage() {
  let items: CandidateJob[];
  try { ({ items } = await candidateAPI<{ items: CandidateJob[] }>("/api/v1/candidate/saved-jobs")); } catch { return <WorkspaceError title="We couldn’t load your saved jobs." />; }
  return <div><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-ink">Shortlist</p><h1 className="mt-2 text-4xl font-bold tracking-[-0.045em]">Saved jobs</h1><p className="mt-2 text-sm text-ink-muted">Keep interesting roles close without applying before you’re ready.</p></div><Button href="/jobs">Explore jobs</Button></div>{items.length ? <div className="mt-6 grid gap-4 xl:grid-cols-2">{items.map((job) => <JobCard job={job} key={job.id} />)}</div> : <Surface className="mt-6 p-8 text-center" tone="lavender"><h2 className="text-xl font-bold">Nothing saved yet.</h2><p className="mt-2 text-sm text-ink-muted">Use “Save job” on a role page to build your shortlist.</p></Surface>}</div>;
}
