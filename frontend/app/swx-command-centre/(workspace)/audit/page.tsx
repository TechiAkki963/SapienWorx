import Link from "next/link";

import { adminAPI } from "@/lib/admin-server";
import type { AdminAuditList } from "@/lib/admin";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export default async function AdminAuditPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = first(params.q) ?? "";
  const action = first(params.action) ?? "";
  const targetType = first(params.target_type) ?? "";
  const page = Math.max(1, Number(first(params.page) ?? "1") || 1);
  const query = new URLSearchParams({ q, action, target_type: targetType, page: String(page), limit: "50" });
  const data = await adminAPI<AdminAuditList>(`/api/v1/admin/audit-logs?${query.toString()}`);
  const pages = Math.max(1, Math.ceil(data.total / data.limit));

  return <section className="space-y-5">
    <div className="rounded-[1.5rem] border border-[#dfe4f0] bg-white p-6 shadow-[0_14px_45px_rgba(23,37,84,0.05)] sm:p-8">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#5262c9]">Security evidence</p>
      <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950">Administrative audit log</h1>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">Append-only evidence for denied gateway attempts and privileged platform actions. Records cannot be edited or deleted through the application.</p>
      <form className="mt-5 grid gap-3 lg:grid-cols-[1fr_16rem_13rem_auto]">
        <input name="q" defaultValue={q} placeholder="Search admin, target ID, request ID or action" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-300 focus:ring-3 focus:ring-indigo-100" />
        <input name="action" defaultValue={action} placeholder="Exact action type" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-300 focus:ring-3 focus:ring-indigo-100" />
        <select name="target_type" defaultValue={targetType} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-300 focus:ring-3 focus:ring-indigo-100"><option value="">All targets</option>{["admin_gateway","company_verification","user","job","platform_settings"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <button className="h-10 rounded-xl bg-[#4656cf] px-4 text-sm font-bold text-white hover:bg-[#3948bd]">Filter</button>
      </form>
    </div>

    <div className="overflow-x-auto rounded-[1.35rem] border border-[#e1e5ef] bg-white shadow-[0_10px_30px_rgba(23,37,84,0.04)]">
      <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Admin</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">IP</th><th className="px-4 py-3">Request</th><th className="px-4 py-3">Metadata</th></tr></thead>
        <tbody>{data.items.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No audit records match these filters.</td></tr> : data.items.map((item) => <tr key={item.id} className="border-t border-slate-100 align-top hover:bg-slate-50/60"><td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-500">{new Date(item.created_at).toLocaleString("en-IN")}</td><td className="px-4 py-3.5"><p className="font-semibold text-slate-800">{item.admin_name ?? "System / unknown"}</p>{item.admin_id && <p className="mt-1 font-mono text-[10px] text-slate-400">{item.admin_id}</p>}</td><td className="px-4 py-3.5"><span className="rounded-md bg-indigo-50 px-2 py-1 font-mono text-[11px] font-semibold text-indigo-700">{item.action_type}</span></td><td className="px-4 py-3.5"><p className="text-xs font-semibold text-slate-700">{item.target_entity_type ?? "—"}</p>{item.target_entity_id && <p className="mt-1 font-mono text-[10px] text-slate-400">{item.target_entity_id}</p>}</td><td className="px-4 py-3.5 font-mono text-xs text-slate-500">{item.ip_address ?? "—"}</td><td className="px-4 py-3.5 font-mono text-[10px] text-slate-400">{item.request_id ?? "—"}</td><td className="max-w-[22rem] px-4 py-3.5"><code className="block max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-2 text-[10px] leading-4 text-slate-600">{JSON.stringify(item.metadata)}</code></td></tr>)}</tbody>
      </table>
    </div>

    <div className="flex items-center justify-between text-sm text-slate-500"><span>{data.total.toLocaleString("en-IN")} events</span><div className="flex items-center gap-2"><Link aria-disabled={page <= 1} href={`/swx-command-centre/audit?${new URLSearchParams({ q, action, target_type: targetType, page: String(Math.max(1,page-1)) }).toString()}`} className={`rounded-lg border border-slate-200 px-3 py-2 font-semibold ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-white"}`}>Previous</Link><span className="px-2 text-xs font-bold">Page {page} of {pages}</span><Link aria-disabled={page >= pages} href={`/swx-command-centre/audit?${new URLSearchParams({ q, action, target_type: targetType, page: String(Math.min(pages,page+1)) }).toString()}`} className={`rounded-lg border border-slate-200 px-3 py-2 font-semibold ${page >= pages ? "pointer-events-none opacity-40" : "hover:bg-white"}`}>Next</Link></div></div>
  </section>;
}
