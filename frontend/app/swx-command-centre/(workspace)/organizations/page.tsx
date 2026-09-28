import Link from "next/link";
import { adminAPI } from "@/lib/admin-server";
import { requireAdminWorkspace } from "@/lib/admin-access-server";
import { canAdmin } from "@/lib/admin-access";
import type { AdminOrganizationList } from "@/lib/admin";

type Props = { searchParams: Promise<Record<string,string|string[]|undefined>> };
const first = (value: string|string[]|undefined) => Array.isArray(value) ? value[0] : value;
export default async function OrganizationsPage({ searchParams }: Props) {
  const { access } = await requireAdminWorkspace("organizations.read");
  const params = await searchParams;
  const q = first(params.q) || "", verification = first(params.verification) || "", country = first(params.country) || "";
  const page = Math.max(1, Math.floor(Number(first(params.page) || 1)) || 1);
  const query = new URLSearchParams({ q, verification, country, page: String(page), limit: "25" });
  const data = await adminAPI<AdminOrganizationList>(`/api/v1/admin/organizations?${query}`);
  const pages = Math.max(1, Math.ceil(data.total/data.limit));
  const href = (target: number) => { const next = new URLSearchParams(query); next.delete("limit"); next.set("page", String(target)); return `/swx-command-centre/organizations?${next}`; };
  return <section className="min-w-0 space-y-5">
    <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Organization directory</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Organization governance</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">Inspect company identity and recruitment totals without opening candidate profiles, CVs, private messages or shared comments.</p><Link href="/swx-command-centre/tenants" className="mt-4 inline-block rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700">Open pending verification queue →</Link></header>
    <form action="/swx-command-centre/organizations" className="grid min-w-0 gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_11rem_8rem_auto]">
      <label className="grid min-w-0 gap-1 text-xs font-bold text-slate-600">Search organizations<input name="q" maxLength={200} defaultValue={q} placeholder="Name, domain or organization ID" className="h-10 w-full min-w-0 rounded-xl border border-slate-200 px-3 text-sm font-normal" /></label>
      <label className="grid min-w-0 gap-1 text-xs font-bold text-slate-600">Verification<select aria-label="Verification" name="verification" defaultValue={verification} className="h-10 w-full min-w-0 rounded-xl border border-slate-200 px-3 text-sm font-normal"><option value="">All verification states</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option></select></label>
      <label className="grid min-w-0 gap-1 text-xs font-bold text-slate-600">Country code<input name="country" maxLength={2} defaultValue={country} placeholder="e.g. IN" pattern="[A-Za-z]{2}" className="h-10 w-full min-w-0 rounded-xl border border-slate-200 px-3 text-sm font-normal uppercase" /></label>
      <button className="h-10 self-end rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white">Apply filters</button>
    </form>
    <p role="note" className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">Verification is not an organization-wide operational status. Organization suspension, merging and recruiter reassignment are not enabled here. Counts include all recruiter account statuses and all application stages; active jobs use stored active status, including past deadlines.</p>
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">{data.items.map((item) => <article key={item.id} aria-label={`Organization ${item.display_name}`} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h2 className="break-words text-lg font-bold text-slate-950">{item.display_name}</h2><p className="mt-1 break-words text-sm text-slate-500">{item.legal_name}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.verification_status === "verified" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{item.verification_status}</span></div>
      <p className="mt-3 break-all font-mono text-xs text-slate-500">{item.id}</p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Work-email domain</dt><dd className="mt-1 break-all text-slate-700">{item.work_email_domain || "Not provided"}</dd></div><div><dt className="text-xs text-slate-500">Country</dt><dd className="mt-1 text-slate-700">{item.country_code || "Not provided"}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-slate-500">Website (supplied by company)</dt><dd className="mt-1 break-all text-slate-700">{item.website_url || "Not provided"}</dd></div></dl>
      <dl className="mt-5 grid grid-cols-3 gap-2 border-y border-slate-100 py-4">{[["Recruiters", item.recruiters], ["Active jobs", item.active_jobs], ["Applications", item.applications]].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[11px] text-slate-500">{label}</dt><dd className="mt-1 text-xl font-bold text-slate-950">{Number(value).toLocaleString("en-IN")}</dd></div>)}</dl>
      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Registered {new Date(item.created_at).toLocaleDateString("en-IN", { timeZone: "UTC" })} UTC</p>{canAdmin(access, "users.read") && <Link href={`/swx-command-centre/users?role=recruiter&company_id=${encodeURIComponent(item.id)}`} className="text-sm font-bold text-indigo-600">View associated recruiters →</Link>}</footer>
    </article>)}</div>
    {data.items.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No organizations match these filters.</p>}
    <footer className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><span>{data.total.toLocaleString("en-IN")} organizations</span><div className="flex flex-wrap items-center gap-2"><Link aria-disabled={page<=1} tabIndex={page<=1 ? -1 : undefined} href={href(Math.max(1,page-1))} className={`rounded-lg border px-3 py-2 ${page<=1 ? "pointer-events-none opacity-40" : ""}`}>Previous</Link><span className="text-xs">Page {page} of {pages}</span><Link aria-disabled={page>=pages} tabIndex={page>=pages ? -1 : undefined} href={href(Math.min(pages,page+1))} className={`rounded-lg border px-3 py-2 ${page>=pages ? "pointer-events-none opacity-40" : ""}`}>Next</Link></div></footer>
  </section>;
}
