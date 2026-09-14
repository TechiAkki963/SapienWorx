import Image from "next/image";
import Link from "next/link";

import { MetricStrip } from "@/components/recruiter/metric-strip";
import { PipelineTable } from "@/components/recruiter/pipeline-table";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { RecruiterDashboard } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic = "force-dynamic";

function urgency(kind: string) {
  const value = kind.toLowerCase();
  if (value.includes("deadline") || value.includes("expired")) return { bar: "bg-rose-500", icon: "!", surface: "bg-rose-50/45" };
  if (value.includes("stalled") || value.includes("age")) return { bar: "bg-amber-400", icon: "↗", surface: "bg-amber-50/45" };
  return { bar: "bg-indigo", icon: "•", surface: "bg-blue-50/35" };
}

export default async function RecruiterDashboardPage() {
  await requireRole("recruiter");
  const data = await recruiterAPI<RecruiterDashboard>("/api/v1/recruiter/dashboard");
  const firstName = data.recruiter_name.split(" ")[0];

  return (
    <RecruiterShell>
      <div className="grid gap-5">
        <section className="grid gap-4 rounded-2xl border border-[#dedcf0] bg-[linear-gradient(120deg,#ffffff_0%,#f7f3ff_48%,#eef9f3_100%)] p-4 shadow-[0_8px_28px_rgba(41,55,89,0.06)] sm:p-5 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-center">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-indigo">{data.company_name}</p>
              <h1 className="mt-1.5 text-2xl font-bold tracking-[-0.04em] text-navy sm:text-[2rem]">Hiring workspace</h1>
              <p className="mt-1 text-sm text-ink-muted">Welcome back, {firstName}. Here&apos;s what needs movement today.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/recruiter/jobs" className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink shadow-sm transition hover:bg-slate-50">Manage jobs</Link>
              <Link href="/recruiter/jobs/new" className="rounded-xl bg-indigo px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-ink">+ Post a job</Link>
            </div>
          </div>

          <div className="relative hidden h-28 overflow-hidden rounded-[34%_66%_60%_40%/45%_38%_62%_55%] xl:block">
            <Image
              src="/images/people/recruiter-review.webp"
              alt="Recruiter reviewing hiring work in a modern office"
              fill
              sizes="18rem"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-violet-100/16 via-transparent to-emerald-100/16 mix-blend-overlay" aria-hidden="true" />
          </div>
        </section>

        <MetricStrip items={[
          { label: "Active jobs", value: data.active_jobs, hint: "live" },
          { label: "Applications", value: data.applications },
          { label: "Shortlisted", value: data.shortlisted },
          { label: "Interviews", value: data.upcoming_interviews, hint: "upcoming" },
          { label: "Offers", value: data.offers, emphasis: "outcome" },
          { label: "Hires", value: data.hires, emphasis: "outcome" },
          { label: "Placement rate", value: `${data.placement_rate.toFixed(1)}%`, emphasis: "outcome" },
        ]} />

        <section className="rounded-2xl border border-line/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,33,63,0.03)] sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Priority queue</p>
              <h2 className="mt-1 text-lg font-bold text-navy">Needs attention</h2>
              <p className="mt-1 text-xs text-ink-muted">Ageing applications and time-sensitive vacancies surfaced for action.</p>
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
              <p className="text-sm font-medium text-emerald-900">No ageing candidates or near-term job deadlines need attention right now.</p>
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink-muted">Latest movement</p>
              <h2 className="mt-1 text-lg font-bold text-navy">Recent applications</h2>
              <p className="mt-1 text-xs text-ink-muted">A compact view of the newest candidate activity across open roles.</p>
            </div>
            <Link href="/recruiter/pipeline" className="text-xs font-bold text-indigo hover:underline">Open full pipeline →</Link>
          </div>
          <PipelineTable rows={data.recent_applications.slice(0, 6)} compact />
        </section>
      </div>
    </RecruiterShell>
  );
}
