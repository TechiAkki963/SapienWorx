import Link from "next/link";

import { DashboardProfileCard } from "@/components/ui/dashboard-profile-card";
import { requireAdminWorkspace } from "@/lib/admin-access-server";
import { canAdmin } from "@/lib/admin-access";
import { adminAPI, AdminBackendError } from "@/lib/admin-server";
import type { AdminDashboard } from "@/lib/admin";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const number = (value: number) => value.toLocaleString("en-IN");
const surface = "min-w-0 rounded-2xl border border-[#e1e5ef] bg-white p-5 shadow-[0_10px_28px_rgba(55,65,140,0.055)]";
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

function MetricCard({ label, value, note, href }: { label: string; value: number; note: string; href?: string }) {
  const body = <><h3 className="text-xs font-bold text-slate-600">{label}</h3><p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{number(value)}</p><p className="mt-2 text-xs leading-5 text-slate-500">{note}</p>{href && <span className="mt-3 block text-xs font-bold text-[#5262c9]">View records →</span>}</>;
  return href ? <Link aria-label={label + ": " + number(value) + ". View records"} href={href} className={surface + " transition hover:border-indigo-300 " + focus}>{body}</Link> : <article className={surface}>{body}</article>;
}

export default async function CommandCentreOverviewPage({ searchParams }: Props) {
  const { user: session, access } = await requireAdminWorkspace("overview.read");
  const params = await searchParams;
  const period = first(params.period) || "7d";
  const from = first(params.from) || "";
  const to = first(params.to) || "";
  const company = first(params.company_id) || "", country = first(params.country) || "";
  const query = new URLSearchParams({ period, from, to,company_id:company,country });
  const scopedHref = (path:string,extra:Record<string,string>={}) => { const q=new URLSearchParams(extra); if(company) q.set("company_id",company); if(country) q.set("country",country); return path+(q.size?"?"+q:""); };
  let data: AdminDashboard | null = null;
  let unavailable = false;
  let invalid = false;
  try {
    data = await adminAPI<AdminDashboard>("/api/v1/admin/dashboard?" + query.toString());
  } catch (error) {
    if (error instanceof AdminBackendError && error.status === 400) invalid = true;
    else if (error instanceof AdminBackendError && error.status < 500) throw error;
    else unavailable = true;
  }
  const today = new Date().toISOString().slice(0, 10);
  const usersHref = canAdmin(access, "users.read") ? "/swx-command-centre/users" : undefined;
  const jobsHref = canAdmin(access, "jobs.read") ? "/swx-command-centre/jobs" : undefined;
  const companiesHref = canAdmin(access, "organizations.read") ? scopedHref("/swx-command-centre/tenants",{status:"pending"}) : undefined;
  const recruitment = canAdmin(access,"recruitment.read");
  const queues = data ? [
    { title: "Company reviews", count: data.pending_company_reviews, note: "Pending registrations, oldest first.", href: companiesHref },
    { title: "Accounts awaiting verification", count: data.pending_accounts, note: "Pending status; do not bypass email verification.", href: usersHref ? scopedHref(usersHref,{status:"pending_verification"}) : undefined },
    { title: "Draft jobs", count: data.draft_jobs, note: "Unpublished vacancies for operational review.", href: jobsHref ? scopedHref(jobsHref,{status:"draft"}) : undefined },
  ].filter((queue) => Boolean(queue.href)) : [];

  return <section className="min-w-0 space-y-6">
    <div className="grid items-stretch gap-5 sm:grid-cols-[16rem_minmax(0,1fr)]">
      <DashboardProfileCard firstName={session.first_name || "Master"} lastName={session.last_name} headline="Admin" imageUrl={session.profile_image_url} statLabel="Session" statValue="Active" className="[&>div:first-child]:h-full [&>div:first-child]:min-h-56 [&>div:first-child]:max-w-none [&>div:first-child]:aspect-auto" />
      <header className={surface + " flex flex-col justify-between gap-5 sm:p-7"}>
        <div><p className="text-xs font-bold uppercase tracking-wider text-[#5262c9]">Master Admin · Platform overview</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Platform command centre</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">Understand platform activity and move directly to the work that needs a review. Counts never grant access to private records.</p></div>
        <p className="text-xs leading-5 text-slate-500">{data ? "Database snapshot · " + new Date(data.computed_at).toLocaleString("en-IN", { timeZone: "UTC" }) + " UTC" : "Database snapshot not available"}. Refresh this page for updated counts.</p>
      </header>
    </div>

    <section aria-labelledby="activity-filter-title" className={surface}>
      <h2 id="activity-filter-title" className="font-bold text-slate-900">Activity reporting window</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">Dates use UTC and change activity figures only. Organization/country filters change the recruitment cohort across totals and activity. Country means registered organization country; scoped candidates are applicants to those organizations. Privacy and security totals remain platform-wide.</p>
      <form action="/swx-command-centre/overview" className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-600">Period<select aria-label="Period" name="period" defaultValue={period} className={"h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm " + focus}><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="month">Current month</option><option value="quarter">Current quarter</option><option value="custom">Custom dates</option></select></label>
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-600">From (custom only)<input name="from" type="date" max={today} defaultValue={from} className={"box-border h-11 w-full min-w-0 rounded-xl border border-slate-200 px-3 text-sm " + focus} /></label>
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-600">Through (custom only)<input name="to" type="date" max={today} defaultValue={to} className={"box-border h-11 w-full min-w-0 rounded-xl border border-slate-200 px-3 text-sm " + focus} /></label>
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-600">Organization ID<input name="company_id" maxLength={36} defaultValue={company} placeholder="Optional organization UUID" className={"h-11 w-full min-w-0 rounded-xl border border-slate-200 px-3 text-sm "+focus}/></label>
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-600">Organization country<input name="country" maxLength={2} pattern="[A-Za-z]{2}" defaultValue={country} placeholder="e.g. IN" className={"h-11 w-full min-w-0 rounded-xl border border-slate-200 px-3 text-sm uppercase "+focus}/></label>
        <button className={"h-11 self-end rounded-xl bg-[#5262c9] px-5 text-sm font-bold text-white hover:bg-[#4655b8] " + focus}>Apply window</button>
      </form>
      {invalid && <p role="alert" aria-label="Invalid reporting window" className="mt-4 text-sm text-red-700">Choose a supported period or valid custom dates, in order, no later than today and spanning at most 366 days. Organization IDs must be UUIDs and countries must be two-letter codes.</p>}
    </section>

    {unavailable && <div role="alert" aria-label="Dashboard data unavailable" className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">Dashboard data unavailable</h2><p className="mt-2 text-sm leading-6 text-amber-900">The database snapshot could not be loaded. No zero counts or healthy status are assumed. Refresh to retry; your access restrictions remain in place.</p></div>}

    {data && <>
      <section aria-labelledby="snapshot-title"><div className="mb-3"><h2 id="snapshot-title" className="text-lg font-bold text-slate-900">Current platform totals</h2><p className="mt-1 text-xs text-slate-500">Snapshot counts across all dates. Linked cards open the matching management filter.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Registered users" value={data.registered_users} note="All statuses in the selected cohort; platform-wide when unfiltered." href={usersHref?scopedHref(usersHref):undefined} />
          <MetricCard label="Candidates" value={data.candidates} note="All statuses; scoped counts include applicants to the selected organizations." href={usersHref ? scopedHref(usersHref,{role:"candidate"}) : undefined} />
          <MetricCard label="Recruiters" value={data.recruiters} note="Associated recruiters in the selected cohort, all statuses." href={usersHref ? scopedHref(usersHref,{role:"recruiter"}) : undefined} />
          <MetricCard label="Published jobs" value={data.published_jobs} note="Active job status, including past deadlines." href={jobsHref ? scopedHref(jobsHref,{status:"active"}) : undefined} />
        </div>
        <dl className={surface + " mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-4"}>
          {[
            ["Organizations", data.organizations, "Company records in this cohort; no organization activity status is tracked.",canAdmin(access,"organizations.read")?"/swx-command-centre/organizations?"+new URLSearchParams({q:company,country}):undefined],
            ["Verified recruiters", data.verified_recruiters, "Verified recruiter profiles, including suspended accounts."],
            ["Applications", data.applications, "Distinct candidate–job applications; not unique candidates.",recruitment?scopedHref("/swx-command-centre/applications"):undefined],
            ["Upcoming interviews", data.scheduled_interviews, "Scheduled and not in the past; not completed interviews.",recruitment?scopedHref("/swx-command-centre/interviews",{upcoming:"true"}):undefined],
            ["Offer-stage applications", data.offer_stage_applications, "Currently in offer stage; not historical offers issued.",recruitment?scopedHref("/swx-command-centre/applications",{stage:"offer"}):undefined],
            ["Hired-stage applications", data.hired_stage_applications, "Currently in hired stage; not an all-time hires ledger.",recruitment?scopedHref("/swx-command-centre/applications",{stage:"hired"}):undefined],
            ["Open privacy requests", data.pending_privacy_requests, "Platform-wide: received, in progress or awaiting review."],
            ["Open privacy incidents", data.open_privacy_incidents, "Platform-wide: incident register excluding closed cases; not automated threat detection."],
          ].map(([label, value, note,href]) => <div key={String(label)}><dt className="text-xs font-semibold text-slate-600">{label}</dt><dd className="mt-1 text-xl font-bold text-slate-950">{number(Number(value))}</dd><dd className="mt-1 text-xs leading-5 text-slate-500">{note}</dd>{typeof href==="string"&&<dd className="mt-3"><Link className={"text-xs font-bold text-indigo-600 "+focus} aria-label={`${label}: ${number(Number(value))}. View records`} href={href}>View records →</Link></dd>}</div>)}
        </dl>
        <p className="mt-2 text-xs leading-5 text-slate-500">Read-only aggregates without drill-down stay unlinked until a scoped management workspace is available.</p>
      </section>

      <section aria-labelledby="activity-title"><h2 id="activity-title" className="text-lg font-bold text-slate-900">Activity in this window</h2><p className="mt-1 text-xs leading-5 text-slate-500">{new Date(data.from).toLocaleString("en-IN", { timeZone: "UTC" })} to {new Date(data.to).toLocaleString("en-IN", { timeZone: "UTC" })} UTC · start inclusive, end exclusive</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="New accounts" value={data.new_users} note="Account registration timestamp." />
          <MetricCard label="Jobs published" value={data.jobs_published} note="Stored publication timestamp, regardless of current status." />
          <MetricCard label="New applications" value={data.new_applications} note="Application submission timestamp." href={recruitment?scopedHref("/swx-command-centre/applications",{from:data.from,before:data.to}):undefined}/>
          <MetricCard label="Active InMail conversations" value={data.active_conversations} note="Distinct threads with a persisted message; not online users or confirmed email deliveries." />
        </div>
      </section>

      <section aria-labelledby="attention-title" className={surface}>
        <div className="flex flex-wrap items-end justify-between gap-2"><h2 id="attention-title" className="text-lg font-bold text-slate-900">Needs attention</h2><p className="text-xs text-slate-500">Read-only queues · only within your scope</p></div>
        {queues.length === 0 ? <p className="mt-4 text-sm leading-6 text-slate-500">Your role can read this overview, but no detailed operational queue is granted. No private records have been fetched.</p> : <div className="mt-4 grid gap-3 md:grid-cols-2">{queues.map((queue) => <Link key={queue.title} href={queue.href!} className={"flex min-w-0 items-start justify-between gap-4 rounded-xl border border-slate-200 p-4 hover:border-indigo-300 hover:bg-indigo-50/30 " + focus}><div className="min-w-0"><h3 className="text-sm font-bold text-slate-900">{queue.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{queue.note}</p><span className="mt-2 block text-xs font-bold text-[#5262c9]">Open filtered queue →</span></div><span className={"shrink-0 rounded-full px-3 py-1 text-sm font-bold " + (queue.count > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800")}>{number(queue.count)}</span></Link>)}</div>}
      </section>
    </>}

    <section aria-labelledby="coverage-title" className="rounded-2xl border border-[#d9def3] bg-[#f4f5ff] p-5">
      <h2 id="coverage-title" className="font-bold text-slate-900">Monitoring coverage</h2><p className="mt-2 text-sm leading-6 text-slate-600">Database counts are not a production health verdict. AWS charges, SES delivery events, CV parser telemetry, running release versions and backup/restore evidence are not connected to this overview yet.</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">No cloud spend estimate or “all systems healthy” badge is fabricated. The USD 50 AWS Budget is not a hard spending cap.</p>
      {canAdmin(access, "system.read") && <Link href="/swx-command-centre/system" className={"mt-3 inline-block text-sm font-bold text-[#5262c9] " + focus}>Inspect system health →</Link>}
    </section>
  </section>;
}
