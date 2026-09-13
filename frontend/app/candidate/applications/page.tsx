import { LiveApplications } from "@/components/candidate/live-applications";
import { WorkspaceError } from "@/components/candidate/workspace-error";
import { Button } from "@/components/ui/button";
import { CandidateApplication } from "@/lib/candidate";
import { candidateAPI } from "@/lib/candidate-server";

export default async function ApplicationsPage() {
  let items: CandidateApplication[];
  try {
    ({ items } = await candidateAPI<{ items: CandidateApplication[] }>("/api/v1/candidate/applications"));
  } catch {
    return <WorkspaceError title="We couldn’t load your applications." />;
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo">Application tracker</p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.045em] text-navy">Your applications</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">Recruiter stage changes stay synchronized with this tracker and your notifications.</p>
        </div>
        <Button href="/candidate/jobs">Find more roles</Button>
      </div>
      <LiveApplications initialItems={items} />
    </div>
  );
}
