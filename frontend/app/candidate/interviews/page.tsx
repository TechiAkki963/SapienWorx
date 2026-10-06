import { LiveInterviews } from "@/components/candidate/live-interviews";
import { WorkspaceError } from "@/components/candidate/workspace-error";
import { CandidateInterview } from "@/lib/candidate";
import { candidateAPI } from "@/lib/candidate-server";

export const dynamic = "force-dynamic";

export default async function CandidateInterviewsPage() {
  let items: CandidateInterview[];
  try {
    const result = await candidateAPI<{ items: CandidateInterview[] | null }>(
      "/api/v1/candidate/interviews",
    );
    items = result.items ?? [];
  } catch {
    return (
      <WorkspaceError
        title="We couldn’t load your interviews."
        message="Your interview schedule hasn’t changed. Please try loading it again."
        retryHref="/candidate/interviews"
      />
    );
  }
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo">
        Interview schedule
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em] text-navy sm:text-4xl">
        Your interviews
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
        Your upcoming interviews and schedule history, with meeting details
        supplied by your recruiter.
      </p>
      <LiveInterviews initialItems={items} />
    </div>
  );
}
