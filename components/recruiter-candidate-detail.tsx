"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "../lib/api-client";
import { WorkspaceShell } from "./ui";

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

  return <WorkspaceShell workspace="recruiter" active="sourcing" title="Candidate profile" description="Review the same privacy-safe candidate details captured by sourcing.">
    <section className="candidate-profile-return"><Link className="button button-primary" href={returnTo}>← Back to search results</Link></section>
    {!profile && !error && <section className="panel candidate-detail-status" aria-live="polite">Loading candidate profile…</section>}
    {error && <section className="panel candidate-detail-status" role="alert"><h2>Candidate reference</h2><p>{error}</p></section>}
    {profile && <article className="recruiter-candidate-detail">
      <header><span className="candidate-detail-avatar" aria-hidden="true">{profile.fullName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div><h2>{profile.fullName}</h2><p>{profile.headline || "Professional profile"}{profile.currentCompany ? ` at ${profile.currentCompany}` : ""}</p><span>{profile.overallExperienceYears == null ? "Experience not shared" : `${profile.overallExperienceYears} years`} · {profile.expectedSalaryLakhs == null ? "Salary not shared" : `₹ ${profile.expectedSalaryLakhs} Lacs`} · {profile.location || "Location not shared"}</span></div><small>{profile.emailVerified && profile.mobileVerified ? "Verified phone & email" : "Contact verification pending"}</small></header>
      <div className="recruiter-candidate-detail-grid"><section><h3>Career details</h3><dl><div><dt>Current</dt><dd>{profile.headline || "Not shared"}{profile.currentCompany ? ` at ${profile.currentCompany}` : ""}</dd></div><div><dt>Previous</dt><dd>{profile.previousRole || "Not shared"}{profile.previousCompany ? ` at ${profile.previousCompany}` : ""}</dd></div><div><dt>Education</dt><dd>{profile.highestEducation}</dd></div><div><dt>Preferred locations</dt><dd>{profile.preferredLocations.join(", ") || "Not shared"}</dd></div><div><dt>Notice period</dt><dd>{profile.noticePeriodDays == null ? "Not shared" : `${profile.noticePeriodDays} days`}</dd></div></dl></section><section><h3>Profile evidence</h3><p>{profile.profileSummary || "Candidate profile is ready for review."}</p><h4>Key skills</h4><div className="candidate-detail-skills">{profile.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><footer><span>{profile.cvAvailable ? "CV attached" : "CV not attached"}</span><span>{profile.similarProfileCount} similar profiles</span></footer></section></div>
      <footer className="recruiter-candidate-detail-footer"><span>{profile.profileViewCount} recruiters viewed this profile · {profile.profileDownloadCount} recruiters downloaded this profile</span><span>{activity(profile.profileLastUpdatedAt, "Modified")} · {activity(profile.lastActiveAt, "Active")}</span></footer>
    </article>}
  </WorkspaceShell>;
}
