"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient } from "../lib/api-client";
import { sourceRequest, stateFromSearchParams } from "../lib/recruiter-search";
import { WorkspaceShell } from "./ui";
import styles from "./search-results-v3.module.css";

type SourcingCandidate = {
  candidateId: string;
  fullName: string;
  headline: string | null;
  currentCompany: string | null;
  previousRole: string | null;
  previousCompany: string | null;
  highestEducation: string | null;
  location: string | null;
  preferredLocations: string | null;
  overallExperienceYears: number | null;
  expectedSalaryLakhs: number | null;
  noticePeriodDays: number | null;
  skills: string | null;
  profileSummary: string | null;
  emailVerified: boolean | null;
  mobileVerified: boolean | null;
  cvAvailable: boolean | null;
  similarProfileCount: number | null;
  lastActiveAt: string | null;
  profileLastUpdatedAt: string | null;
  profileViewCount: number | null;
  profileDownloadCount: number | null;
  relevanceScore: number | null;
};

type SourcingPage = {
  content: SourcingCandidate[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first?: boolean;
  last?: boolean;
  numberOfElements?: number;
  empty?: boolean;
};

const demoCandidates: SourcingCandidate[] = [
  {
    candidateId: "demo-avish-bansal",
    fullName: "Avish Bansal",
    headline: "Senior Full Stack Engineer",
    currentCompany: "StatusNeo Technology Consulting",
    previousRole: "Senior Software Engineer",
    previousCompany: "Cognizant",
    highestEducation: "B.Tech / B.E. · Graphic Era University",
    location: "Bengaluru",
    preferredLocations: "Remote, Bengaluru, Gurugram",
    overallExperienceYears: 5,
    expectedSalaryLakhs: 24,
    noticePeriodDays: 30,
    skills: "TypeScript, Node.js, AWS, Docker, Redis, GraphQL, Microservices",
    profileSummary: "Full-stack engineer experienced in designing and scaling production systems.",
    emailVerified: true,
    mobileVerified: true,
    cvAvailable: true,
    similarProfileCount: null,
    lastActiveAt: "2026-09-09T07:00:00Z",
    profileLastUpdatedAt: "2026-09-06T10:00:00Z",
    profileViewCount: 147,
    profileDownloadCount: 31,
    relevanceScore: 0.91,
  },
  {
    candidateId: "demo-vaibhav-thakur",
    fullName: "Vaibhav T Thakur",
    headline: "Senior Software Engineer",
    currentCompany: "GlobalLogic",
    previousRole: "Software Engineer",
    previousCompany: "Thoughtworks",
    highestEducation: "B.E. Computer Science · Pune University",
    location: "Bengaluru",
    preferredLocations: "Bengaluru, Pune",
    overallExperienceYears: 7,
    expectedSalaryLakhs: 28,
    noticePeriodDays: 45,
    skills: "Java, Kotlin, Node.js, Kafka, Kubernetes, AWS, PostgreSQL",
    profileSummary: "Backend engineer focused on reliable cloud-native systems.",
    emailVerified: true,
    mobileVerified: true,
    cvAvailable: true,
    similarProfileCount: null,
    lastActiveAt: "2026-09-08T10:00:00Z",
    profileLastUpdatedAt: "2026-09-05T10:00:00Z",
    profileViewCount: 204,
    profileDownloadCount: 42,
    relevanceScore: 0.86,
  },
];

function skillList(value: string | null) {
  return (value ?? "").split(/[,|]/).map((item) => item.trim()).filter(Boolean);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C";
}

function freshness(value: string | null) {
  if (!value) return "Not recently recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recently recorded";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}

export function SearchResultsV3() {
  const searchParams = useSearchParams();
  const searchState = useMemo(() => stateFromSearchParams(searchParams), [searchParams]);
  const localDemo = process.env.NEXT_PUBLIC_LOCAL_DEMO === "true";
  const [page, setPage] = useState(0);
  const [data, setData] = useState<SourcingPage | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    if (localDemo) {
      setData({ content: demoCandidates, totalElements: demoCandidates.length, totalPages: 1, number: 0, size: 20, first: true, last: true, numberOfElements: demoCandidates.length, empty: false });
      setStatus("ready");
      return;
    }
    try {
      const response = await apiClient<SourcingPage>("/api/recruiter/sourcing/search", {
        method: "POST",
        body: JSON.stringify(sourceRequest(searchState, page, 20)),
      });
      setData(response);
      setStatus("ready");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "We could not load candidate results.");
    }
  }, [localDemo, page, searchState]);

  useEffect(() => { void load(); }, [load]);

  const chips = useMemo(() => {
    const values: string[] = [];
    if (searchState.anyKeywords) values.push(searchState.anyKeywords);
    if (searchState.allKeywords) values.push(`Must include: ${searchState.allKeywords}`);
    if (searchState.location) values.push(searchState.location);
    if (searchState.minExperience || searchState.maxExperience) values.push(`${searchState.minExperience || "0"}–${searchState.maxExperience || "any"} yrs`);
    if (searchState.company) values.push(searchState.company);
    if (searchState.designation) values.push(searchState.designation);
    return values;
  }, [searchState]);

  const total = data?.totalElements ?? 0;
  const currentCount = data?.content.length ?? 0;
  const start = total && data ? data.number * data.size + 1 : 0;
  const end = total ? start + currentCount - 1 : 0;

  return (
    <WorkspaceShell workspace="recruiter" active="sourcing" title="Talent search results" description="Results come from structured filters, Boolean search and deterministic relevance — no AI provider is required.">
      <div className={styles.page}>
        <div className={styles.summary}>
          <div><p>Candidate sourcing</p><h2>{status === "ready" ? `${total} candidate${total === 1 ? "" : "s"} found` : "Searching candidates"}</h2><p>Review profile evidence and open the full candidate dossier before taking a hiring decision.</p></div>
          <div className={styles.actions}><a className={styles.secondaryButton} href={`/recruiter/sourcing?${searchParams.toString()}`}>Modify search</a><a className={styles.linkButton} href="/recruiter/pipeline">Open pipeline</a></div>
        </div>

        {chips.length > 0 && <div className={styles.filters} aria-label="Applied search filters">{chips.map((chip) => <span className={styles.filterChip} key={chip}>{chip}</span>)}</div>}
        {localDemo && <div className={styles.demoNote}>Local demo mode is on. The profiles below are clearly identified test fixtures and are never used as a production fallback.</div>}

        {status === "loading" && <div className={styles.loading} aria-live="polite"><p>Loading candidate results…</p></div>}
        {status === "error" && <div className={styles.error} role="alert"><h3>Search results unavailable</h3><p>{error}</p><button className={styles.retryButton} onClick={() => void load()} type="button">Retry</button></div>}
        {status === "ready" && total === 0 && <div className={styles.empty}><h3>No candidates matched this search</h3><p>Try widening your skills, experience, location or activity criteria.</p><a className={styles.secondaryButton} href={`/recruiter/sourcing?${searchParams.toString()}`}>Modify search</a></div>}

        {status === "ready" && total > 0 && <>
          <div className={styles.list}>
            {data?.content.map((candidate) => (
              <article className={styles.card} key={candidate.candidateId}>
                <div className={styles.cardMain}>
                  <div className={styles.cardHeader}>
                    <div className={styles.avatar} aria-hidden="true">{initials(candidate.fullName)}</div>
                    <div><h3>{candidate.fullName}</h3><p>{candidate.headline || candidate.currentCompany || "Candidate profile"}</p></div>
                  </div>
                  <div className={styles.meta}>
                    {candidate.overallExperienceYears != null && <span>{candidate.overallExperienceYears} yrs experience</span>}
                    {candidate.location && <span>{candidate.location}</span>}
                    {candidate.noticePeriodDays != null && <span>{candidate.noticePeriodDays} day notice</span>}
                    {candidate.expectedSalaryLakhs != null && <span>₹{candidate.expectedSalaryLakhs} LPA expected</span>}
                  </div>
                  <div className={styles.detailGrid}>
                    <span><strong>Current:</strong> {candidate.currentCompany || "Not shared"}</span>
                    <span><strong>Previous:</strong> {[candidate.previousRole, candidate.previousCompany].filter(Boolean).join(" · ") || "Not shared"}</span>
                    <span><strong>Education:</strong> {candidate.highestEducation || "Not shared"}</span>
                    <span><strong>Preferred:</strong> {candidate.preferredLocations || "Not shared"}</span>
                  </div>
                  <div className={styles.skills}>{skillList(candidate.skills).slice(0, 8).map((skill) => <span className={styles.skill} key={skill}>{skill}</span>)}</div>
                  <div className={styles.badges}>
                    {candidate.cvAvailable && <span className={styles.badge}>CV available</span>}
                    {candidate.emailVerified && <span className={styles.badge}>Email verified</span>}
                    {candidate.mobileVerified && <span className={styles.badge}>Mobile verified</span>}
                    {candidate.relevanceScore != null && <span className={styles.badge}>Relevance {Math.round(candidate.relevanceScore <= 1 ? candidate.relevanceScore * 100 : candidate.relevanceScore)}%</span>}
                  </div>
                  <span className={styles.freshness}>Profile updated {freshness(candidate.profileLastUpdatedAt)} · Last active {freshness(candidate.lastActiveAt)}</span>
                </div>
                <div className={styles.cardActions}><a className={styles.linkButton} href={`/recruiter/candidates/${candidate.candidateId}`}>View profile</a></div>
              </article>
            ))}
          </div>
          <nav className={styles.pagination} aria-label="Candidate result pagination">
            <span>{total ? `Showing ${start}–${end} of ${total}` : "0 candidates"}</span>
            <div className={styles.paginationControls}>
              <button disabled={!data || data.number <= 0} type="button" onClick={() => setPage((value) => Math.max(0, value - 1))}>← Previous</button>
              <span>Page {(data?.number ?? 0) + 1} of {Math.max(1, data?.totalPages ?? 1)}</span>
              <button disabled={!data || data.number + 1 >= data.totalPages} type="button" onClick={() => setPage((value) => value + 1)}>Next →</button>
            </div>
          </nav>
        </>}
      </div>
    </WorkspaceShell>
  );
}
