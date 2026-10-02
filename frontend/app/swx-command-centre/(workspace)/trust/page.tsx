import { TrustRiskActions } from "@/components/admin/trust-risk-actions";
import { canAdmin } from "@/lib/admin-access";
import { requireAdminWorkspace } from "@/lib/admin-access-server";
import { adminAPI } from "@/lib/admin-server";

type RiskFlag = {
  id: string;
  subject_type: "job" | "candidate";
  subject_id: string;
  risk_type: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "pending_review" | "reviewing" | "dismissed" | "escalated";
  source: string;
  explanation: string;
  evidence: Record<string, unknown>;
  reviewed_by?: string;
  reviewed_at?: string;
  review_note?: string;
  created_at: string;
};

function badge(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function TrustRiskPage() {
  const { access } = await requireAdminWorkspace("trust_risk.read");
  const response = await adminAPI<{ items: RiskFlag[] }>("/api/v1/admin/trust/risk-flags");
  const items = response.items ?? [];
  const open = items.filter((item) => item.status === "pending_review" || item.status === "reviewing");
  const canReview = canAdmin(access, "trust_risk.review");

  return (
    <section className="space-y-5">
      <header className="rounded-[1.5rem] border border-[#dfe4f0] bg-white p-6 shadow-[0_14px_45px_rgba(23,37,84,0.05)] sm:p-8">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#5262c9]">Trust & platform integrity</p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950">Human review of risk signals</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">Signals are advisory evidence for Master Admin review. They do not automatically label a candidate or job as fraudulent, block an account, alter ranking, or trigger a hiring decision.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Open review</p><p className="mt-2 text-2xl font-black text-slate-950">{open.length}</p></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Escalated</p><p className="mt-2 text-2xl font-black text-slate-950">{items.filter((item) => item.status === "escalated").length}</p></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Reviewed / dismissed</p><p className="mt-2 text-2xl font-black text-slate-950">{items.filter((item) => item.status === "dismissed").length}</p></div>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-2">
        {items.length === 0 ? (
          <div className="rounded-[1.35rem] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 xl:col-span-2">No risk signals are awaiting review.</div>
        ) : items.map((item) => (
          <article key={item.id} className="min-w-0 rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(23,37,84,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-indigo-600">{badge(item.subject_type)} signal</p>
                <h2 className="mt-1 break-words text-base font-bold text-slate-950">{badge(item.risk_type)}</h2>
                <p className="mt-1 break-all font-mono text-[11px] text-slate-400">{item.subject_id}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-600">{item.severity}</span>
                <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700">{badge(item.status)}</span>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{item.explanation}</p>
            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Evidence</p><p className="text-[10px] font-semibold text-slate-400">Source: {item.source}</p></div>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-700">{JSON.stringify(item.evidence, null, 2)}</pre>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">Raised {new Date(item.created_at).toLocaleString("en-IN", { timeZone: "UTC" })} UTC</p>
            {item.review_note && <p className="mt-3 rounded-xl border border-slate-100 px-3 py-2 text-xs leading-5 text-slate-600"><strong>Review note:</strong> {item.review_note}</p>}
            {canReview && (item.status === "pending_review" || item.status === "reviewing") && <TrustRiskActions flagID={item.id} />}
          </article>
        ))}
      </div>
    </section>
  );
}
