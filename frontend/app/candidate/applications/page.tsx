import {
  ApplicationPageInfo,
  LiveApplications,
} from "@/components/candidate/live-applications";
import { WorkspaceError } from "@/components/candidate/workspace-error";
import { Button } from "@/components/ui/button";
import { CandidateApplication } from "@/lib/candidate";
import { candidateAPI } from "@/lib/candidate-server";

export const dynamic = "force-dynamic";
export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(1, Math.min(10000, Math.floor(Number(rawPage)) || 1));
  let pageInfo: ApplicationPageInfo | undefined;
  let items: CandidateApplication[];
  try {
    const result = await candidateAPI<{
      items: CandidateApplication[] | null;
      total?: number;
      page?: number;
      limit?: number;
    }>(`/api/v1/candidate/applications?page=${page}&limit=20`);
    items = result.items ?? [];
    if (result.total !== undefined)
      pageInfo = {
        total: result.total,
        page: result.page ?? page,
        limit: result.limit ?? 20,
      };
  } catch {
    return (
      <WorkspaceError
        title="We couldn’t load your applications."
        message="Your application history hasn’t changed. Try loading this page again."
        retryHref={`/candidate/applications?page=${page}`}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo">
            Application tracker
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.045em] text-navy">
            Your applications
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
            Recruiter stage changes stay synchronized with this tracker and your
            notifications.
          </p>
        </div>
        <Button href="/candidate/jobs">Find more roles</Button>
      </div>
      <LiveApplications initialItems={items} pageInfo={pageInfo} />
    </div>
  );
}
