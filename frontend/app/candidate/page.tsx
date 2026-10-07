import Link from "next/link";
import {CandidateReferralList} from "@/lib/candidate-referrals";
import { CandidateOverviewIdentity } from "@/components/candidate/candidate-overview-identity";
import { JobCard } from "@/components/candidate/job-card";
import { WorkspaceError } from "@/components/candidate/workspace-error";
import { WorkspaceRetry } from "@/components/candidate/workspace-retry";
import { candidateStageLabel } from "@/components/candidate/workspace-job-utils";
import { Surface } from "@/components/ui/surface";
import { LocalTimeGreeting } from "@/components/ui/local-time-greeting";
import {
  CandidateDashboard,
  CandidateProfileDetails,
  CandidateProfileMetrics,
  candidateOnboardingStatus,
} from "@/lib/candidate";
import { candidateAPI } from "@/lib/candidate-server";

export default async function CandidateDashboardPage() {
  let dashboard: CandidateDashboard;
  try {
    dashboard = await candidateAPI<CandidateDashboard>(
      "/api/v1/candidate/dashboard",
    );
  } catch {
    return <WorkspaceError title="We couldn’t load your overview." />;
  }
  const [details, metrics, referrals] = await Promise.all([
    candidateAPI<CandidateProfileDetails>(
      "/api/v1/candidate/profile/details",
    ).catch(() => null),
    candidateAPI<CandidateProfileMetrics>(
      "/api/v1/candidate/profile/metrics",
    ).catch(() => null),
    candidateAPI<CandidateReferralList>("/api/v1/candidate/referral-invitations?limit=1&page=1").catch(()=>null),
  ]);
  const onboarding = details ? candidateOnboardingStatus(details) : null;
  const firstName = dashboard.profile.full_name.split(" ")[0] || "there";
  const cards = [
    {
      label: "Profile views",
      value: metrics?.profile_views,
      detail: "Verified recruiters",
      explanation:
        "Verified recruiters who opened your professional profile in the last 30 days. Each recruiter is counted once.",
    },
    {
      label: "Search appearances",
      value: metrics?.search_appearances,
      detail: "Recruiter search results",
      explanation:
        "Times your profile appeared in verified recruiter search results in the last 30 days, counted once per recruiter per day.",
    },
    {
      label: "Recruiter actions",
      value: metrics?.recruiter_actions,
      detail: "Recruiters who took action",
      explanation:
        "Verified recruiters who took a meaningful action in the last 30 days, such as saving, messaging, viewing your CV or progressing an application. Passive views are excluded; each recruiter is counted once.",
    },
    {
      label: "Applications",
      value: dashboard.application_count,
      detail: "Your applications",
      explanation: "Applications you submitted through SapienWorx.",
    },
  ];
  return (
    <div className="grid gap-6">
      <header>
        <p className="text-sm text-ink-muted">
          <LocalTimeGreeting firstName={firstName} />.
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Your overview
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Keep your profile current, follow applications and find your next
          opportunity.
        </p>
      </header>
      {onboarding &&
        [
          "manual_started",
          "cv_started",
          "in_progress",
          "review_required",
        ].includes(onboarding) && (
          <Surface
            tone="lavender"
            className="flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <p className="text-sm">
              Your profile is in progress. Continue at your own pace.
            </p>
            <Link
              href="/candidate/onboarding"
              className="text-sm font-semibold text-indigo"
            >
              Continue profile setup →
            </Link>
          </Surface>
        )}
      <div className="candidate-overview-grid">
        <CandidateOverviewIdentity
          profile={dashboard.profile}
          details={details}
        />
        <Surface className="p-6">
          <h2 className="text-base font-bold">Your next step</h2>
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            A current headline, skills and career preferences help recruiters
            understand what you’re looking for.
          </p>
          <Link
            href="/candidate/profile"
            className="mt-4 inline-block font-semibold text-sm text-indigo"
          >
            Improve your profile →
          </Link>
          <div className="mt-5 border-t border-line pt-4 flex gap-4 text-sm">
            <Link className="font-semibold text-indigo" href="/candidate/jobs">
              Find Jobs
            </Link>
            <Link className="font-semibold text-indigo" href="/candidate/saved">
              Saved Jobs ({dashboard.saved_count})
            </Link>
          </div>
        </Surface>
      </div>
      {referrals&&referrals.total>0&&<Surface className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="font-semibold">Your referrals</h2><p className="mt-1 text-sm text-ink-muted">{referrals.total} personal recommendation{referrals.total===1?"":"s"}. Track broad progress privately.</p></div><Link className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo" href="/candidate/referrals">View referrals →</Link></Surface>}
      <section aria-label="Profile performance">
        <div className="mb-3 flex flex-wrap justify-between gap-2">
          <h2 className="font-bold">Profile performance</h2>
          <span className="text-xs text-ink-muted">
            Last 30 days · Aggregate information only
          </span>
        </div>
        {!metrics && (
          <p role="alert" className="candidate-error mb-3">
            Your profile metrics could not be loaded.{" "}
            <WorkspaceRetry href="/candidate" />
          </p>
        )}
        <div className="candidate-metrics">
          {cards.map((card) => (
            <article key={card.label}>
              <h3>
                {card.label}
                <details className="candidate-tooltip">
                  <summary aria-label={`About ${card.label}`}>?</summary>
                  <p>{card.explanation}</p>
                </details>
              </h3>
              <strong>
                {card.value == null
                  ? "Unavailable"
                  : card.value.toLocaleString("en-IN")}
              </strong>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>
      </section>
      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">Roles worth a look</h2>
          <Link
            href="/candidate/jobs"
            className="text-sm font-semibold text-indigo"
          >
            View all jobs →
          </Link>
        </div>
        {dashboard.recommended_jobs?.length ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {dashboard.recommended_jobs.map((job) => (
              <JobCard
                job={job}
                key={job.id}
                compact
                hrefBase="/candidate/jobs"
                canSave
              />
            ))}
          </div>
        ) : (
          <Surface className="mt-4 p-6">
            <p className="font-semibold">No active recommendations yet.</p>
            <p className="mt-2 text-sm text-ink-muted">
              Published roles will appear here. You can explore Find Jobs
              anytime.
            </p>
          </Surface>
        )}
      </section>
      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">Recent applications</h2>
          <Link
            href="/candidate/applications"
            className="text-sm font-semibold text-indigo"
          >
            Open tracker →
          </Link>
        </div>
        <Surface className="mt-4 overflow-hidden">
          {dashboard.recent_applications?.length ? (
            <div className="divide-y divide-line">
              {dashboard.recent_applications.map((app) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                  key={app.id}
                >
                  <div className="min-w-0">
                    <Link
                      href={`/candidate/jobs/${app.job_id}`}
                      className="font-semibold hover:underline"
                    >
                      {app.job_title}
                    </Link>
                    <p className="mt-1 text-sm text-ink-muted">
                      {app.company_name}
                    </p>
                  </div>
                  <span className="rounded-full bg-indigo-soft px-3 py-1 text-xs font-semibold text-violet-ink">
                    {candidateStageLabel(app.stage)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-sm text-ink-muted">
              You haven’t applied to a role yet.
            </div>
          )}
        </Surface>
      </section>
    </div>
  );
}
