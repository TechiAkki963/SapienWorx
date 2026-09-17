import { adminAPI } from "@/lib/admin-server";

type PrivacyRequest = { id: string; user_id: string; request_type: string; status: string; due_at: string; created_at: string };
type Incident = { id: string; title: string; severity: string; status: string; discovered_at: string; notification_required?: boolean; notification_deadline?: string };
type ProcessingActivity = { id: string; activity_name: string; purpose: string; lawful_basis: string; retention_policy: string; owner: string; reviewed_at?: string };
type Subprocessor = { id: string; name: string; purpose: string; processing_locations: string[]; effective_from: string };

export default async function AdminPrivacyPage() {
  const [requests, incidents, activities, subprocessors] = await Promise.all([
    adminAPI<{ items: PrivacyRequest[] }>("/api/v1/admin/privacy/requests"),
    adminAPI<{ items: Incident[] }>("/api/v1/admin/privacy/incidents"),
    adminAPI<{ items: ProcessingActivity[] }>("/api/v1/admin/privacy/processing-activities"),
    adminAPI<{ items: Subprocessor[] }>("/api/v1/admin/privacy/subprocessors"),
  ]);
  const activeRequests = requests.items.filter((item) => ["received", "in_progress", "awaiting_review"].includes(item.status));

  return <section className="space-y-5">
    <div className="rounded-[1.5rem] border border-[#dfe4f0] bg-white p-6 shadow-[0_14px_45px_rgba(23,37,84,0.05)] sm:p-8">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#5262c9]">Privacy operations</p>
      <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950">DPDP / GDPR operations centre</h1>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">Review rights requests, erasure review gates, incident readiness, active subprocessors and the record of processing activities. Destructive or legal-status decisions remain separate reviewed actions rather than one-click mutations.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-4">{[["Open rights requests",activeRequests.length],["Open incidents",incidents.items.filter((item)=>item.status!=="closed").length],["ROPA activities",activities.items.length],["Subprocessors",subprocessors.items.length]].map(([label,value])=><div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p></div>)}</div>
    </div>

    <div className="overflow-x-auto rounded-[1.35rem] border border-[#e1e5ef] bg-white shadow-[0_10px_30px_rgba(23,37,84,0.04)]">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-950">Rights and erasure requests</h2></div>
      <table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Type</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">User</th><th className="px-4 py-3">Due</th></tr></thead><tbody>{requests.items.length===0?<tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">No privacy requests.</td></tr>:requests.items.map((item)=><tr key={item.id} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{item.request_type}</td><td className="px-4 py-3"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{item.status}</span></td><td className="px-4 py-3 font-mono text-xs text-slate-500">{item.user_id}</td><td className="px-4 py-3 text-slate-500">{new Date(item.due_at).toLocaleString("en-IN")}</td></tr>)}</tbody></table>
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <div className="rounded-[1.35rem] border border-[#e1e5ef] bg-white p-5"><h2 className="font-bold text-slate-950">Incident register</h2><div className="mt-4 space-y-3">{incidents.items.length===0?<p className="text-sm text-slate-500">No incidents recorded.</p>:incidents.items.map((item)=><div key={item.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-800">{item.title}</p><span className="text-xs font-bold uppercase text-slate-500">{item.severity}</span></div><p className="mt-1 text-xs text-slate-500">{item.status} · discovered {new Date(item.discovered_at).toLocaleString("en-IN")}</p></div>)}</div></div>
      <div className="rounded-[1.35rem] border border-[#e1e5ef] bg-white p-5"><h2 className="font-bold text-slate-950">ROPA</h2><div className="mt-4 space-y-3">{activities.items.length===0?<p className="text-sm text-slate-500">No processing activities recorded.</p>:activities.items.map((item)=><div key={item.id} className="rounded-xl border border-slate-100 p-4"><p className="font-semibold text-slate-800">{item.activity_name}</p><p className="mt-1 text-xs text-slate-500">{item.lawful_basis} · {item.retention_policy}</p><p className="mt-2 text-sm text-slate-600">{item.purpose}</p></div>)}</div></div>
    </div>
  </section>;
}
