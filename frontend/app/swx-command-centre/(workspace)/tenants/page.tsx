import Link from "next/link";

import { VerificationActions } from "@/components/admin/admin-actions";
import { adminAPI } from "@/lib/admin-server";
import type { VerificationList } from "@/lib/admin";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export default async function TenantGovernancePage({ searchParams }: Props) {
  const params = await searchParams;
  const status = first(params.status) ?? "pending";
  const page = Math.max(1, Number(first(params.page) ?? "1") || 1);
  const data = await adminAPI<VerificationList>(`/api/v1/admin/company-verifications?status=${encodeURIComponent(status)}&page=${page}&limit=25`);
  const pages = Math.max(1, Math.ceil(data.total / data.limit));

  return (
    <section className="space-y-5">
      <div className="rounded-[1.5rem] border border-[#dfe4f0] bg-white p-6 shadow-[0_14px_45px_rgba(23,37,84,0.05)] sm:p-8"><p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#5262c9]">Tenant governance</p><div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><h1 className="text-3xl font-bold tracking-[-0.04em] text-slate-950">Recruiter verification</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">Review registered employers before their recruiters can access the hiring workspace.</p></div><div className="flex gap-2">{["pending","approved","rejected"].map((value) => <Link key={value} href={`/swx-command-centre/tenants?status=${value}`} className={`rounded-full px-3 py-2 text-xs font-bold capitalize ${status === value ? "bg-[#5262c9] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{value}</Link>)}</div></div></div>

      <div className="overflow-x-auto rounded-[1.35rem] border border-[#e1e5ef] bg-white shadow-[0_10px_30px_rgba(23,37,84,0.04)]">
        <table className="min-w-[980px] w-full border-collapse text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-4 py-3">Company</th><th className="px-4 py-3">Recruiter</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Document</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead>
          <tbody>{data.items.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">No {status} verification records.</td></tr> : data.items.map((item) => <tr key={item.id} className="border-t border-slate-100 align-middle hover:bg-slate-50/60"><td className="px-4 py-3.5"><p className="font-bold text-slate-950">{item.company_name}</p><p className="mt-1 text-xs text-slate-400">{item.company_id}</p></td><td className="px-4 py-3.5 font-mono text-xs text-slate-600">{item.recruiter_user_id}</td><td className="px-4 py-3.5 text-slate-600">{new Date(item.created_at).toLocaleString("en-IN")}</td><td className="px-4 py-3.5">{item.registration_doc_url ? <a href={item.registration_doc_url} target="_blank" rel="noopener noreferrer" className="font-bold text-[#5262c9] hover:underline">Open document ↗</a> : <span className="text-slate-400">Not supplied</span>}</td><td className="px-4 py-3.5"><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] ${item.status === "approved" ? "bg-emerald-50 text-emerald-700" : item.status === "rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{item.status}</span></td><td className="px-4 py-3.5">{item.status === "pending" ? <VerificationActions verificationID={item.id} /> : <span className="text-xs text-slate-400">Reviewed</span>}</td></tr>)}</tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500"><span>{data.total.toLocaleString("en-IN")} records</span><div className="flex items-center gap-2"><Link aria-disabled={page <= 1} href={`/swx-command-centre/tenants?status=${status}&page=${Math.max(1,page-1)}`} className={`rounded-lg border border-slate-200 px-3 py-2 font-semibold ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-white"}`}>Previous</Link><span className="px-2 text-xs font-bold">Page {page} of {pages}</span><Link aria-disabled={page >= pages} href={`/swx-command-centre/tenants?status=${status}&page=${Math.min(pages,page+1)}`} className={`rounded-lg border border-slate-200 px-3 py-2 font-semibold ${page >= pages ? "pointer-events-none opacity-40" : "hover:bg-white"}`}>Next</Link></div></div>
    </section>
  );
}
