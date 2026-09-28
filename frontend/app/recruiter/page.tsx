import Link from "next/link";

import { DashboardProfileCard } from "@/components/ui/dashboard-profile-card";
import { LocalTimeGreeting } from "@/components/ui/local-time-greeting";
import { MetricStrip } from "@/components/recruiter/metric-strip";
import { CompactApplicantCards } from "@/components/recruiter/applicant-card-workspace";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { RecruiterDashboard } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

function urgency(kind: string) {
  const value = kind.toLowerCase();
  if (value.includes("deadline") || value.includes("expired")) return { bar: "bg-rose-500", icon: "!", surface: "bg-rose-50/45" };
  if (value.includes("stalled") || value.includes("age")) return { bar: "bg-amber-400", icon: "↗", surface: "bg-amber-50/45" };
  if (value.includes("messages")) return { bar: "bg-violet-500", icon: "✉", surface: "bg-violet-50/45" };
  if (value.includes("new_applications")) return { bar: "bg-emerald-500", icon: "+", surface: "bg-emerald-50/45" };
  return { bar: "bg-indigo", icon: "•", surface: "bg-blue-50/35" };
}

function interviewTime(value: string) {
  return `${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value))} IST`;
}

export default async function RecruiterDashboardPage() {
  const session = await requireRole("recruiter");
  const data = await recruiterAPI<RecruiterDashboard>("/api/v1/recruiter/dashboard");
  const firstName = data.recruiter_name.split(" ")[0];
  const headline = session.headline || `Talent Acquisition @ ${data.company_name}`;

  return (
    <RecruiterShell>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
        <section className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3 lg:grid-cols-4">
          <DashboardProfileCard compact className="col-span-1 h-full" firstName={session.first_name || firstName || "Recruiter"} lastName={session.last_name} headline={headline} imageUrl={session.profile_image_url} statLabel="Active roles" statValue={data.active_jobs} />
          <div className="relative col-span-1 flex h-full flex-col rounded-2xl border border-line/70 bg-white p-6 shadow-[0_1px_3px_rgba(16,33,63,0.04)] md:col-span-2 lg:col-span-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex h-full flex-col justify-center pr-0 lg:pr-64">
              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-blue-600">{data.company_name}</span>
                <h1 className="mt-1.5 text-3xl font-extrabold text-slate-900"><LocalTimeGreeting firstName={session.first_name || firstName} />.</h1>
                <p className="mt-2 text-sm text-slate-500">Hiring workspace. Here&apos;s what needs movement today.</p>
              </div>
              <div className="mt-4 flex items-center gap-3 lg:absolute lg:right-6 lg:top-[15px] lg:mt-0">
                <Link href="/recruiter/jobs" className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50">Manage jobs</Link>
                <Link href="/recruiter/jobs/new" className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700">+ Post a job</Link>
              </div>
            </div>
          </div>
        </section>

        <MetricStrip items={[
          { label: "Active jobs", value: data.active_jobs, hint: "live", href: "/recruiter/jobs?status=active" },
          { label: "Total applications", value: data.applications, href: "/recruiter/pipeline" },
          { label: "New applications", value: data.new_applications, href: "/recruiter/pipeline?stage=new_application" },
          { label: "Shortlisted", value: data.shortlisted, href: "/recruiter/pipeline?stage=shortlisted" },
          { label: "Interviews", value: data.upcoming_interviews, hint: "upcoming", href: "/recruiter/interviews?status=upcoming" },
          { label: "Offers", value: data.offers, href: "/recruiter/pipeline?stage=offer" },
          { label: "Hired", value: data.hires, href: "/recruiter/pipeline?stage=hired" },
        ]} />

        <section className="rounded-2xl border border-line/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,33,63,0.03)] sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Priority queue</p>
              <h2 className="mt-1 text-lg font-bold text-navy">Needs attention</h2>
              <p className="mt-1 text-xs text-ink-muted">Open each queue to work on the exact candidates, conversations or jobs involved.</p>
            </div>
            <Link href="/recruiter/pipeline" className="text-xs font-bold text-indigo hover:underline">Review pipeline →</Link>
          </div>
          {data.needs_attention.length ? (
            <div className="mt-4 grid gap-2 xl:grid-cols-2">
              {data.needs_attention.map((item) => {
                const tone = urgency(item.kind);
                return (
                  <Link href={item.href} key={`${item.kind}-${item.title}`} className={`group relative overflow-hidden rounded-xl border border-line/70 p-3.5 transition hover:border-indigo/25 ${tone.surface}`}>
                    <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden="true" />
                    <div className="flex items-start gap-3 pl-1">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-extrabold text-ink shadow-sm">{tone.icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-ink">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-ink-muted">{item.detail}</p>
                      </div>
                      <span className="ml-auto text-sm font-bold text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-indigo">→</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-emerald-700">✓</span>
              <p className="text-sm font-medium text-emerald-900">No open application, message, offer or deadline queues need attention right now.</p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-line/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,33,63,0.03)] sm:p-5" aria-labelledby="upcoming-interviews-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Next on the calendar</p>
              <h2 id="upcoming-interviews-heading" className="mt-1 text-lg font-bold text-navy">Upcoming interviews</h2>
            </div>
            <Link href="/recruiter/interviews" className="text-xs font-bold text-indigo hover:underline">View all interviews →</Link>
          </div>
          {data.upcoming_items.length ? (
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {data.upcoming_items.map((interview) => (
                <Link key={interview.id} href={`/recruiter/interviews?interview_id=${encodeURIComponent(interview.id)}`} className="rounded-xl border border-line/70 bg-slate-50/65 p-3.5 transition hover:border-indigo/30 hover:bg-indigo-50/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo">
                  <time dateTime={interview.scheduled_at} className="text-xs font-extrabold text-indigo">{interviewTime(interview.scheduled_at)}</time>
                  <p className="mt-2 text-sm font-bold text-navy">{interview.candidate_name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{interview.job_title}</p>
                  <span className="mt-3 inline-block text-xs font-bold text-indigo">Open interview →</span>
                </Link>
              ))}
            </div>
          ) : <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-5 text-sm text-ink-muted">No interviews are scheduled yet.</p>}
        </section>

        <section className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Latest movement</p>
              <h2 className="mt-1 text-lg font-bold text-navy">Recent applications</h2>
              <p className="mt-1 text-xs text-ink-muted">A compact view of the newest candidate activity across open roles.</p>
            </div>
            <Link href="/recruiter/pipeline" className="text-xs font-bold text-indigo hover:underline">Open full pipeline →</Link>
          </div>
          <CompactApplicantCards rows={data.recent_applications.slice(0, 6)} />
        </section>
      </div>
    </RecruiterShell>
  );
}
