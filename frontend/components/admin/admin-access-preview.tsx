"use client";

import { useState } from "react";
import Link from "next/link";
import { adminRoleLabel, type AdminAccess } from "@/lib/admin-access";

import catalog from "@/lib/admin-permission-catalog.json";

const roles = [
  { id: "super_admin", label: "Super Admin", description: "Platform governance and the reviewed operational controls." },
  { id: "platform_admin", label: "Platform Admin", description: "Routine accounts, company verification and job moderation." },
  { id: "security_admin", label: "Security Admin", description: "Account security actions and authorized audit investigations." },
  { id: "privacy_admin", label: "Privacy Admin", description: "Data-rights operations and authorized audit investigations." },
  { id: "support_admin", label: "Support Admin", description: "Read-only account, organization and job support." },
  { id: "finance_admin", label: "Finance Admin", description: "Read-only actual cost snapshots and governed operational evidence." },
  { id: "content_admin", label: "Content Admin", description: "Knowledge Hub revisions and publishing controls without platform-security privileges." },
  { id: "auditor", label: "Read-only Auditor", description: "Aggregate overview and authorized audit records; no mutations." },
] as const;

type AdminRole = (typeof roles)[number]["id"];
const modules = [
  { label: "Platform overview", permissions: [["overview.read", "View aggregate metrics"]] },
  { label: "Organizations", permissions: [["organizations.read", "View verification queue"], ["organizations.review", "Approve or reject verification"], ["organizations.documents", "View registration documents"]] },
  { label: "User management", permissions: [["users.read", "View account records"], ["users.moderate", "Suspend or require a password reset"]] },
  { label: "Job management", permissions: [["jobs.read", "View job records"], ["jobs.moderate", "Take down a job with justification"]] },
  { label: "Recruitment operations", permissions: [["recruitment.read", "Read application/interview metadata and recorded history"]] },
  { label: "Privacy operations", permissions: [["privacy.read", "View privacy operations records"], ["privacy.manage", "Transition data-rights requests"]] },
  { label: "Audit history", permissions: [["audit.read", "Read authorized audit records"]] },
  { label: "System usage", permissions: [["system.read", "View operational counts and SNS usage"], ["system.configure", "Change SNS usage thresholds"]] },
  { label: "Control plane", permissions: [["control_plane.read", "View approvals, cases, telemetry and release evidence"], ["control_plane.manage", "Create governed reviews and independent approvals"]] },
  { label: "Knowledge Hub", permissions: [["content.read", "View content revisions"], ["content.manage", "Publish governed content revisions"]] },
  { label: "Cost evidence", permissions: [["costs.read", "View actual cloud cost snapshots"]] },
  { label: "Release acceptance", permissions: [["release.manage", "Manage reviewed release acceptance checkpoints"]] },
] as const;

export function AdminAccessPreview({ access }: { access: AdminAccess }) {
  const [selected, setSelected] = useState<AdminRole>("auditor");
  const role = roles.find((item) => item.id === selected)!;
  const permissions: readonly string[] = catalog[selected];

  return <section className="space-y-5">
    <header className="rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center gap-3"><p className="text-xs font-bold uppercase tracking-wider text-indigo">Access design</p><span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">{access.enabled ? "Policy preview · selection only" : "Preview · not enforced"}</span></div>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">Administrative permissions</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-muted">Review the proposed separation of responsibilities before activation. Choosing a role here only changes this preview; it does not assign a role or change your session.</p>
    </header>

    {access.enabled ? <div role="note" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"><span className="font-bold">Your current access: {adminRoleLabel(access.admin_role)}.</span> Scoped API checks and authenticator confirmation are enabled in this environment. Previewing another role does not change your access.<Link href="/swx-command-centre/security" className="mt-2 block font-bold underline">Confirm security session</Link></div> : <div role="note" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><span className="font-bold">Current protection:</span> the existing master-admin role check remains in place. Scoped permissions and authenticator MFA are not active. This screen is not evidence that either protection has been deployed.</div>}

    <div className="grid items-start gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-sm">
        <label htmlFor="admin-role-preview" className="text-sm font-bold text-ink">Preview an administrative role</label>
        <select id="admin-role-preview" value={selected} onChange={(event) => setSelected(event.target.value as AdminRole)} className="mt-3 min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo">{roles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
        <div className="mt-4" aria-live="polite"><h2 className="font-bold text-ink">{role.label}</h2><p className="mt-2 text-sm leading-6 text-ink-muted">{role.description}</p><p className="mt-3 text-xs font-semibold text-indigo">{permissions.length} proposed capabilities</p></div>
        <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-ink-muted">Unknown roles and undefined capabilities are denied in the proposed catalog. No role includes private InMail browsing, bulk deletion or automatic privilege escalation.</p>
      </aside>

      <div className="grid min-w-0 gap-4 md:grid-cols-2" aria-label="Proposed module permissions">{modules.map((module) => <article key={module.label} className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-sm"><h2 className="text-sm font-bold text-ink">{module.label}</h2><ul className="mt-3 space-y-3">{module.permissions.map(([permission, label]) => {
        const allowed = permissions.includes(permission);
        return <li key={permission} className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0 leading-5 text-ink-muted">{label}</span><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${allowed ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{allowed ? "Proposed" : "Not granted"}</span></li>;
      })}</ul></article>)}</div>
    </div>

    <section className="rounded-2xl border border-line bg-white p-6 shadow-sm" aria-labelledby="activation-checklist">
      <h2 id="activation-checklist" className="text-lg font-bold text-ink">Before activation</h2>
      <ol className="mt-3 grid list-inside list-decimal gap-3 text-sm leading-6 text-ink-muted md:grid-cols-2"><li>Approve each administrator’s role and record the approval.</li><li>Test authenticator enrollment and recovery in isolation.</li><li>Verify direct API denial, session revocation and refresh behavior.</li><li>Review migration, rollback and the existing administrator’s access.</li></ol>
      <p className="mt-4 text-xs leading-5 text-ink-muted">Production rollout and operator role assignments require separate approval. This role preview does not modify credentials, roles or authentication settings.</p>
    </section>
  </section>;
}
