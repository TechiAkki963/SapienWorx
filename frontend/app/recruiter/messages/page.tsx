import { MessagingWorkspace } from "@/components/messaging/messaging-workspace";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { RecruiterProductHeader } from "@/components/recruiter/recruiter-product-header";
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
        <RecruiterProductHeader eyebrow="Candidate conversations" title="Messages" description="Communicate securely with candidates and keep hiring conversations organized." />
        <MessagingWorkspace initialThreads={threads.items ?? []} initialUnreadOnly={unread === "1"} role="recruiter" />
      </div>
    </RecruiterShell>
  );
}
