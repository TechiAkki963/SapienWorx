import { CandidateInbox } from "@/components/candidate/candidate-inbox";
import type { ThreadListResponse } from "@/lib/messaging";
import { messagingAPI } from "@/lib/messaging-server";

export const dynamic = "force-dynamic";

export default async function CandidateInboxPage() {
  const threads = await messagingAPI<ThreadListResponse>("/api/v1/messaging/threads");

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-indigo">Recruiter conversations</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-navy">Inbox</h1>
        <p className="mt-1 text-sm text-ink-muted">Private conversations started by recruiters about roles and opportunities.</p>
      </div>
      <CandidateInbox initialThreads={threads.items ?? []} />
    </div>
  );
}
