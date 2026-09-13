"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "../lib/api-client";
import { HumanSignal } from "./human-signal";
import { WorkspaceShell } from "./ui";
import styles from "./recruiter-candidate-detail.module.css";

type SourcedCandidateProfile = {
  candidateId: string; fullName: string; headline: string | null; currentCompany: string | null; previousRole: string | null; previousCompany: string | null;
  highestEducation: string; location: string | null; preferredLocations: string[]; overallExperienceYears: number | null; expectedSalaryLakhs: number | null;
  noticePeriodDays: number | null; skills: string[]; profileSummary: string | null; emailVerified: boolean; mobileVerified: boolean; cvAvailable: boolean;
  similarProfileCount: number; profileViewCount: number; profileDownloadCount: number; lastActiveAt: string | null; profileLastUpdatedAt: string | null;
};

function isCandidateId(value: string) { return /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value); }
function activity(value: string | null, prefix: string) { if (!value) return `${prefix} date unavailable`; const days = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 86_400_000)); return days === 0 ? `${prefix} today` : days === 1 ? `${prefix} yesterday` : `${prefix} ${days} days ago`; }

export function RecruiterCandidateDetail({ candidateId, returnTo }: { candidateId: string; returnTo: string }) {
  const [profile, setProfile] = useState<SourcedCandidateProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isCandidateId(candidateId)) { setError("This reference profile is available in the search results only."); return; }
    let active = true;
    void apiClient<SourcedCandidateProfile>(`/api/recruiter/sourcing/candidates/${candidateId}`).then((response) => {
      if (!active) return;
      setProfile(response);
      void apiClient<void>(`/api/recruiter/sourcing/candidates/${candidateId}/profile-view`, { method: "POST" }).catch(() => undefined);
    }).catch(() => { if (active) setError("This candidate profile is unavailable in the current recruiter session."); });
    return () => { active = false; };
  }, [candidateId]);

  return <WorkspaceShell workspace="recruiter" active="sourcing" title="Candidate profile" description="Review privacy-safe candidate evidence and decide the next step with the right context.">
    <div className={styles.page}>
      <div className={styles.returnRow}><Link className={`button button-secondary ${styles.returnLink}`} href={returnTo}>← Back to search results</Link></div>
      {!profile && !error && <section className={styles.status} aria-live="polite">Loading candidate profile…</section>}
      {error && <section className={styles.status} role="alert"><h2>Candidate reference</h2><p>{error}</p></section>}
      {profile && <article className={styles.profile}>
        <header className={styles.header}>
          <span className={styles.avatar} aria-hidden="true">{profile.fullName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
          <div className={styles.identity}>
            <h2>{profile.fullName}</h2>
            <p>{profile.headline || "Professional profile"}{profile.currentCompany ? ` at ${profile.currentCompany}` : ""}</p>
            <div className={styles.summaryLine}>
              <span>{profile.overallExperienceYears == null ? "Experience not shared" : `${profile.overallExperienceYears} years experience`}</span>
              <span>{profile.expectedSalaryLakhs == null ? "Salary not shared" : `₹ ${profile.expectedSalaryLakhs} Lacs expected`}</span>
              <span>{profile.location || "Location not shared"}</span>
            </div>
          </div>
          <span className={styles.verification}>{profile.emailVerified && profile.mobileVerified ? "Verified phone & email" : "Contact verification pending"}</span>
        </header>

        <div className={styles.grid}>
          <div className={styles.main}>
            <section className={styles.section}>
              <h3>Career details</h3>
              <dl className={styles.details}>
                <div><dt>Current</dt><dd>{profile.headline || "Not shared"}{profile.currentCompany ? ` at ${profile.currentCompany}` : ""}</dd></div>
                <div><dt>Previous</dt><dd>{profile.previousRole || "Not shared"}{profile.previousCompany ? ` at ${profile.previousCompany}` : ""}</dd></div>
                <div><dt>Education</dt><dd>{profile.highestEducation}</dd></div>
                <div><dt>Preferred locations</dt><dd>{profile.preferredLocations.join(", ") || "Not shared"}</dd></div>
                <div><dt>Notice period</dt><dd>{profile.noticePeriodDays == null ? "Not shared" : `${profile.noticePeriodDays} days`}</dd></div>
              </dl>
            </section>
            <section className={styles.section}>
              <h3>Profile summary</h3>
              <p className={styles.summary}>{profile.profileSummary || "Candidate profile is ready for review."}</p>
              <h3>Key skills</h3>
              <div className={styles.skills}>{profile.skills.length ? profile.skills.map((skill) => <span key={skill}>{skill}</span>) : <span>No skills shared</span>}</div>
            </section>
          </div>

          <aside className={styles.side}>
            <section className={styles.signalCard}>
              <div className={styles.signalCardCopy}>
                <strong>Human evidence, structured clearly.</strong>
                <p>Use verified profile data, activity and availability as context. Keep hiring decisions grounded in job-relevant evidence.</p>
              </div>
              <HumanSignal tone="recruiter" compact className={styles.signal} />
            </section>
            <section>
              <h3>Profile evidence</h3>
              <div className={styles.evidence}>
                <span>CV status <b>{profile.cvAvailable ? "Attached" : "Not attached"}</b></span>
                <span>Similar profiles <b>{profile.similarProfileCount}</b></span>
                <span>Recruiter views <b>{profile.profileViewCount}</b></span>
                <span>Profile downloads <b>{profile.profileDownloadCount}</b></span>
              </div>
            </section>
          </aside>
        </div>
        <footer className={styles.footer}>
          <span>{activity(profile.profileLastUpdatedAt, "Modified")} · {activity(profile.lastActiveAt, "Active")}</span>
          <span>Privacy-safe sourcing profile</span>
        </footer>
      </article>}
    </div>
  </WorkspaceShell>;
}
