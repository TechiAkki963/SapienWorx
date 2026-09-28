import { MessagingWorkspace } from "@/components/messaging/messaging-workspace";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import type { ThreadListResponse } from "@/lib/messaging";
import { messagingAPI } from "@/lib/messaging-server";

export const dynamic = "force-dynamic";

export default async function RecruiterMessagesPage({ searchParams }: { searchParams: Promise<{ unread?: string }> }) {
  await requireRole("recruiter");
  const { unread } = await searchParams;
  const threads = await messagingAPI<ThreadListResponse>("/api/v1/messaging/threads");

  return (
    <RecruiterShell>
      <div className="grid gap-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-indigo">Candidate conversations</p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-navy">Messages</h1>
          <p className="mt-1 text-sm text-ink-muted">Continue conversations with candidates without sharing personal email addresses.</p>
        </div>
        <MessagingWorkspace initialThreads={threads.items ?? []} initialUnreadOnly={unread === "1"} role="recruiter" />
      </div>
    </RecruiterShell>
  );
}
