import Link from "next/link";

import { WorkspaceError } from "@/components/candidate/workspace-error";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { CandidateApplication, humanize, stageLabel } from "@/lib/candidate";
import { candidateAPI } from "@/lib/candidate-server";

export default async function ApplicationsPage() {
  let items: CandidateApplication[];
  try { ({ items } = await candidateAPI<{ items: CandidateApplication[] }>("/api/v1/candidate/applications")); } catch { return <WorkspaceError title="We couldn’t load your applications." />; }
  return <div><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-ink">Application tracker</p><h1 className="mt-2 text-4xl font-bold tracking-[-0.045em]">Your applications</h1><p className="mt-2 text-sm text-ink-muted">A table-first view of every role and its current stage.</p></div><Button href="/jobs">Find more roles</Button></div>{items.length ? <Surface className="mt-6 overflow-x-auto"><table className="w-full min-w-[46rem] text-left text-sm"><thead className="border-b border-line/70 bg-lavender/35 text-xs uppercase tracking-wide text-ink-muted"><tr><th className="px-5 py-4">Role</th><th className="px-5 py-4">Company</th><th className="px-5 py-4">Work mode</th><th className="px-5 py-4">Stage</th><th className="px-5 py-4">Applied</th></tr></thead><tbody className="divide-y divide-line/60">{items.map((item) => <tr key={item.id} className="hover:bg-indigo-soft/20"><td className="px-5 py-4 font-bold"><Link className="hover:text-indigo hover:underline" href={`/jobs/${item.job_id}`}>{item.job_title}</Link></td><td className="px-5 py-4 text-ink-muted">{item.company_name}</td><td className="px-5 py-4 text-ink-muted">{humanize(item.work_mode)}</td><td className="px-5 py-4"><span className="rounded-full bg-indigo-soft/60 px-3 py-1 text-xs font-bold text-violet-ink">{stageLabel(item.stage)}</span></td><td className="px-5 py-4 text-ink-muted">{new Date(item.applied_at).toLocaleDateString("en-IN")}</td></tr>)}</tbody></table></Surface> : <Surface className="mt-6 p-8 text-center" tone="mint"><h2 className="text-xl font-bold">Your tracker is ready.</h2><p className="mt-2 text-sm text-ink-muted">Apply to an active role and it will appear here immediately.</p><div className="mt-5"><Button href="/jobs" variant="secondary">Browse jobs</Button></div></Surface>}</div>;
}
