"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";
import { Button, WorkspaceShell } from "./ui";
import styles from "./candidate-jobs-v2.module.css";

type PublicJob = {
  jobId: string;
  title: string;
  organisationName: string;
  location: string;
  department: string;
  employmentType?: string | null;
  workplaceModel?: string | null;
  minimumExperienceYears: number;
  maximumExperienceYears: number;
  minimumSalaryLakhs: number | null;
  maximumSalaryLakhs: number | null;
  salaryVisible: boolean;
  descriptionHtml: string;
  skills: string[];
  publishedAt: string | null;
  publicPath: string;
  matchScore?: number | null;
  matchReasons?: string[] | null;
};

type PublicJobPage = { content: PublicJob[] };
type CandidateDashboardSnapshot = { performance: { profileCompleteness: number } };
type Filters = { query: string; location: string; minimumExperience: string; workplaceModel: string; postedWithin: string };
type Sort = "RECENT" | "SALARY" | "RELEVANCE";

const emptyFilters: Filters = { query: "", location: "", minimumExperience: "", workplaceModel: "", postedWithin: "" };

function daysAgo(value: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
}

function postedLabel(value: string | null) {
  const days = daysAgo(value);
  if (days === 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  if (days === Number.MAX_SAFE_INTEGER) return "Recently posted";
  return `Posted ${days} days ago`;
}

function salaryLabel(job: PublicJob) {
  if (!job.salaryVisible || job.minimumSalaryLakhs == null || job.maximumSalaryLakhs == null) return "Salary not disclosed";
  return `₹${job.minimumSalaryLakhs}–${job.maximumSalaryLakhs} LPA`;
}

function workMode(job: PublicJob) {
  return (job.workplaceModel || job.employmentType || "Work arrangement not specified").replaceAll("_", " ").toLowerCase().replace(/^./, (char) => char.toUpperCase());
}

export function CandidateJobsV2({ sharedJobId, sharedApplyOutcome }: { sharedJobId?: string; sharedApplyOutcome?: string } = {}) {
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [sort, setSort] = useState<Sort>("RELEVANCE");
  const [selectedId, setSelectedId] = useState<string | null>(sharedJobId ?? null);
  const [saved, setSaved] = useState<string[]>([]);
  const [applied, setApplied] = useState<string[]>([]);
  const [profileCompleteness, setProfileCompleteness] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(() => sharedApplyOutcome === "applied" ? "Your shared-link application was submitted successfully." : sharedApplyOutcome === "already-applied" ? "You had already applied to this role." : "");
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    let current = true;
    setLoading(true);
    void Promise.allSettled([
      apiClient<PublicJobPage>("/api/public/jobs"),
      apiClient<CandidateDashboardSnapshot>("/api/candidate/dashboard?rangeDays=90"),
    ]).then(([jobResult, dashboardResult]) => {
      if (!current) return;
      if (jobResult.status === "fulfilled") {
        setJobs(jobResult.value.content);
        setSelectedId((existing) => existing ?? jobResult.value.content[0]?.jobId ?? null);
      } else {
        setError(jobResult.reason instanceof Error ? jobResult.reason.message : "We could not load open roles.");
      }
      if (dashboardResult.status === "fulfilled") setProfileCompleteness(dashboardResult.value.performance.profileCompleteness);
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);

  const locations = useMemo(() => Array.from(new Set(jobs.map((job) => job.location).filter(Boolean))).sort(), [jobs]);
  const visibleJobs = useMemo(() => {
    const filtered = jobs.filter((job) => {
      const searchable = `${job.title} ${job.organisationName} ${job.department} ${job.skills.join(" ")}`.toLowerCase();
      const minimumExperience = filters.minimumExperience ? Number(filters.minimumExperience) : null;
      const postedWithin = filters.postedWithin ? Number(filters.postedWithin) : null;
      return (!filters.query || searchable.includes(filters.query.toLowerCase()))
        && (!filters.location || job.location === filters.location)
        && (minimumExperience == null || job.maximumExperienceYears >= minimumExperience)
        && (!filters.workplaceModel || (job.workplaceModel || "").toUpperCase() === filters.workplaceModel)
        && (postedWithin == null || daysAgo(job.publishedAt) <= postedWithin);
    });
    return [...filtered].sort((left, right) => {
      if (sort === "RECENT") return daysAgo(left.publishedAt) - daysAgo(right.publishedAt);
      if (sort === "SALARY") return (right.maximumSalaryLakhs ?? -1) - (left.maximumSalaryLakhs ?? -1);
      const leftHasMatch = typeof left.matchScore === "number";
      const rightHasMatch = typeof right.matchScore === "number";
      if (leftHasMatch && rightHasMatch) return (right.matchScore ?? 0) - (left.matchScore ?? 0);
      if (leftHasMatch) return -1;
      if (rightHasMatch) return 1;
      return daysAgo(left.publishedAt) - daysAgo(right.publishedAt);
    });
  }, [filters, jobs, sort]);

  const selectedJob = visibleJobs.find((job) => job.jobId === selectedId) ?? visibleJobs[0] ?? null;
  const canQuickApply = (profileCompleteness ?? 0) >= 70;

  async function applyFor(job: PublicJob) {
    if (!canQuickApply) return;
    setApplyingId(job.jobId); setError(""); setNotice("");
    try {
      await apiClient(`/api/candidate/jobs/${encodeURIComponent(job.jobId)}/applications`, { method: "POST", body: JSON.stringify({ coverLetter: null }) });
      setApplied((current) => current.includes(job.jobId) ? current : [...current, job.jobId]);
      setNotice(`Applied ✓ ${job.title} at ${job.organisationName} is now in your application tracker.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not submit your application. Please try again.");
    } finally { setApplyingId(null); }
  }

  return <WorkspaceShell workspace="candidate" active="jobs" title="Find your next role" description="Search, compare and apply with a clear view of the role before you commit.">
    <main className={styles.page}>
      {notice && <div className={styles.notice} role="status">{notice}</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}

      <header className={styles.hero}>
        <div><span className={styles.eyebrow}>Job discovery</span><h2>Explore roles without losing context.</h2><p>Filter on the left, compare roles in the middle, then review the full opportunity before applying.</p></div>
        <div className={styles.heroActions}><Button href="/candidate/profile" variant="secondary">Improve profile</Button><span>{profileCompleteness == null ? "Checking profile…" : `Profile ${profileCompleteness}% complete`}</span></div>
      </header>

      <div className={styles.mobileToolbar}><button type="button" onClick={() => setFiltersOpen(true)}>Filters</button><label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="RELEVANCE">Relevance</option><option value="RECENT">Newest</option><option value="SALARY">Salary</option></select></label></div>

      <section className={styles.layout}>
        <aside className={`${styles.filters} ${filtersOpen ? styles.filtersOpen : ""}`} aria-label="Job filters">
          <div className={styles.filterHeader}><div><span className={styles.eyebrow}>Filters</span><h3>Refine roles</h3></div><button type="button" onClick={() => setFilters(emptyFilters)}>Clear</button></div>
          <label><span>Title, skill or organisation</span><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Java, recruiter, cloud…" /></label>
          <label><span>Location</span><select value={filters.location} onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}><option value="">All locations</option>{locations.map((location) => <option key={location} value={location}>{location}</option>)}</select></label>
          <label><span>Minimum experience</span><select value={filters.minimumExperience} onChange={(event) => setFilters((current) => ({ ...current, minimumExperience: event.target.value }))}><option value="">Any experience</option><option value="0">0 years</option><option value="2">2 years</option><option value="4">4 years</option><option value="6">6 years</option></select></label>
          <label><span>Work mode</span><select value={filters.workplaceModel} onChange={(event) => setFilters((current) => ({ ...current, workplaceModel: event.target.value }))}><option value="">Any</option><option value="REMOTE">Remote</option><option value="HYBRID">Hybrid</option><option value="ON_SITE">On-site</option></select></label>
          <label><span>Posted</span><select value={filters.postedWithin} onChange={(event) => setFilters((current) => ({ ...current, postedWithin: event.target.value }))}><option value="">Any time</option><option value="1">Past 24 hours</option><option value="7">Past week</option><option value="30">Past month</option></select></label>
          <div className={styles.filterFooter}><button type="button" onClick={() => setFiltersOpen(false)}>Show {visibleJobs.length} roles</button></div>
        </aside>

        <section className={styles.results} aria-label="Job results">
          <div className={styles.resultsHeader}><div><strong>{loading ? "Loading roles…" : `${visibleJobs.length} open ${visibleJobs.length === 1 ? "role" : "roles"}`}</strong><span>Only verified job facts are shown.</span></div><label className={styles.desktopSort}><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="RELEVANCE">Relevance</option><option value="RECENT">Newest</option><option value="SALARY">Salary</option></select></label></div>
          <div className={styles.resultList}>{!loading && visibleJobs.length === 0 ? <div className={styles.empty}><strong>No roles match those filters.</strong><p>Widen your filters to see more opportunities.</p><button type="button" onClick={() => setFilters(emptyFilters)}>Reset filters</button></div> : visibleJobs.map((job) => <button type="button" className={`${styles.resultCard} ${selectedJob?.jobId === job.jobId ? styles.selected : ""}`} key={job.jobId} onClick={() => setSelectedId(job.jobId)}>
            <div className={styles.resultTop}><span className={styles.logo}>{job.organisationName.slice(0, 1).toUpperCase()}</span><span className={styles.saveButton} role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); setSaved((current) => current.includes(job.jobId) ? current.filter((id) => id !== job.jobId) : [...current, job.jobId]); }}>{saved.includes(job.jobId) ? "♥" : "♡"}</span></div>
            <h3>{job.title}</h3><p>{job.organisationName}</p>
            <div className={styles.resultMeta}><span>{job.location}</span><span>{job.minimumExperienceYears}–{job.maximumExperienceYears} years</span><span>{salaryLabel(job)}</span></div>
            <div className={styles.skillRow}>{job.skills.slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}</div>
            {typeof job.matchScore === "number" && <div className={styles.verifiedMatch}><strong>{job.matchScore}% match</strong>{job.matchReasons?.slice(0, 2).map((reason) => <span key={reason}>{reason}</span>)}</div>}
            <small>{postedLabel(job.publishedAt)}</small>
          </button>)}</div>
        </section>

        <article className={styles.detail} aria-live="polite">
          {selectedJob ? <>
            <div className={styles.detailHeader}><div><span className={styles.eyebrow}>{selectedJob.organisationName}</span><h2>{selectedJob.title}</h2><p>{selectedJob.location} · {workMode(selectedJob)}</p></div><span className={styles.detailLogo}>{selectedJob.organisationName.slice(0, 1).toUpperCase()}</span></div>
            <div className={styles.factGrid}><div><span>Experience</span><strong>{selectedJob.minimumExperienceYears}–{selectedJob.maximumExperienceYears} years</strong></div><div><span>Salary</span><strong>{salaryLabel(selectedJob)}</strong></div><div><span>Work mode</span><strong>{workMode(selectedJob)}</strong></div><div><span>Posted</span><strong>{postedLabel(selectedJob.publishedAt).replace("Posted ", "")}</strong></div></div>
            {typeof selectedJob.matchScore === "number" && <section className={styles.matchPanel}><span className={styles.eyebrow}>Explainable match</span><h3>{selectedJob.matchScore}% profile match</h3><div>{selectedJob.matchReasons?.length ? selectedJob.matchReasons.map((reason) => <span key={reason}>✓ {reason}</span>) : <p>Match details are not available for this role.</p>}</div></section>}
            <section className={styles.detailSection}><h3>Role overview</h3><div className={styles.description} dangerouslySetInnerHTML={{ __html: selectedJob.descriptionHtml }} /></section>
            <section className={styles.detailSection}><h3>Skills</h3><div className={styles.skillRow}>{selectedJob.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></section>
            <div className={styles.detailActions}>
              {applied.includes(selectedJob.jobId) ? <span className={styles.applied}>Applied ✓</span> : canQuickApply ? <button type="button" className={styles.primaryAction} disabled={applyingId === selectedJob.jobId} onClick={() => void applyFor(selectedJob)}>{applyingId === selectedJob.jobId ? "Applying…" : "Quick Apply"}</button> : <Button href="/candidate/profile">Complete profile to apply</Button>}
              <a href={selectedJob.publicPath}>Full job details</a>
            </div>
            {!canQuickApply && profileCompleteness != null && <p className={styles.profileGate}>Quick Apply unlocks at 70% profile completion. Your profile is currently {profileCompleteness}% complete.</p>}
          </> : <div className={styles.empty}><strong>Select a role to review the details.</strong></div>}
        </article>
      </section>
      {filtersOpen && <button className={styles.scrim} aria-label="Close filters" onClick={() => setFiltersOpen(false)} />}
    </main>
  </WorkspaceShell>;
}
