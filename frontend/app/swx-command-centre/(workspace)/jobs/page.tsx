import Link from "next/link";

import { JobTakedownButton } from "@/components/admin/admin-actions";
import { adminAPI } from "@/lib/admin-server";
import type { AdminJobList } from "@/lib/admin";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export default async function AdminJobsPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = first(params.q) ?? "";
  const status = first(params.status) ?? "";
  const page = Math.max(1, Number(first(params.page) ?? "1") || 1);
  const query = new URLSearchParams({ q, status, page: String(page), limit: "25" });
  const data = await adminAPI<AdminJobList>(`/api/v1/admin/jobs?${query.toString()}`);
  const pages = Math.max(1, Math.ceil(data.total / data.limit));

  return <section className="space-y-5">
    <div className="rounded-[1.5rem] border border-[#dfe4f0] bg-white p-6 shadow-[0_14px_45px_rgba(23,37,84,0.05)] sm:p-8">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#5262c9]">Content moderation</p>
      <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950">Job moderation</h1>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">Search by job title, company, or exact job ID. Takedowns are transactional and recorded in the immutable admin audit log.</p>
      <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_13rem_auto]">
        <input name="q" defaultValue={q} placeholder="Search title, company or job UUID" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-300 focus:ring-3 focus:ring-indigo-100" />
        <select name="status" defaultValue={status} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-300 focus:ring-3 focus:ring-indigo-100"><option value="">All statuses</option>{["active","draft","paused","closed","expired","archived"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <button className="h-10 rounded-xl bg-[#4656cf] px-4 text-sm font-bold text-white hover:bg-[#3948bd]">Search</button>
      </form>
    </div>

    <div className="overflow-x-auto rounded-[1.35rem] border border-[#e1e5ef] bg-white shadow-[0_10px_30px_rgba(23,37,84,0.04)]">
      <table className="min-w-[1050px] w-full border-collapse text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-4 py-3">Job</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Recruiter</th><th className="px-4 py-3">Mode / location</th><th className="px-4 py-3">Applications</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3">Action</th></tr></thead>
        <tbody>{data.items.length === 0 ? <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No jobs match these filters.</td></tr> : data.items.map((job) => <tr key={job.id} className="border-t border-slate-100 align-middle hover:bg-slate-50/60"><td className="px-4 py-3.5"><p className="font-bold text-slate-950">{job.title}</p><p className="mt-1 font-mono text-[10px] text-slate-400">{job.id}</p></td><td className="px-4 py-3.5"><p className="font-semibold text-slate-800">{job.company_name}</p></td><td className="px-4 py-3.5"><p className="font-medium text-slate-700">{job.recruiter_name}</p><p className="mt-1 font-mono text-[10px] text-slate-400">{job.recruiter_user_id}</p></td><td className="px-4 py-3.5 text-slate-600"><span className="capitalize">{job.work_mode}</span>{job.city ? ` · ${job.city}` : ""}</td><td className="px-4 py-3.5 font-bold text-slate-800">{job.application_count.toLocaleString("en-IN")}</td><td className="px-4 py-3.5"><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] ${job.status === "active" ? "bg-emerald-50 text-emerald-700" : job.status === "closed" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}>{job.status}</span></td><td className="px-4 py-3.5 text-xs text-slate-500">{new Date(job.updated_at).toLocaleString("en-IN")}</td><td className="px-4 py-3.5"><JobTakedownButton jobID={job.id} disabled={job.status === "closed" || job.status === "archived"} /></td></tr>)}</tbody>
      </table>
    </div>

    <div className="flex items-center justify-between text-sm text-slate-500"><span>{data.total.toLocaleString("en-IN")} jobs</span><div className="flex items-center gap-2"><Link aria-disabled={page <= 1} href={`/swx-command-centre/jobs?${new URLSearchParams({ q, status, page: String(Math.max(1,page-1)) }).toString()}`} className={`rounded-lg border border-slate-200 px-3 py-2 font-semibold ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-white"}`}>Previous</Link><span className="px-2 text-xs font-bold">Page {page} of {pages}</span><Link aria-disabled={page >= pages} href={`/swx-command-centre/jobs?${new URLSearchParams({ q, status, page: String(Math.min(pages,page+1)) }).toString()}`} className={`rounded-lg border border-slate-200 px-3 py-2 font-semibold ${page >= pages ? "pointer-events-none opacity-40" : "hover:bg-white"}`}>Next</Link></div></div>
  </section>;
}
