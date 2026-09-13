import Link from "next/link";

import { MarkReadButton } from "@/components/candidate/notification-actions";
import { WorkspaceError } from "@/components/candidate/workspace-error";
import { Surface } from "@/components/ui/surface";
import { CandidateNotification, humanize } from "@/lib/candidate";
import { candidateAPI } from "@/lib/candidate-server";

function NotificationAction({ href }: { href: string }) {
  const external = href.startsWith("http://") || href.startsWith("https://");
  return external ? <a className="text-sm font-bold text-indigo hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo" href={href} target="_blank" rel="noopener noreferrer">Open meeting ↗</a> : <Link className="text-sm font-bold text-indigo hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo" href={href}>Open →</Link>;
}

export default async function NotificationsPage() {
  let items: CandidateNotification[];
  try { ({ items } = await candidateAPI<{ items: CandidateNotification[] }>("/api/v1/candidate/notifications")); } catch { return <WorkspaceError title="We couldn’t load your notifications." />; }
  return <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-ink">Updates</p><h1 className="mt-2 text-4xl font-bold tracking-[-0.045em]">Notifications</h1><p className="mt-2 text-sm text-ink-muted">Meaningful changes from your candidate activity appear here.</p>{items.length ? <Surface className="mt-6 overflow-hidden"><div className="divide-y divide-line/60">{items.map((item) => <article className={`p-5 ${item.read_at ? "bg-white/45" : "bg-indigo-soft/22"}`} key={item.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${item.read_at ? "bg-line" : "bg-indigo"}`} /><span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">{humanize(item.kind)}</span></div><h2 className="mt-2 text-lg font-bold">{item.title}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">{item.body}</p><div className="mt-3 flex items-center gap-4">{item.action_url && <NotificationAction href={item.action_url} />}<span className="text-xs text-ink-muted">{new Date(item.created_at).toLocaleString("en-IN")}</span></div></div><MarkReadButton id={item.id} read={Boolean(item.read_at)} /></div></article>)}</div></Surface> : <Surface className="mt-6 p-8 text-center" tone="mint"><h2 className="text-xl font-bold">You’re all caught up.</h2><p className="mt-2 text-sm text-ink-muted">Application and account updates will appear here.</p></Surface>}</div>;
}
