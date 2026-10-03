import { BudgetSettingsForm } from "@/components/admin/admin-actions";
import { adminAPI } from "@/lib/admin-server";
import { requireAdminWorkspace } from "@/lib/admin-access-server";
import type { AdminBudgetSettings, AdminMetrics } from "@/lib/admin";

type EmailHealth = {
  enabled: boolean;
  provider: { provider?: string; region?: string; from_address?: string; sending_enabled?: boolean; production_access_enabled?: boolean; enforcement_status?: string };
  provider_error?: string;
  pending: number;
  failed: number;
  sent_24h: number;
  suppressed: number;
  bounces: number;
  complaints: number;
  oldest_pending_at?: string;
  checked_at: string;
};

function HealthCard({ label, value, detail, tone = "indigo" }: { label: string; value: string; detail: string; tone?: "indigo" | "emerald" | "amber" | "red" }) {
  const styles = tone === "emerald" ? "from-emerald-50 to-white border-emerald-100" : tone === "amber" ? "from-amber-50 to-white border-amber-100" : tone === "red" ? "from-red-50 to-white border-red-100" : "from-indigo-50 to-white border-indigo-100";
  return <div className={`swx-system-health-card rounded-[1.3rem] border bg-gradient-to-br p-5 shadow-[0_12px_32px_rgba(23,37,84,0.045)] ${styles}`}><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p></div>;
}

