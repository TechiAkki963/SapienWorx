"use client";

import { Button, WorkspaceShell } from "./ui";
import styles from "./recruiter-dashboard-v2.module.css";

type RecruiterDashboardData = {
  openPositions: number;
  activeApplications: number;
  draftJobs: number;
  funnel: Record<string, number>;
  upcomingInterviews?: Array<{
    candidateName: string;
    jobTitle: string;
    platformName: string;
    meetingLink: string;
    scheduledAt: string;
    durationMinutes: number;
  }>;
};

function formatInterviewTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time to be confirmed";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function isHttps(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && Boolean(url.hostname); }
  catch { return false; }
}

export function RecruiterDashboardV2({ initialData }: { initialData?: RecruiterDashboardData | null }) {
  const funnel = initialData?.funnel ?? {};
  const applied = funnel.APPLIED ?? 0;
  const screening = funnel.SCREENING ?? 0;
  const interviewing = funnel.INTERVIEWING ?? 0;
  const finalStage = funnel.FINAL_STAGE ?? 0;
  const offers = funnel.OFFER ?? 0;
  const onboarded = funnel.ONBOARDED ?? 0;
  const openPositions = initialData?.openPositions ?? 0;
  const activeApplications = initialData?.activeApplications ?? 0;
  const draftJobs = initialData?.draftJobs ?? 0;
  const upcomingInterviews = initialData?.upcomingInterviews ?? [];
  const interviewsNeedingLinks = upcomingInterviews.filter((item) => !isHttps(item.meetingLink));

  const attention = [
    applied > 0 ? { label: "Applications awaiting review", value: applied, detail: "New applications are ready for a first decision.", href: "/recruiter/pipeline?stage=applied" } : null,
    interviewsNeedingLinks.length > 0 ? { label: "Interviews need meeting links", value: interviewsNeedingLinks.length, detail: "Add a valid external meeting URL before the candidate joins.", href: "/recruiter/interviews" } : null,
    offers > 0 ? { label: "Offers in progress", value: offers, detail: "Review candidate decisions and any follow-up required.", href: "/recruiter/pipeline?stage=offer" } : null,
    draftJobs > 0 ? { label: "Draft roles", value: draftJobs, detail: "Complete or archive unfinished job drafts.", href: "/recruiter/jobs/manage" } : null,
  ].filter(Boolean) as Array<{ label: string; value: number; detail: string; href: string }>;

  const stages = [
    ["Applied", applied], ["Screening", screening], ["Interviewing", interviewing],
    ["Final stage", finalStage], ["Offer", offers], ["Hired", onboarded],
  ] as const;

  return <WorkspaceShell
    workspace="recruiter"
    active="dashboard"
    title="Recruiter workbench"
    description="Prioritise what needs action, then move directly into the candidate or role workflow."
    actions={<><Button href="/recruiter/pipeline" variant="secondary">Open pipeline</Button><Button href="/recruiter/jobs">+ Create job</Button></>}
  >
    <main className={styles.page}>
      <section className={styles.attention}>
        <header className={styles.sectionHeader}><div><span className="eyebrow">Priority queue</span><h2>Needs attention</h2><p>Only actionable items supported by live recruiter data are shown here.</p></div><span className={styles.attentionCount}>{attention.reduce((sum, item) => sum + item.value, 0)} items</span></header>
        {attention.length ? <div className={styles.attentionGrid}>{attention.map((item) => <a href={item.href} key={item.label} className={styles.attentionCard}><strong>{item.value}</strong><div><b>{item.label}</b><span>{item.detail}</span></div><i>→</i></a>)}</div> : <div className={styles.clearState}><strong>No urgent recruiter actions.</strong><p>Your current application, interview, offer and job-draft queues are clear.</p></div>}
      </section>

      <section className={styles.metricStrip} aria-label="Recruitment operations summary">
        <a href="/recruiter/jobs/manage"><span>Open vacancies</span><strong>{openPositions}</strong><small>Published roles</small></a>
        <a href="/recruiter/pipeline"><span>Active candidates</span><strong>{activeApplications}</strong><small>Across accessible roles</small></a>
        <a href="/recruiter/pipeline?stage=interviewing"><span>Interviewing</span><strong>{interviewing}</strong><small>Candidate conversations</small></a>
        <a href="/recruiter/pipeline?stage=offer"><span>Offers</span><strong>{offers}</strong><small>Offer-stage decisions</small></a>
      </section>

      <div className={styles.mainGrid}>
        <section className={styles.panel}>
          <header className={styles.panelHeader}><div><span className="eyebrow">Pipeline</span><h2>Stage distribution</h2></div><a href="/recruiter/pipeline">Open table →</a></header>
          <div className={styles.stageList}>{stages.map(([label, value], index) => <div className={styles.stageRow} key={label}><span className={styles.stageIndex}>{index + 1}</span><span className={styles.stageName}>{label}</span><div className={styles.stageBar}><i style={{ width: `${activeApplications ? Math.max(4, Math.round((value / activeApplications) * 100)) : 0}%` }} /></div><strong>{value}</strong></div>)}</div>
          <footer className={styles.panelFooter}><span><b>{activeApplications}</b> active applications</span><span><b>{interviewing + finalStage}</b> in conversation</span><span><b>{onboarded}</b> hires</span></footer>
        </section>

        <aside className={styles.aside}>
          <section className={styles.panel}>
            <header className={styles.panelHeader}><div><span className="eyebrow">Calendar</span><h2>Upcoming interviews</h2></div><a href="/recruiter/interviews">Manage →</a></header>
            <div className={styles.interviewList}>{upcomingInterviews.length ? upcomingInterviews.slice(0, 6).map((interview) => <article key={`${interview.candidateName}-${interview.scheduledAt}`}><time>{formatInterviewTime(interview.scheduledAt)}</time><div><strong>{interview.candidateName}</strong><span>{interview.jobTitle}</span></div><small>{isHttps(interview.meetingLink) ? interview.platformName : "Meeting link required"}</small></article>) : <div className={styles.emptyMini}><strong>No upcoming interviews.</strong><span>Scheduled interviews will appear here.</span></div>}</div>
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}><div><span className="eyebrow">Role inventory</span><h2>Hiring workload</h2></div><a href="/recruiter/jobs/manage">Manage →</a></header>
            <div className={styles.workload}><div><span>Published roles</span><strong>{openPositions}</strong></div><div><span>Draft roles</span><strong>{draftJobs}</strong></div></div>
          </section>
        </aside>
      </div>

      <p className={styles.dataNote}>Protected personal attributes are not used in this workbench, sourcing or candidate ranking. Counts reflect only jobs and applications accessible to the recruiter organisation.</p>
    </main>
  </WorkspaceShell>;
}
