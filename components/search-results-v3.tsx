"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient } from "../lib/api-client";
import { keywordList, sourceRequest, stateFromSearchParams, type RecruiterSearchState } from "../lib/recruiter-search";
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

type Evidence = { label: string; tone: "hit" | "context" };

const demoCandidates: SourcingCandidate[] = [
  { candidateId: "demo-avish-bansal", fullName: "Avish Bansal", headline: "Senior Full Stack Engineer", currentCompany: "StatusNeo Technology Consulting", previousRole: "Senior Software Engineer", previousCompany: "Cognizant", highestEducation: "B.Tech / B.E. · Graphic Era University", location: "Bengaluru", preferredLocations: "Remote, Bengaluru, Gurugram", overallExperienceYears: 5, expectedSalaryLakhs: 24, noticePeriodDays: 30, skills: "TypeScript, Node.js, AWS, Docker, Redis, GraphQL, Microservices", profileSummary: "Full-stack engineer experienced in designing and scaling production systems.", emailVerified: true, mobileVerified: true, cvAvailable: true, similarProfileCount: null, lastActiveAt: "2026-09-09T07:00:00Z", profileLastUpdatedAt: "2026-09-06T10:00:00Z", profileViewCount: 147, profileDownloadCount: 31, relevanceScore: 0.91 },
  { candidateId: "demo-vaibhav-thakur", fullName: "Vaibhav T Thakur", headline: "Senior Software Engineer", currentCompany: "GlobalLogic", previousRole: "Software Engineer", previousCompany: "Thoughtworks", highestEducation: "B.E. Computer Science · Pune University", location: "Bengaluru", preferredLocations: "Bengaluru, Pune", overallExperienceYears: 7, expectedSalaryLakhs: 28, noticePeriodDays: 45, skills: "Java, Kotlin, Node.js, Kafka, Kubernetes, AWS, PostgreSQL", profileSummary: "Backend engineer focused on reliable cloud-native systems.", emailVerified: true, mobileVerified: true, cvAvailable: true, similarProfileCount: null, lastActiveAt: "2026-09-08T10:00:00Z", profileLastUpdatedAt: "2026-09-05T10:00:00Z", profileViewCount: 204, profileDownloadCount: 42, relevanceScore: 0.86 },
];

function skillList(value: string | null) {
  return (value ?? "").split(/[,|]/).map((item) => item.trim()).filter(Boolean);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C";
}

function freshness(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date);
}

