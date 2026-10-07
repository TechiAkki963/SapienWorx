import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { RecruiterProductHeader } from "@/components/recruiter/recruiter-product-header";
import { WorkspaceState } from "@/components/recruiter/workspace-ui";
import type { OutreachCampaign } from "@/components/recruiter/outreach-workspace";
import { requireRole } from "@/lib/auth-server";
import { messagingAPI } from "@/lib/messaging-server";
import { label } from "@/lib/recruiter";

export const dynamic = "force-dynamic";
export default async function TalentInsightsPage() {
  await requireRole("recruiter");
  const { items } = await messagingAPI<{ items: OutreachCampaign[] }>("/api/v1/recruiter/outreach/campaigns");
  const sum = (field: "total_recipients" | "sent_count" | "skipped_count" | "failed_count") => items.reduce((total,item) => total + item[field],0);
  return <RecruiterShell><div className="grid gap-5 pb-24"><RecruiterProductHeader eyebrow="SapienWorx Talent" title="Talent insights" description="Recorded delivery across the campaigns available to your workspace."/><dl className="grid grid-cols-2 rounded-xl border border-line bg-white sm:grid-cols-4">{[["Recipients",sum("total_recipients")],["Sent",sum("sent_count")],["Skipped",sum("skipped_count")],["Failed",sum("failed_count")]].map(([name,count]) => <div key={name} className="p-4"><dt className="text-xs text-ink-muted">{name}</dt><dd className="mt-1 text-2xl font-semibold text-navy">{count}</dd></div>)}</dl><p className="text-xs leading-6 text-ink-muted">Counts use recorded delivery outcomes. Reply and hire attribution require additional tracked events before they can be reported accurately.</p>{items.length ? <section aria-label="Campaign delivery" className="divide-y divide-line rounded-xl border border-line bg-white">{items.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="text-sm font-semibold text-navy">{item.name}</p><p className="mt-1 text-xs text-ink-muted">{label(item.status)} · {item.sequence_name}</p></div><p className="text-xs text-ink-muted">{item.sent_count} sent · {item.skipped_count} skipped · {item.failed_count} failed</p></div>)}</section> : <WorkspaceState title="No outreach activity" description="Recorded campaign delivery will appear after a campaign is launched."/>}</div></RecruiterShell>;
}
