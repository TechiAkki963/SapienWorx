import Link from "next/link";

import { adminAPI } from "@/lib/admin-server";
import type { AdminMetrics, VerificationList } from "@/lib/admin";

function MetricCard({ label, value, note }: { label: string; value: string | number; note: string }) {
  return <div className="rounded-[1.25rem] border border-[#e1e5ef] bg-white p-5 shadow-[0_10px_28px_rgba(55,65,140,0.055)]"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">{label}</p><p className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{note}</p></div>;
}

export default async function CommandCentreOverviewPage() {
  const [metrics, pending] = await Promise.all([
    adminAPI<AdminMetrics>("/api/v1/admin/metrics"),
    adminAPI<VerificationList>("/api/v1/admin/company-verifications?status=pending&page=1&limit=5"),
  ]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 rounded-[1.5rem] border border-[#dfe4f0] bg-white p-6 shadow-[0_14px_45px_rgba(23,37,84,0.05)] sm:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#5262c9]">Master Admin</p><h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">Platform command centre</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">Govern tenant access, moderate accounts, and watch operating volume and SNS spend signals from one restricted workspace.</p></div>
        <p className="text-xs text-slate-400">Computed {new Date(metrics.computed_at).toLocaleString("en-IN")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active users" value={metrics.total_active_users.toLocaleString("en-IN")} note="Currently active platform accounts" />
        <MetricCard label="Active jobs" value={metrics.active_jobs.toLocaleString("en-IN")} note={`${metrics.jobs_posted_today.toLocaleString("en-IN")} posted today`} />
        <MetricCard label="Candidates" value={metrics.total_candidates.toLocaleString("en-IN")} note="Candidate accounts in the ecosystem" />
        <MetricCard label="Pending reviews" value={metrics.pending_company_reviews.toLocaleString("en-IN")} note="Recruiter/company approvals waiting" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-[1.4rem] border border-[#e1e5ef] bg-white shadow-[0_10px_30px_rgba(23,37,84,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><p className="text-sm font-bold text-slate-950">Verification queue</p><p className="mt-1 text-xs text-slate-500">Oldest pending recruiter registrations first.</p></div><Link href="/swx-command-centre/tenants" className="text-xs font-bold text-[#5262c9] hover:underline">Open queue →</Link></div>
          {pending.items.length === 0 ? <p className="p-6 text-sm text-slate-500">No pending company reviews.</p> : <div className="divide-y divide-slate-100">{pending.items.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{item.company_name}</p><p className="mt-1 text-xs text-slate-500">Submitted {new Date(item.created_at).toLocaleDateString("en-IN")}</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-amber-700">Pending</span></div>)}</div>}
        </div>

        <div className="rounded-[1.4rem] border border-[#d9def3] bg-gradient-to-br from-[#f4f5ff] to-white p-5 shadow-[0_14px_38px_rgba(82,98,201,0.08)]"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#5262c9]">AWS SNS watch</p><p className="mt-3 text-4xl font-black tracking-[-0.05em] text-slate-950">{metrics.sns_sms_sent_billing_cycle.toLocaleString("en-IN")}</p><p className="mt-2 text-sm text-slate-600">SMS messages this billing cycle</p><div className="mt-5 rounded-xl border border-white bg-white/80 p-4"><p className="text-xs font-semibold text-slate-700">Today</p><p className="mt-1 text-2xl font-black text-[#5262c9]">{metrics.sns_sms_sent_today.toLocaleString("en-IN")}</p><p className="mt-2 text-xs text-slate-500">Cycle started {new Date(metrics.sns_billing_cycle_start).toLocaleDateString("en-IN")}</p></div><Link href="/swx-command-centre/system" className="mt-4 inline-flex text-xs font-bold text-[#5262c9] hover:underline">Inspect system health →</Link></div>
      </div>
    </section>
  );
}
