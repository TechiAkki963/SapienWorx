import { adminAPI } from "@/lib/admin-server";
import type { AdminMetrics } from "@/lib/admin";

function HealthCard({ label, value, detail, tone = "indigo" }: { label: string; value: string; detail: string; tone?: "indigo" | "emerald" | "amber" }) {
  const styles = tone === "emerald" ? "from-emerald-50 to-white border-emerald-100" : tone === "amber" ? "from-amber-50 to-white border-amber-100" : "from-indigo-50 to-white border-indigo-100";
  return <div className={`rounded-[1.3rem] border bg-gradient-to-br p-5 shadow-[0_12px_32px_rgba(23,37,84,0.045)] ${styles}`}><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p></div>;
}

export default async function AdminSystemPage() {
  const metrics = await adminAPI<AdminMetrics>("/api/v1/admin/metrics");
  return (
    <section className="space-y-5">
      <div className="rounded-[1.5rem] border border-[#dfe4f0] bg-white p-6 shadow-[0_14px_45px_rgba(23,37,84,0.05)] sm:p-8"><p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#5262c9]">System health</p><h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950">Platform health & budget</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">Operational volume and SMS consumption are calculated from live platform data and the daily metrics ledger.</p></div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <HealthCard label="Active users" value={metrics.total_active_users.toLocaleString("en-IN")} detail="Accounts currently active across all roles" tone="emerald" />
        <HealthCard label="Active jobs" value={metrics.active_jobs.toLocaleString("en-IN")} detail="Published roles currently available to candidates" />
        <HealthCard label="Jobs posted today" value={metrics.jobs_posted_today.toLocaleString("en-IN")} detail="Publishing volume for the current UTC date" />
        <HealthCard label="Candidates" value={metrics.total_candidates.toLocaleString("en-IN")} detail="Total candidate accounts tracked by the platform" />
        <HealthCard label="SNS SMS today" value={metrics.sns_sms_sent_today.toLocaleString("en-IN")} detail="Successful AWS SNS sends recorded today" tone="amber" />
        <HealthCard label="SNS billing cycle" value={metrics.sns_sms_sent_billing_cycle.toLocaleString("en-IN")} detail={`Messages since ${new Date(metrics.sns_billing_cycle_start).toLocaleDateString("en-IN")}`} tone="amber" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
        <div className="rounded-[1.35rem] border border-[#e1e5ef] bg-white p-5 shadow-[0_10px_30px_rgba(23,37,84,0.04)]"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#5262c9]">Budget guardrail</p><h2 className="mt-2 text-lg font-bold text-slate-950">AWS SNS usage ledger</h2><p className="mt-2 text-sm leading-6 text-slate-500">This dashboard tracks message volume, not estimated currency spend. Exact spend depends on destination countries and AWS pricing, so SapienWorx does not invent a cost figure here.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">Cycle total</p><p className="mt-1 text-2xl font-black text-slate-950">{metrics.sns_sms_sent_billing_cycle.toLocaleString("en-IN")}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">Today</p><p className="mt-1 text-2xl font-black text-slate-950">{metrics.sns_sms_sent_today.toLocaleString("en-IN")}</p></div></div></div>
        <div className="rounded-[1.35rem] border border-[#e1e5ef] bg-white p-5 shadow-[0_10px_30px_rgba(23,37,84,0.04)]"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#5262c9]">Governance load</p><p className="mt-3 text-4xl font-black tracking-[-0.05em] text-slate-950">{metrics.pending_company_reviews.toLocaleString("en-IN")}</p><p className="mt-2 text-sm text-slate-500">Pending company verifications require Master Admin review.</p><div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">Last computed {new Date(metrics.computed_at).toLocaleString("en-IN")}</div></div>
      </div>
    </section>
  );
}
