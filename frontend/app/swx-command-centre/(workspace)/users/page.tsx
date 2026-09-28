import Link from "next/link";
import { AccountLifecycleActions } from "@/components/admin/account-lifecycle-actions";
import { adminAPI } from "@/lib/admin-server";
import { requireAdminWorkspace } from "@/lib/admin-access-server";
import { canAdmin } from "@/lib/admin-access";
import type { AdminUser, AdminUserList } from "@/lib/admin";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString("en-IN", { timeZone: "UTC" }) : "Not recorded";
function Status({ user }: { user: AdminUser }) {
  return <div className="flex flex-wrap gap-1.5"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${user.status === "active" ? "bg-emerald-50 text-emerald-800" : user.status === "suspended" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{user.status.replaceAll("_", " ")}</span>{user.is_active === false && <span className="text-xs font-bold text-red-700">Inactive record</span>}{user.force_password_reset && <span className="text-xs font-bold text-amber-800">Reset required</span>}</div>;
}
function Verification({ user }: { user: AdminUser }) {
  return <div className="space-y-1 text-xs text-slate-600"><p>Email: {user.email_verified_at ? "Verified" : "Unverified"}</p>{user.role === "recruiter" && <p>Recruiter: {user.recruiter_verification || "Not recorded"}</p>}</div>;
}
export default async function AdminUsersPage({ searchParams }: Props) {
  const { access } = await requireAdminWorkspace("users.read");
  const params = await searchParams;
  const q = first(params.q) ?? "", role = first(params.role) ?? "", status = first(params.status) ?? "", company = first(params.company_id) ?? "";
  const country=first(params.country)||"";
  const page = Math.max(1, Math.floor(Number(first(params.page) ?? "1")) || 1);
  const query = new URLSearchParams({ page: String(page), limit: "25" });
  if (q) query.set("q", q); if (role) query.set("role", role); if (status) query.set("status", status); if (company) query.set("company_id", company);
  if(country) query.set("country",country);
  const data = await adminAPI<AdminUserList>(`/api/v1/admin/users?${query}`);
  const pages = Math.max(1, Math.ceil(data.total / data.limit));
  const href = (target: number) => { const next = new URLSearchParams(query); next.delete("limit"); next.set("page", String(target)); return `/swx-command-centre/users?${next}`; };
  return <section className="min-w-0 space-y-5">
    <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Users & moderation</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Account governance</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">Search identity records, check account verification, and apply justified, audited actions. Administrative accounts and inactive records are protected. Dates are shown in UTC.</p>{company && <p className="mt-3 break-all text-xs text-slate-600">Organization filter: {company} · <Link href="/swx-command-centre/users" className="font-bold text-indigo-600 underline">Clear filter</Link></p>}</header>
    <form action="/swx-command-centre/users" className="grid min-w-0 gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_10rem_12rem_auto]">
      {company && <input type="hidden" name="company_id" value={company} />}
      {country && <input type="hidden" name="country" value={country}/>}
      {(company||country)&&<p className="break-all text-xs leading-5 text-slate-500 md:col-span-2 xl:col-span-4">Cohort: {company||"all organizations"} · country {country||"all"}. Candidate matches are applicants to this cohort; not candidates residing in that country. <Link href="/swx-command-centre/users" className="font-bold text-indigo-600 underline">Clear cohort</Link></p>}
      <label className="grid min-w-0 gap-1 text-xs font-bold text-slate-600">Search accounts<input name="q" maxLength={200} defaultValue={q} placeholder="User ID, name, email or phone" className="h-10 w-full min-w-0 rounded-xl border border-slate-200 px-3 text-sm font-normal" /></label>
      <label className="grid min-w-0 gap-1 text-xs font-bold text-slate-600">Role<select aria-label="Role" name="role" defaultValue={role} className="h-10 w-full min-w-0 rounded-xl border border-slate-200 px-3 text-sm font-normal"><option value="">All roles</option><option value="candidate">Candidate</option><option value="recruiter">Recruiter</option><option value="master_admin">Master Admin</option></select></label>
      <label className="grid min-w-0 gap-1 text-xs font-bold text-slate-600">Account status<select aria-label="Account status" name="status" defaultValue={status} className="h-10 w-full min-w-0 rounded-xl border border-slate-200 px-3 text-sm font-normal"><option value="">All statuses</option>{["active", "pending_verification", "suspended", "disabled"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      <button className="h-10 self-end rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white">Apply filters</button>
    </form>
    <p className="text-xs leading-6 text-slate-500">Reactivation is limited to suspended, email-verified accounts with required recruiter/company approvals. It never clears a forced password reset or restores old sessions. Disabled accounts need a separate review.</p>
    <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white lg:block"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Account", "Role / organization", "Verification", "Status", "Activity (UTC)", "Actions"].map((title) => <th key={title} scope="col" className="px-4 py-3">{title}</th>)}</tr></thead><tbody>{data.items.map((user) => <tr key={user.id} className="border-t border-slate-100 align-top"><td className="px-4 py-4"><p className="font-bold text-slate-900">{user.name || "Unnamed account"}</p><p className="mt-1 break-all text-xs text-slate-600">{user.email}</p><p className="mt-1 font-mono text-[10px] text-slate-500">{user.id}</p></td><td className="px-4 py-4"><p className="capitalize">{user.role.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-500">{user.company_name || "—"}</p></td><td className="px-4 py-4"><Verification user={user} /></td><td className="px-4 py-4"><Status user={user} /></td><td className="px-4 py-4 text-xs leading-6 text-slate-600"><p>Joined {date(user.created_at)}</p><p>Login {date(user.last_login_at)}</p></td><td className="w-80 px-4 py-4"><AccountLifecycleActions user={user} /></td></tr>)}</tbody></table></div>
    <div className="grid gap-3 lg:hidden">{data.items.map((user) => <article key={user.id} className="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-white p-4" aria-label={`Account ${user.name || user.id}`}><div><h2 className="font-bold text-slate-900">{user.name || "Unnamed account"}</h2><p className="mt-1 break-all text-sm text-slate-600">{user.email}</p><p className="mt-1 break-all font-mono text-xs text-slate-500">{user.id}</p></div><Status user={user} /><p className="text-sm capitalize text-slate-600">{user.role.replaceAll("_", " ")}{user.company_name ? ` · ${user.company_name}` : ""}</p><Verification user={user} /><p className="text-xs text-slate-500">Joined {date(user.created_at)} · Login {date(user.last_login_at)}</p><AccountLifecycleActions user={user} /></article>)}</div>
    {data.items.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No users match these filters.</p>}
    <footer className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><span>{data.total.toLocaleString("en-IN")} accounts</span><div className="flex flex-wrap items-center gap-2"><Link aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined} href={href(Math.max(1,page-1))} className={`rounded-lg border px-3 py-2 ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-white"}`}>Previous</Link><span className="text-xs">Page {page} of {pages}</span><Link aria-disabled={page >= pages} tabIndex={page >= pages ? -1 : undefined} href={href(Math.min(pages,page+1))} className={`rounded-lg border px-3 py-2 ${page >= pages ? "pointer-events-none opacity-40" : "hover:bg-white"}`}>Next</Link></div></footer>
    {canAdmin(access, "audit.read") && <Link href="/swx-command-centre/audit?target_type=user" className="inline-block text-sm font-bold text-indigo-600">Review account audit history →</Link>}
  </section>;
}
