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
      <div className="swx-messages-page">
        <header className="flex items-baseline gap-3"><h1 className="swx-type-page-title text-navy">Messages</h1><p className="text-sm text-ink-muted">Keep your hiring conversations moving.</p></header>
        <MessagingWorkspace initialThreads={threads.items ?? []} initialUnreadOnly={unread === "1"} role="recruiter" />
      </div>
    </RecruiterShell>
  );
}
