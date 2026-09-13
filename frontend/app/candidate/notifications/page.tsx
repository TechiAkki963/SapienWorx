import { LiveNotifications } from "@/components/candidate/live-notifications";
import { WorkspaceError } from "@/components/candidate/workspace-error";
import { CandidateNotification } from "@/lib/candidate";
import { candidateAPI } from "@/lib/candidate-server";

export default async function NotificationsPage() {
  let items: CandidateNotification[];
  try {
    ({ items } = await candidateAPI<{ items: CandidateNotification[] }>("/api/v1/candidate/notifications"));
  } catch {
    return <WorkspaceError title="We couldn’t load your notifications." />;
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo">Updates</p>
      <h1 className="mt-2 text-4xl font-bold tracking-[-0.045em] text-navy">Notifications</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">Application stage changes, interviews and other candidate updates appear here and refresh automatically.</p>
      <LiveNotifications initialItems={items} />
    </div>
  );
}
