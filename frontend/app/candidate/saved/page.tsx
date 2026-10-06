import { JobCard } from "@/components/candidate/job-card";
import { WorkspaceError } from "@/components/candidate/workspace-error";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { CandidateJob } from "@/lib/candidate";
import { candidateAPI } from "@/lib/candidate-server";

export const dynamic = "force-dynamic";

export default async function SavedJobsPage() {
  let items: CandidateJob[];
  try {
    const result = await candidateAPI<{ items: CandidateJob[] | null }>(
      "/api/v1/candidate/saved-jobs",
    );
    items = result.items ?? [];
  } catch {
    return (
      <WorkspaceError
        title="We couldn’t load your saved jobs."
        message="Your shortlist is still saved. Please retry when the connection is available."
        retryHref="/candidate/saved"
      />
    );
  }
  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo">
            Your shortlist
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em] sm:text-4xl">
            Saved jobs
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Saved to your account, so you can return from any device.
          </p>
        </div>
        <Button href="/candidate/jobs">Find more roles</Button>
      </div>
      {items.length ? (
        <div className="mt-6 grid min-w-0 gap-4 xl:grid-cols-2">
          {items.map((job) => (
            <JobCard
              job={job}
              key={job.id}
              hrefBase="/candidate/jobs"
              initialSaved
            />
          ))}
        </div>
      ) : (
        <Surface className="mt-6 p-8 text-center" tone="lavender">
          <h2 className="text-xl font-bold">Nothing saved yet.</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Save a role in Find Jobs to keep it here. Saving doesn’t send an
            application.
          </p>
          <Button href="/candidate/jobs" variant="secondary" className="mt-4">
            Explore jobs
          </Button>
        </Surface>
      )}
    </div>
  );
}
