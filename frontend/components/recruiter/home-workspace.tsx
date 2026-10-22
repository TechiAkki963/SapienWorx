"use client";

import Link from "next/link";
import { CandidateCard, applicationCardSummary } from "./candidate-card";
import { CompactApplicantCards } from "./applicant-card-workspace";
import { RecruiterProductHeader } from "./recruiter-product-header";
import {
  RecruiterDataTable,
  WorkspaceState,
  recruiterPrimary,
  recruiterSecondary,
} from "./workspace-ui";
import { LocalTimeGreeting } from "@/components/ui/local-time-greeting";
import {
  compactDate,
  type RecruiterDashboard,
  type RecruiterJob,
} from "@/lib/recruiter";

function attentionAction(kind: string, href: string) {
  const value = `${kind} ${href}`.toLowerCase();
  if (value.includes("message")) return "Open messages";
  if (value.includes("interview")) return "Review interview";
  if (value.includes("offer")) return "Review offer";
  if (value.includes("deadline") || value.includes("job")) return "Review job";
  if (value.includes("stalled") || value.includes("pipeline")) return "Review pipeline";
  if (value.includes("application") || value.includes("screen")) return "Review candidate";
  return "Review";
}

export function RecruiterHomeWorkspace({
  data,
  jobs,
  jobsError,
  firstName,
}: {
  data: RecruiterDashboard;
  jobs: RecruiterJob[];
  jobsError: boolean;
  firstName: string;
}) {
  const date = (value: string) =>
    new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(value)) + " IST";

  const jobSummary = (job: RecruiterJob) => {
    const location = [job.city, job.state].filter(Boolean).join(", ") || job.country_code;
    const posted = job.published_at ? `Posted ${compactDate(job.published_at)}` : "";
    return (
      <div>
        <Link
          className="font-semibold text-navy hover:text-indigo"
          href={`/recruiter/jobs/${job.id}/applicants`}
        >
          {job.title}
        </Link>
        <p className="mt-1 text-xs text-ink-muted">
          {[location, posted].filter(Boolean).join(" · ")}
        </p>
      </div>
    );
  };

  const jobActions = (job: RecruiterJob) => {
    const action =
      job.new_applications > 0
        ? `Review ${job.new_applications} new`
        : job.interviews > 0
          ? "View pipeline"
          : "View applicants";
    return (
      <Link className={recruiterSecondary} href={`/recruiter/jobs/${job.id}/applicants`}>
        {action}
      </Link>
    );
  };

  const overview = [
    {
      name: "Active jobs",
      value: data.active_jobs,
      href: "/recruiter/jobs?status=active",
      detail: data.active_jobs ? "Open requisitions" : "No active roles",
    },
    {
      name: "New applications",
      value: data.new_applications,
      href: "/recruiter/pipeline?stage=new_application",
      detail: data.new_applications ? "Awaiting review" : "No new applications",
    },
    {
      name: "Upcoming interviews",
      value: data.upcoming_interviews,
      href: "/recruiter/interviews?status=upcoming",
      detail: data.upcoming_interviews ? "Scheduled" : "None scheduled",
    },
    {
      name: "Offers",
      value: data.offers,
      href: "/recruiter/offers",
      detail: data.offers ? "Active offers" : "No active offers",
    },
  ];

  return (
    <div className="grid min-w-0 gap-6">
      <RecruiterProductHeader
        eyebrow={data.company_name}
        title={
          <>
            <LocalTimeGreeting firstName={firstName} />.
          </>
        }
        description="Your hiring priorities and the next steps that need your attention."
        actions={
          <Link className={recruiterPrimary} href="/recruiter/jobs/new">
            Post a job
          </Link>
        }
      />

      <section aria-labelledby="attention-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="attention-heading" className="text-lg font-semibold text-navy">
            Needs attention
          </h2>
          <Link
            className="min-h-11 content-center text-sm font-semibold text-indigo"
            href="/recruiter/pipeline"
          >
            Review pipeline
          </Link>
        </div>
        {data.needs_attention.length ? (
          <ul className="swx-workspace-surface divide-y divide-line rounded-xl border border-line">
            {data.needs_attention.map((item) => (
              <li key={`${item.kind}-${item.title}`}>
                <Link
                  className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 transition hover:bg-slate-50/60"
                  href={item.href}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-ink-muted">{item.detail}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-indigo">
                    {attentionAction(item.kind, item.href)} →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <WorkspaceState
            title="Your priority queues are clear"
            description="No open application, message, offer or deadline queues need attention right now."
          />
        )}
      </section>

      <section aria-label="Hiring overview" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {overview.map((item) => (
          <Link
            key={item.name}
            aria-label={`View ${item.name.toLowerCase()}: ${item.value}`}
            href={item.href}
            className="swx-workspace-surface rounded-xl border border-line px-4 py-4 transition hover:border-indigo/20 hover:bg-white"
          >
            <p className="text-xs text-ink-muted">{item.name}</p>
            <p className="mt-2 text-2xl font-semibold text-navy">{item.value}</p>
            <p className="mt-1 text-xs text-ink-muted">{item.detail}</p>
          </Link>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-navy">Active jobs</h2>
          <Link
            href="/recruiter/jobs?status=active"
            className="min-h-11 content-center text-sm font-semibold text-indigo"
          >
            All active jobs
          </Link>
        </div>
        {jobsError ? (
          <WorkspaceState
            error
            title="Active jobs are unavailable"
            description="Try the job workspace to retry. No hiring data has changed."
            action={
              <Link href="/recruiter/jobs" className={recruiterSecondary}>
                Manage jobs
              </Link>
            }
          />
        ) : jobs.length ? (
          <RecruiterDataTable
            label="Active jobs"
            rows={jobs}
            rowKey={(job) => job.id}
            columns={[
              { key: "job", title: "Job", width: "40%", render: jobSummary },
              {
                key: "applications",
                title: "Applications",
                width: "20%",
                render: (job) => (
                  <>
                    <p>{job.applications}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {job.new_applications} new
                    </p>
                  </>
                ),
              },
              {
                key: "interviews",
                title: "Interviews",
                width: "15%",
                render: (job) => job.interviews,
              },
              { key: "actions", title: "Next action", width: "25%", render: jobActions },
            ]}
            mobileRow={(job) => (
              <>
                {jobSummary(job)}
                <p className="my-3 text-xs text-ink-muted">
                  {job.applications} applications · {job.new_applications} new · {job.interviews}{" "}
                  interviews
                </p>
                {jobActions(job)}
              </>
            )}
          />
        ) : (
          <WorkspaceState
            title="No active jobs"
            description="Publish a role when your hiring requirements are ready."
            action={
              <Link className={recruiterPrimary} href="/recruiter/jobs/new">
                Post a job
              </Link>
            }
          />
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-navy">Upcoming interviews</h2>
          <Link
            href="/recruiter/interviews"
            className="min-h-11 content-center text-sm font-semibold text-indigo"
          >
            All interviews
          </Link>
        </div>
        {data.upcoming_items.length ? (
          <div className="grid gap-3">
            {data.upcoming_items.map((item) => (
              <CandidateCard
                key={item.id}
                candidate={
                  item.candidate
                    ? applicationCardSummary(item.candidate)
                    : { id: item.id, name: item.candidate_name, profileWithheld: true }
                }
                context={
                  <div className="grid gap-2">
                    <p className="font-semibold text-navy">{item.job_title}</p>
                    <time dateTime={item.scheduled_at}>{date(item.scheduled_at)}</time>
                  </div>
                }
                actions={
                  <Link
                    className={recruiterSecondary}
                    href={`/recruiter/interviews?interview_id=${encodeURIComponent(item.id)}`}
                  >
                    Open interview
                  </Link>
                }
              />
            ))}
          </div>
        ) : (
          <div className="swx-workspace-surface flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-4">
            <div>
              <p className="text-sm font-semibold text-navy">No upcoming interviews</p>
              <p className="mt-1 text-xs leading-5 text-ink-muted">
                Schedule from an authorized application when the candidate and team are ready.
              </p>
            </div>
            <Link className="text-sm font-semibold text-indigo" href="/recruiter/pipeline">
              Review pipeline →
            </Link>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-navy">Recent applications</h2>
          <Link
            className="min-h-11 content-center text-sm font-semibold text-indigo"
            href="/recruiter/pipeline"
          >
            Full pipeline
          </Link>
        </div>
        <CompactApplicantCards rows={data.recent_applications.slice(0, 6)} />
      </section>
    </div>
  );
}
