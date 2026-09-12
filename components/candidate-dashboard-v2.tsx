"use client";

import { Button, WorkspaceShell } from "./ui";
import type { CandidateDashboardData } from "./candidate";
import styles from "./candidate-dashboard-v2.module.css";

const activeStages = new Set(["SCREENING", "SHORTLISTED", "INTERVIEW", "TECHNICAL_INTERVIEW", "HR_ROUND", "FINAL_INTERVIEW", "OFFER"]);
const interviewStages = new Set(["INTERVIEW", "TECHNICAL_INTERVIEW", "HR_ROUND", "FINAL_INTERVIEW"]);
const offerStages = new Set(["OFFER", "OFFERED"]);

function normaliseStage(stage: string) {
  return stage.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function relativeTime(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function CandidateDashboardV2({ initialData }: { initialData: CandidateDashboardData | null }) {
  const dashboard = initialData;
  const applications = dashboard?.applications ?? [];
  const activeApplications = applications.filter((application) => activeStages.has(application.stage));
  const interviews = applications.filter((application) => interviewStages.has(application.stage));
  const offers = applications.filter((application) => offerStages.has(application.stage));
  const name = dashboard?.profile.fullName?.split(" ")[0] || "there";
  const profileCompleteness = dashboard?.performance.profileCompleteness ?? 0;
  const profileSearchable = dashboard?.profile.profileSearchable ?? false;
  const hasApplications = applications.length > 0;
  const nextInterview = interviews[0];

  return (
    <WorkspaceShell
      workspace="candidate"
      active="dashboard"
      title="Career workspace"
      description={`Hi ${name} — here is what changed, what needs your attention, and what you can do next.`}
    >
      <main className={styles.dashboard}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Your job search</span>
            <h2>Stay on top of every opportunity.</h2>
            <p>Track applications, interviews and recruiter activity without losing sight of your next move.</p>
          </div>
          <Button href="/candidate/jobs">Search open roles</Button>
        </section>

        {hasApplications ? (
          <section className={styles.stats} aria-label="Application summary">
            <Stat value={applications.length} label="Total applications" />
            <Stat value={activeApplications.length} label="Active process" />
            <Stat value={interviews.length} label="Interviews scheduled" />
            <Stat value={offers.length} label="Offers received" />
          </section>
        ) : (
          <section className={styles.zeroState}>
            <div className={styles.zeroStateCopy}>
              <span className={styles.eyebrow}>Start your search</span>
              <h3>You haven’t applied anywhere yet.</h3>
              <p>Explore open roles and apply when you find a role that fits your experience and preferences.</p>
            </div>
            <Button href="/candidate/jobs">Search open roles</Button>
          </section>
        )}

        <section className={styles.layout}>
          <div className={styles.mainColumn}>
            {nextInterview && (
              <article className={styles.nextAction}>
                <div className={styles.nextActionCopy}>
                  <span className={styles.eyebrow}>Next action</span>
                  <h3>{nextInterview.title}</h3>
                  <p>{nextInterview.companyName} · Interview stage</p>
                  <div className={styles.nextActionMeta}>
                    <span>Updated {relativeTime(nextInterview.updatedAt)}</span>
                    <span>Review the role and interview details before joining.</span>
                  </div>
                </div>
                <Button href="/candidate/interviews">View interview</Button>
              </article>
            )}

            <section className={styles.panel}>
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.eyebrow}>Applications</span>
                  <h3>Applications in progress</h3>
                </div>
                <Button href="/candidate/applications" variant="quiet">View all applications →</Button>
              </div>

              {activeApplications.length ? (
                <div className={styles.applicationList}>
                  {activeApplications.slice(0, 5).map((application) => {
                    const stageClass = offerStages.has(application.stage)
                      ? `${styles.stage} ${styles.stageOffer}`
                      : interviewStages.has(application.stage)
                        ? `${styles.stage} ${styles.stageInterview}`
                        : styles.stage;
                    return (
                      <div className={styles.applicationRow} key={application.applicationId}>
                        <span className={styles.companyMark}>{application.companyName.slice(0, 1).toUpperCase()}</span>
                        <div className={styles.applicationTitle}>
                          <strong>{application.title}</strong>
                          <span className={styles.applicationMeta}>{application.companyName} · Updated {relativeTime(application.updatedAt)}</span>
                        </div>
                        <span className={stageClass}>{normaliseStage(application.stage)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.zeroStateCopy}>
                  <h3>No active applications right now.</h3>
                  <p>Closed, withdrawn or completed applications remain available in your application history.</p>
                </div>
              )}
            </section>
          </div>

          <aside className={styles.sideColumn}>
            <section className={styles.panel}>
              <div className={styles.profileHeader}>
                <div>
                  <span className={styles.eyebrow}>Profile strength</span>
                  <h3>Keep your profile current</h3>
                </div>
                <span className={styles.completeness}>{profileCompleteness}%</span>
              </div>
              <div className={styles.meter} aria-label={`Profile completeness ${profileCompleteness}%`}>
                <div className={styles.meterFill} style={{ width: `${Math.max(0, Math.min(100, profileCompleteness))}%` }} />
              </div>
              <p className={styles.visibilityCopy}>A complete, current profile gives recruiters more useful context when they review your experience.</p>
              <div className={`${styles.visibilityState} ${profileSearchable ? "" : styles.visibilityStatePrivate}`}>
                {profileSearchable ? "Recruiter visibility is on" : "Recruiter visibility is off"}
              </div>
              <div style={{ marginTop: "var(--space-4)" }}><Button href="/candidate/profile" variant="secondary">Review profile</Button></div>
            </section>

            <section className={styles.panel}>
              <span className={styles.eyebrow}>Privacy</span>
              <h3 style={{ marginTop: "var(--space-2)" }}>You control recruiter visibility.</h3>
              <p className={styles.visibilityCopy} style={{ marginTop: "var(--space-2)" }}>Your professional profile can be discoverable while your personal contact details remain protected by platform controls.</p>
              <div style={{ marginTop: "var(--space-4)" }}><Button href="/candidate/settings" variant="quiet">Privacy settings →</Button></div>
            </section>
          </aside>
        </section>
      </main>
    </WorkspaceShell>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <article className={styles.statCard}>
      <strong>{value.toLocaleString("en-IN")}</strong>
      <span>{label}</span>
    </article>
  );
}