function normal(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function candidateEvidence(candidate: SourcingCandidate, search: RecruiterSearchState, maximumNoticePeriodDays: number | null): Evidence[] {
  const evidence: Evidence[] = [];
  const skills = skillList(candidate.skills).map(normal);
  const requestedSkills = [...keywordList(search.allKeywords), ...keywordList(search.anyKeywords)]
    .map((value) => ({ raw: value, normalized: normal(value) }));

  requestedSkills
    .filter((item) => skills.some((skill) => skill.includes(item.normalized) || item.normalized.includes(skill)))
    .map((item) => item.raw)
    .slice(0, 2)
    .forEach((skill) => evidence.push({ label: `Skill: ${skill}`, tone: "hit" }));

  const experience = candidate.overallExperienceYears;
  const minExperience = search.minExperience ? Number(search.minExperience) : null;
  const maxExperience = search.maxExperience ? Number(search.maxExperience) : null;
  if (experience != null && (minExperience == null || experience >= minExperience) && (maxExperience == null || experience <= maxExperience) && (minExperience != null || maxExperience != null)) {
    evidence.push({ label: `Experience ${experience}y in range`, tone: "hit" });
  }
  if (search.location && candidate.location && normal(candidate.location).includes(normal(search.location))) evidence.push({ label: `Location: ${candidate.location}`, tone: "hit" });
  if (search.company && candidate.currentCompany && normal(candidate.currentCompany).includes(normal(search.company))) evidence.push({ label: `Company: ${candidate.currentCompany}`, tone: "hit" });
  if (search.designation && [candidate.headline, candidate.previousRole].filter(Boolean).some((value) => normal(value).includes(normal(search.designation)))) evidence.push({ label: "Title aligned", tone: "hit" });
  if (maximumNoticePeriodDays != null && candidate.noticePeriodDays != null && candidate.noticePeriodDays <= maximumNoticePeriodDays) {
    evidence.push({ label: candidate.noticePeriodDays === 0 ? "Immediate joiner" : `Notice ${candidate.noticePeriodDays}d ≤ ${maximumNoticePeriodDays}d`, tone: "hit" });
  }
  if (candidate.cvAvailable) evidence.push({ label: "CV available", tone: "context" });
  if (evidence.length === 0 && candidate.relevanceScore != null) evidence.push({ label: "Profile text matched query", tone: "context" });
  return evidence.slice(0, 5);
}

function rankLabel(score: number | null) {
  if (score == null) return "—";
  return Number.isFinite(score) ? score.toFixed(2) : "—";
}

export function SearchResultsV3() {
  const searchParams = useSearchParams();
  const searchState = useMemo(() => stateFromSearchParams(searchParams), [searchParams]);
  const maximumNoticePeriodDays = useMemo(() => {
    const raw = searchParams.get("maximumNoticePeriodDays");
    if (raw == null || raw === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }, [searchParams]);
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
        body: JSON.stringify(sourceRequest(searchState, page, 20, { maximumNoticePeriodDays })),
      });
      setData(response);
      setStatus("ready");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "We could not load candidate results.");
    }
  }, [localDemo, maximumNoticePeriodDays, page, searchState]);

  useEffect(() => { void load(); }, [load]);

  const total = data?.totalElements ?? 0;
  const start = total && data ? data.number * data.size + 1 : 0;
  const end = total ? start + (data?.content.length ?? 0) - 1 : 0;
  const criteria = useMemo(() => {
    const rows: Array<[string, string]> = [];
    if (searchState.anyKeywords) rows.push(["Preferred keywords", searchState.anyKeywords]);
    if (searchState.allKeywords) rows.push(["Must include", searchState.allKeywords]);
    if (searchState.booleanQuery) rows.push(["Boolean", searchState.booleanQuery]);
    if (searchState.designation) rows.push(["Title", searchState.designation]);
    if (searchState.location) rows.push(["Location", searchState.location]);
    if (searchState.minExperience || searchState.maxExperience) rows.push(["Experience", `${searchState.minExperience || "0"}–${searchState.maxExperience || "Any"} years`]);
    if (maximumNoticePeriodDays != null) rows.push(["Notice", maximumNoticePeriodDays === 0 ? "Immediate" : `≤ ${maximumNoticePeriodDays} days`]);
    if (searchState.company) rows.push(["Company", searchState.company]);
    return rows;
  }, [maximumNoticePeriodDays, searchState]);

  const modifyUrl = `/recruiter/sourcing?${searchParams.toString()}`;

  return (
    <WorkspaceShell workspace="recruiter" active="sourcing" title="Talent search results" description="Deterministic candidate retrieval with explainable evidence. The search rank is a retrieval signal, not a probability or AI-generated fit percentage.">
      <div className={styles.workspace}>
        <aside className={styles.filterRail}>
          <header><div><span>Active search</span><strong>{criteria.length ? `${criteria.length} criteria` : "Broad search"}</strong></div><a href={modifyUrl}>Modify</a></header>
          <dl>{criteria.map(([label, value]) => <div key={`${label}-${value}`}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <div className={styles.privacyNote}><strong>Privacy boundary</strong><span>Contact values are intentionally excluded from sourcing results. Audited contact reveal is available only in a job pipeline context.</span></div>
          <a className={styles.secondaryLink} href="/recruiter/pipeline">Open pipeline</a>
        </aside>

        <main className={styles.results}>
          <div className={styles.summary}><div><span>Candidate sourcing</span><h2>{status === "ready" ? `${total} candidate${total === 1 ? "" : "s"} found` : "Searching candidates"}</h2><p>Compare evidence in-row before opening a candidate dossier.</p></div><a className={styles.secondaryLink} href={modifyUrl}>Edit search</a></div>
          {localDemo && <div className={styles.demoNote}>Local demo mode is enabled. These fixtures are never used as a production fallback.</div>}
          {status === "loading" && <div className={styles.state} role="status"><strong>Loading candidate results…</strong><span>Running your current sourcing criteria.</span></div>}
          {status === "error" && <div className={styles.state} role="alert"><strong>Search results unavailable</strong><span>{error}</span><button type="button" onClick={() => void load()}>Retry</button></div>}
          {status === "ready" && total === 0 && <div className={styles.state}><strong>No candidates matched this search</strong><span>Widen skills, experience, location, activity, or notice-period criteria.</span><a href={modifyUrl}>Modify search</a></div>}

          {status === "ready" && total > 0 && <>
            <div className={styles.tableMeta}><span>Showing {start}–{end} of {total}</span><small>Search rank is shown with evidence; it is not a match probability.</small></div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Candidate</th><th>Skills</th><th>Experience</th><th>Notice</th><th>Current context</th><th>Why this result</th><th>Activity</th><th>Action</th></tr></thead>
                <tbody>{data?.content.map((candidate) => {
                  const skills = skillList(candidate.skills);
                  const evidence = candidateEvidence(candidate, searchState, maximumNoticePeriodDays);
                  return <tr key={candidate.candidateId}>
                    <td><div className={styles.identity}><span className={styles.avatar} aria-hidden="true">{initials(candidate.fullName)}</span><span><strong>{candidate.fullName}</strong><small>{candidate.headline || "Candidate profile"}</small></span></div></td>
                    <td><div className={styles.skills}>{skills.slice(0, 5).map((skill) => <span key={skill}>{skill}</span>)}{skills.length > 5 && <small>+{skills.length - 5}</small>}</div></td>
                    <td className={styles.data}>{candidate.overallExperienceYears == null ? "—" : `${candidate.overallExperienceYears} yrs`}</td>
                    <td className={styles.data}>{candidate.noticePeriodDays == null ? "—" : candidate.noticePeriodDays === 0 ? "Immediate" : `${candidate.noticePeriodDays}d`}</td>
                    <td><div className={styles.context}><strong>{candidate.currentCompany || "Company not shared"}</strong><small>{candidate.location || "Location not shared"}</small><small>{candidate.highestEducation || "Education not shared"}</small></div></td>
                    <td><div className={styles.evidence}><div className={styles.rank}><span>Search rank</span><strong>{rankLabel(candidate.relevanceScore)}</strong></div><div>{evidence.map((item) => <span className={item.tone === "hit" ? styles.hit : styles.contextChip} key={item.label}>{item.label}</span>)}</div></div></td>
                    <td><div className={styles.context}><strong>{freshness(candidate.lastActiveAt)}</strong><small>Updated {freshness(candidate.profileLastUpdatedAt)}</small></div></td>
                    <td><a className={styles.primaryLink} href={`/recruiter/candidates/${candidate.candidateId}`}>View profile</a></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>

            <div className={styles.mobileList}>{data?.content.map((candidate) => <article key={candidate.candidateId}>
              <header><div className={styles.identity}><span className={styles.avatar} aria-hidden="true">{initials(candidate.fullName)}</span><span><strong>{candidate.fullName}</strong><small>{candidate.headline || candidate.currentCompany || "Candidate profile"}</small></span></div><span className={styles.rankMobile}>Rank {rankLabel(candidate.relevanceScore)}</span></header>
              <div className={styles.skills}>{skillList(candidate.skills).slice(0, 5).map((skill) => <span key={skill}>{skill}</span>)}</div>
              <dl><div><dt>Experience</dt><dd>{candidate.overallExperienceYears == null ? "—" : `${candidate.overallExperienceYears} yrs`}</dd></div><div><dt>Notice</dt><dd>{candidate.noticePeriodDays == null ? "—" : candidate.noticePeriodDays === 0 ? "Immediate" : `${candidate.noticePeriodDays}d`}</dd></div><div><dt>Location</dt><dd>{candidate.location || "—"}</dd></div></dl>
              <div className={styles.evidenceChips}>{candidateEvidence(candidate, searchState, maximumNoticePeriodDays).map((item) => <span className={item.tone === "hit" ? styles.hit : styles.contextChip} key={item.label}>{item.label}</span>)}</div>
              <a className={styles.primaryLink} href={`/recruiter/candidates/${candidate.candidateId}`}>View profile</a>
            </article>)}</div>

            <nav className={styles.pagination} aria-label="Candidate result pagination"><span>{total ? `Showing ${start}–${end} of ${total}` : "0 candidates"}</span><div><button disabled={!data || data.number <= 0} type="button" onClick={() => setPage((value) => Math.max(0, value - 1))}>← Previous</button><span>Page {(data?.number ?? 0) + 1} of {Math.max(1, data?.totalPages ?? 1)}</span><button disabled={!data || data.number + 1 >= data.totalPages} type="button" onClick={() => setPage((value) => value + 1)}>Next →</button></div></nav>
          </>}
        </main>
      </div>
    </WorkspaceShell>
  );
}
