import { MessagingWorkspace } from "@/components/messaging/messaging-workspace";
import type { ThreadListResponse } from "@/lib/messaging";
import { messagingAPI } from "@/lib/messaging-server";

export const dynamic = "force-dynamic";

export default async function CandidateInboxPage() {
  const threads = await messagingAPI<ThreadListResponse>("/api/v1/messaging/threads");

  return (
    <div className="swx-messages-page">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-xl font-bold text-navy">Messages</h1>
        <p className="text-sm text-ink-muted">Your private conversations with recruiters.</p>
      </header>
      <MessagingWorkspace initialThreads={threads.items ?? []} role="candidate" />
    </div>
  );
}