export default async function AdminSystemPage() {
  await requireAdminWorkspace("system.read");
  const [metrics, settings, email] = await Promise.all([
    adminAPI<AdminMetrics>("/api/v1/admin/metrics"),
    adminAPI<AdminBudgetSettings>("/api/v1/admin/budget-settings"),
    adminAPI<EmailHealth>("/api/v1/admin/email-health"),
  ]);
  const cycle = metrics.sns_sms_sent_billing_cycle;
  const severity = cycle >= settings.sns_sms_critical_count ? "critical" : cycle >= settings.sns_sms_warning_count ? "warning" : "normal";
  const percent = Math.min(100, Math.round((cycle / Math.max(1, settings.sns_sms_critical_count)) * 100));

  return (
    <section className="space-y-5">
      <div className="rounded-[1.5rem] border border-[#dfe4f0] bg-white p-6 shadow-[0_14px_45px_rgba(23,37,84,0.05)] sm:p-8"><p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#5262c9]">System health</p><h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950">Platform health & budget</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">Operational volume and SMS consumption are calculated from live platform data and the daily metrics ledger.</p></div>

      {severity !== "normal" && <div className={`rounded-[1.25rem] border p-4 ${severity === "critical" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}><p className="text-xs font-black uppercase tracking-[0.12em]">{severity === "critical" ? "Critical SNS guardrail reached" : "SNS warning threshold reached"}</p><p className="mt-1 text-sm">This billing cycle has recorded {cycle.toLocaleString("en-IN")} successful SMS sends. Review OTP traffic and destination mix before increasing volume.</p></div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <HealthCard label="Active users" value={metrics.total_active_users.toLocaleString("en-IN")} detail="Accounts currently active across all roles" tone="emerald" />
        <HealthCard label="Active jobs" value={metrics.active_jobs.toLocaleString("en-IN")} detail="Published roles currently available to candidates" />
        <HealthCard label="Jobs posted today" value={metrics.jobs_posted_today.toLocaleString("en-IN")} detail="Publishing volume for the current UTC date" />
        <HealthCard label="Candidates" value={metrics.total_candidates.toLocaleString("en-IN")} detail="Total candidate accounts tracked by the platform" />
        <HealthCard label="SNS SMS today" value={metrics.sns_sms_sent_today.toLocaleString("en-IN")} detail="Successful AWS SNS sends recorded today" tone="amber" />
        <HealthCard label="SNS billing cycle" value={cycle.toLocaleString("en-IN")} detail={`Messages since ${new Date(metrics.sns_billing_cycle_start).toLocaleDateString("en-IN")}`} tone={severity === "critical" ? "red" : "amber"} />
      </div>

      <div className="rounded-[1.35rem] border border-[#e1e5ef] bg-white p-5 shadow-[0_10px_30px_rgba(23,37,84,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#5262c9]">Transactional email</p>
            <h2 className="mt-2 text-lg font-bold text-slate-950">Amazon SES delivery health</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Security-code email delivery, retry state and suppression protection. Production access remains a separate AWS approval gate.</p>
          </div>
          <span className={`rounded-full border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] ${email.enabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{email.enabled ? "Dispatcher enabled" : "Dispatcher disabled"}</span>
        </div>
        {email.provider_error && <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><span className="font-extrabold">SES status check degraded.</span> Queue and suppression data remain available; the live AWS account check will retry automatically.</div>}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HealthCard label="Queued" value={email.pending.toLocaleString("en-IN")} detail={email.oldest_pending_at ? `Oldest waiting since ${new Date(email.oldest_pending_at).toLocaleString("en-IN")}` : "No waiting email"} tone={email.pending > 0 ? "amber" : "emerald"} />
          <HealthCard label="Failed" value={email.failed.toLocaleString("en-IN")} detail="Messages waiting for a bounded retry" tone={email.failed > 0 ? "red" : "emerald"} />
          <HealthCard label="Sent · 24h" value={email.sent_24h.toLocaleString("en-IN")} detail="Accepted by the configured email provider" tone="indigo" />
          <HealthCard label="Suppressed" value={email.suppressed.toLocaleString("en-IN")} detail={`${email.bounces.toLocaleString("en-IN")} bounce · ${email.complaints.toLocaleString("en-IN")} complaint`} tone={email.suppressed > 0 ? "amber" : "emerald"} />
        </div>
        <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
          <div><span className="block font-bold text-slate-700">Region</span>{email.provider.region ?? "Not connected"}</div>
          <div><span className="block font-bold text-slate-700">Sender</span>{email.provider.from_address ?? "Not connected"}</div>
          <div><span className="block font-bold text-slate-700">SES sending</span>{email.provider.sending_enabled === undefined ? "Not checked" : email.provider.sending_enabled ? "Enabled" : "Disabled"}</div>
          <div><span className="block font-bold text-slate-700">Production access</span>{email.provider.production_access_enabled === undefined ? "Separate AWS gate" : email.provider.production_access_enabled ? "Approved" : "Sandbox / not approved"}</div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
        <div className="rounded-[1.35rem] border border-[#e1e5ef] bg-white p-5 shadow-[0_10px_30px_rgba(23,37,84,0.04)]"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#5262c9]">Budget guardrail</p><h2 className="mt-2 text-lg font-bold text-slate-950">AWS SNS usage ledger</h2><p className="mt-2 text-sm leading-6 text-slate-500">SapienWorx tracks message volume rather than inventing a currency estimate. Warning and critical thresholds are operational limits controlled by the Master Admin.</p><div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${severity === "critical" ? "bg-red-500" : severity === "warning" ? "bg-amber-500" : "bg-[#5262c9]"}`} style={{ width: `${percent}%` }} /></div><div className="mt-2 flex justify-between text-[10px] font-bold text-slate-400"><span>0</span><span>Warning {settings.sns_sms_warning_count.toLocaleString("en-IN")}</span><span>Critical {settings.sns_sms_critical_count.toLocaleString("en-IN")}</span></div><div className="mt-5 border-t border-slate-100 pt-5"><BudgetSettingsForm warningCount={settings.sns_sms_warning_count} criticalCount={settings.sns_sms_critical_count} /></div></div>
        <div className="rounded-[1.35rem] border border-[#e1e5ef] bg-white p-5 shadow-[0_10px_30px_rgba(23,37,84,0.04)]"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#5262c9]">Governance load</p><p className="mt-3 text-4xl font-black tracking-[-0.05em] text-slate-950">{metrics.pending_company_reviews.toLocaleString("en-IN")}</p><p className="mt-2 text-sm text-slate-500">Pending company verifications require Master Admin review.</p><div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">Last metrics computation {new Date(metrics.computed_at).toLocaleString("en-IN")}<br/>Guardrails updated {new Date(settings.updated_at).toLocaleString("en-IN")}</div></div>
      </div>
    </section>
  );
}
