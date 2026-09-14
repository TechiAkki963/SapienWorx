import Link from "next/link";

import { UserModerationActions } from "@/components/admin/admin-actions";
import { adminAPI } from "@/lib/admin-server";
import type { AdminUserList } from "@/lib/admin";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export default async function AdminUsersPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = first(params.q) ?? "";
  const role = first(params.role) ?? "";
  const status = first(params.status) ?? "";
  const page = Math.max(1, Number(first(params.page) ?? "1") || 1);
  const query = new URLSearchParams({ page: String(page), limit: "25" });
  if (q) query.set("q", q);
  if (role) query.set("role", role);
  if (status) query.set("status", status);
  const data = await adminAPI<AdminUserList>(`/api/v1/admin/users?${query.toString()}`);
  const pages = Math.max(1, Math.ceil(data.total / data.limit));

  const pageHref = (target: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (role) next.set("role", role);
    if (status) next.set("status", status);
    next.set("page", String(target));
    return `/swx-command-centre/users?${next.toString()}`;
  };

  return (
    <section className="space-y-5">
      <div className="rounded-[1.5rem] border border-[#dfe4f0] bg-white p-6 shadow-[0_14px_45px_rgba(23,37,84,0.05)] sm:p-8"><p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#5262c9]">Users & moderation</p><h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950">Account governance</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">Find candidates or recruiters by identity fields, inspect verification state, and perform audited moderation actions.</p></div>

      <form className="grid gap-3 rounded-[1.3rem] border border-[#e1e5ef] bg-white p-4 shadow-[0_8px_28px_rgba(23,37,84,0.035)] md:grid-cols-[minmax(0,1fr)_12rem_12rem_auto]" action="/swx-command-centre/users">
        <input name="q" defaultValue={q} placeholder="Search name, email or phone" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-indigo-300 focus:bg-white focus:ring-3 focus:ring-indigo-100" />
        <select name="role" defaultValue={role} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-3 focus:ring-indigo-100"><option value="">All roles</option><option value="candidate">Candidate</option><option value="recruiter">Recruiter</option><option value="master_admin">Master Admin</option></select>
        <select name="status" defaultValue={status} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-3 focus:ring-indigo-100"><option value="">All statuses</option><option value="active">Active</option><option value="pending_verification">Pending verification</option><option value="suspended">Suspended</option><option value="disabled">Disabled</option></select>
        <button className="h-10 rounded-xl bg-[#5262c9] px-4 text-sm font-bold text-white hover:bg-[#4655b8]">Apply filters</button>
      </form>

      <div className="overflow-x-auto rounded-[1.35rem] border border-[#e1e5ef] bg-white shadow-[0_10px_30px_rgba(23,37,84,0.04)]">
        <table className="min-w-[1180px] w-full border-collapse text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Verification</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Actions</th></tr></thead><tbody>{data.items.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">No users match these filters.</td></tr> : data.items.map((user) => <tr key={user.id} className="border-t border-slate-100 align-middle hover:bg-slate-50/60"><td className="px-4 py-3.5"><p className="font-bold text-slate-950">{user.name || "Unnamed account"}</p><p className="mt-1 font-mono text-[10px] text-slate-400">{user.id}</p></td><td className="px-4 py-3.5"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-indigo-700">{user.role.replace("_", " ")}</span></td><td className="px-4 py-3.5"><p className="font-semibold text-slate-700">{user.email}</p><p className="mt-1 text-xs text-slate-500">{user.phone ?? "No phone"}</p></td><td className="px-4 py-3.5"><div className="flex gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${user.email_verified_at ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>Email</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${user.phone_verified_at ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>Phone</span>{user.force_password_reset && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">Reset required</span>}</div></td><td className="px-4 py-3.5"><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] ${user.status === "active" ? "bg-emerald-50 text-emerald-700" : user.status === "suspended" ? "bg-amber-50 text-amber-800" : user.status === "disabled" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>{user.status.replace("_", " ")}</span></td><td className="px-4 py-3.5 text-xs text-slate-500">{new Date(user.created_at).toLocaleDateString("en-IN")}</td><td className="px-4 py-3.5"><UserModerationActions userID={user.id} disabled={user.role === "master_admin"} /></td></tr>)}</tbody></table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500"><span>{data.total.toLocaleString("en-IN")} users</span><div className="flex items-center gap-2"><Link href={pageHref(Math.max(1,page-1))} className={`rounded-lg border border-slate-200 px-3 py-2 font-semibold ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-white"}`}>Previous</Link><span className="px-2 text-xs font-bold">Page {page} of {pages}</span><Link href={pageHref(Math.min(pages,page+1))} className={`rounded-lg border border-slate-200 px-3 py-2 font-semibold ${page >= pages ? "pointer-events-none opacity-40" : "hover:bg-white"}`}>Next</Link></div></div>
    </section>
  );
}