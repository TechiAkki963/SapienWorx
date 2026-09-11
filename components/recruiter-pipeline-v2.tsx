"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";
import { WorkspaceShell } from "./ui";
import styles from "./recruiter-pipeline-v2.module.css";

type PipelineStage = "APPLIED" | "SCREENING" | "INTERVIEWING" | "FINAL_STAGE" | "OFFER" | "ONBOARDED" | "REJECTED";
type CareerStage = "" | "FRESHER" | "EXPERIENCED";

type PipelineCandidate = {
  applicationId: string;
  candidateId: string;
  fullName: string;
  headline: string | null;
  currentCompany: string | null;
  location: string | null;
  preferredLocations: string[];
  overallExperienceYears: number | null;
  expectedSalaryLakhs: number | null;
  noticePeriodDays: number | null;
  departmentRole: string | null;
  educationSummary: string | null;
  careerStage: "FRESHER" | "EXPERIENCED" | null;
  jobId: string;
  jobTitle: string;
  skills: string[];
  maskedEmail: string | null;
  maskedMobile: string | null;
  pipelineStage: PipelineStage;
  recentNotes: string[];
  profileLastUpdatedAt: string | null;
  lastActiveAt: string | null;
  lastRecruiterViewedAt: string | null;
  applicationSource: string;
  referralCode: string | null;
};

type PageResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
  empty: boolean;
};

type Filters = {
  minExp: string; maxExp: string; skill: string; company: string; education: string; location: string;
  minSalary: string; maxSalary: string; notice: string; activeDays: string; careerStage: CareerStage; gender: string; jobRole: string;
};

const emptyFilters: Filters = { minExp: "", maxExp: "", skill: "", company: "", education: "", location: "", minSalary: "", maxSalary: "", notice: "", activeDays: "", careerStage: "", gender: "", jobRole: "" };
const stages: Array<{ value: "" | PipelineStage; label: string }> = [
  { value: "", label: "All stages" }, { value: "APPLIED", label: "Applied" }, { value: "SCREENING", label: "Screening" },
  { value: "INTERVIEWING", label: "Interviewing" }, { value: "FINAL_STAGE", label: "Final stage" }, { value: "OFFER", label: "Offer" },
  { value: "ONBOARDED", label: "Hired" }, { value: "REJECTED", label: "Rejected" },
];
const pageSizes = [10, 20, 40, 80] as const;
const numericKeys: Array<[keyof Filters, string]> = [
  ["minExp", "minimumExperienceYears"], ["maxExp", "maximumExperienceYears"], ["minSalary", "minimumSalaryLakhs"],
  ["maxSalary", "maximumSalaryLakhs"], ["notice", "maximumNoticePeriodDays"], ["activeDays", "activeWithinDays"],
];

function humanStage(stage: PipelineStage) { return stages.find((item) => item.value === stage)?.label ?? stage; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C"; }
function formatFreshness(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value); if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}

export function RecruiterPipelineV2() {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<"" | PipelineStage>("");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<(typeof pageSizes)[number]>(10);
  const [data, setData] = useState<PageResponse<PipelineCandidate> | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStage, setBulkStage] = useState<PipelineStage>("SCREENING");
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading"); setError("");
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (query.trim()) params.set("query", query.trim()); if (stage) params.set("stage", stage);
    (["skill", "company", "education", "location", "gender", "jobRole"] as const).forEach((key) => { if (filters[key].trim()) params.set(key, filters[key].trim()); });
    if (filters.careerStage) params.set("careerStage", filters.careerStage);
    numericKeys.forEach(([key, param]) => { if (filters[key]) params.set(param, filters[key]); });
    try {
      const response = await apiClient<PageResponse<PipelineCandidate>>(`/api/recruiter/pipeline?${params.toString()}`);
      setData(response); setStatus("ready");
      setSelected((current) => new Set([...current].filter((id) => response.content.some((candidate) => candidate.applicationId === id))));
    } catch (caught) {
      setStatus("error"); setError(caught instanceof Error ? caught.message : "We could not load the candidate pipeline.");
    }
  }, [page, pageSize, query, stage, filters]);

  useEffect(() => { void load(); }, [load]);

  const moveStage = async (candidate: PipelineCandidate, nextStage: PipelineStage) => {
    if (nextStage === candidate.pipelineStage) return;
    setUpdatingId(candidate.applicationId); setActionMessage(""); setError("");
    try {
      await apiClient<PipelineCandidate>(`/api/recruiter/pipeline/${candidate.applicationId}/stage`, { method: "PATCH", body: JSON.stringify({ stage: nextStage }) });
      setActionMessage(`${candidate.fullName} moved to ${humanStage(nextStage)}.`); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We could not update the candidate stage."); }
    finally { setUpdatingId(null); }
  };

  const bulkMove = async () => {
    if (!selected.size) return;
    setBulkBusy(true); setError(""); setActionMessage("");
    try {
      await apiClient<PipelineCandidate[]>("/api/recruiter/pipeline/bulk-stage", { method: "PATCH", body: JSON.stringify({ applicationIds: [...selected], stage: bulkStage }) });
      setActionMessage(`${selected.size} candidate${selected.size === 1 ? "" : "s"} moved to ${humanStage(bulkStage)}.`); setSelected(new Set()); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We could not update the selected candidates."); }
    finally { setBulkBusy(false); }
  };

  const showing = useMemo(() => {
    if (!data || data.totalElements === 0) return "0 candidates";
    const start = data.number * data.size + 1; const end = start + data.numberOfElements - 1;
    return `Showing ${start}–${end} of ${data.totalElements} candidates`;
  }, [data]);
  const visibleIds = data?.content.map((candidate) => candidate.applicationId) ?? [];
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const updateFilter = (key: keyof Filters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(0); };
  const resetFilters = () => { setFilters(emptyFilters); setQuery(""); setStage(""); setPage(0); };

  return <WorkspaceShell workspace="recruiter" active="pipeline" title="Candidate Pipeline" description="Search, filter and act on candidates in a structured list. Ten candidates are shown per page by default.">
    <section aria-label="Pipeline controls" className={styles.toolbar}>
      <label className={styles.fieldGrow}><span className={styles.label}>Search candidates</span><input className={styles.input} value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Name, job or keyword" /></label>
      <label className={styles.field}><span className={styles.label}>Pipeline stage</span><select className={styles.select} value={stage} onChange={(event) => { setStage(event.target.value as "" | PipelineStage); setPage(0); }}>{stages.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}</select></label>
      <button className={styles.resetButton} type="button" onClick={resetFilters}>Reset filters</button>
    </section>

    <details className={styles.filters}>
      <summary>Advanced filters</summary>
      <div className={styles.filterGrid}>
        <label className={styles.field}><span className={styles.label}>Min experience</span><input className={styles.input} type="number" min="0" value={filters.minExp} onChange={(e) => updateFilter("minExp", e.target.value)} placeholder="Years" /></label>
        <label className={styles.field}><span className={styles.label}>Max experience</span><input className={styles.input} type="number" min="0" value={filters.maxExp} onChange={(e) => updateFilter("maxExp", e.target.value)} placeholder="Years" /></label>
        <label className={styles.field}><span className={styles.label}>Skill</span><input className={styles.input} value={filters.skill} onChange={(e) => updateFilter("skill", e.target.value)} placeholder="Java, React…" /></label>
        <label className={styles.field}><span className={styles.label}>Current company</span><input className={styles.input} value={filters.company} onChange={(e) => updateFilter("company", e.target.value)} placeholder="Company" /></label>
        <label className={styles.field}><span className={styles.label}>Education</span><input className={styles.input} value={filters.education} onChange={(e) => updateFilter("education", e.target.value)} placeholder="Degree or institution" /></label>
        <label className={styles.field}><span className={styles.label}>Location</span><input className={styles.input} value={filters.location} onChange={(e) => updateFilter("location", e.target.value)} placeholder="Mumbai, Remote…" /></label>
        <label className={styles.field}><span className={styles.label}>Min salary (LPA)</span><input className={styles.input} type="number" min="0" value={filters.minSalary} onChange={(e) => updateFilter("minSalary", e.target.value)} /></label>
        <label className={styles.field}><span className={styles.label}>Max salary (LPA)</span><input className={styles.input} type="number" min="0" value={filters.maxSalary} onChange={(e) => updateFilter("maxSalary", e.target.value)} /></label>
        <label className={styles.field}><span className={styles.label}>Max notice period</span><select className={styles.select} value={filters.notice} onChange={(e) => updateFilter("notice", e.target.value)}><option value="">Any</option><option value="0">Immediate</option><option value="15">15 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select></label>
        <label className={styles.field}><span className={styles.label}>Last active</span><select className={styles.select} value={filters.activeDays} onChange={(e) => updateFilter("activeDays", e.target.value)}><option value="">Any time</option><option value="1">24 hours</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label>
        <label className={styles.field}><span className={styles.label}>Career stage</span><select className={styles.select} value={filters.careerStage} onChange={(e) => updateFilter("careerStage", e.target.value)}><option value="">Any</option><option value="FRESHER">Fresher</option><option value="EXPERIENCED">Experienced</option></select></label>
        <label className={styles.field}><span className={styles.label}>Job role</span><input className={styles.input} value={filters.jobRole} onChange={(e) => updateFilter("jobRole", e.target.value)} placeholder="Role / department" /></label>
        <label className={styles.field}><span className={styles.label}>Gender (consented profiles only)</span><select className={styles.select} value={filters.gender} onChange={(e) => updateFilter("gender", e.target.value)}><option value="">Any</option><option value="female">Female</option><option value="male">Male</option><option value="non-binary">Non-binary</option></select></label>
      </div>
    </details>

    {selected.size > 0 && <section className={styles.bulkBar} aria-label="Bulk actions"><strong>{selected.size} selected</strong><select value={bulkStage} onChange={(e) => setBulkStage(e.target.value as PipelineStage)}>{stages.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button type="button" disabled={bulkBusy} onClick={() => void bulkMove()}>{bulkBusy ? "Updating…" : "Move selected"}</button><button type="button" className={styles.clearButton} onClick={() => setSelected(new Set())}>Clear</button></section>}
    {actionMessage && <p className={styles.success} role="status">{actionMessage}</p>}
    {error && status !== "error" && <p className={styles.error} role="alert">{error}</p>}
    {status === "loading" && <div className={styles.state} aria-live="polite"><h2>Loading candidates…</h2><p>Fetching the latest pipeline records.</p></div>}
    {status === "error" && <div className={styles.state} role="alert"><h2>Pipeline unavailable</h2><p>{error}</p><button className={styles.actionButton} type="button" onClick={() => void load()}>Retry</button></div>}
    {status === "ready" && data?.empty && <div className={styles.state}><h2>No candidates found</h2><p>Try another search or filter combination.</p></div>}

    {status === "ready" && data && !data.empty && <>
      <div className={styles.listHeader}><p className={styles.status}>{showing}</p><label className={styles.selectAll}><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(visibleIds))} /> Select this page</label></div>
      <div className={styles.list}>{data.content.map((candidate) => <article className={`${styles.card} ${selected.has(candidate.applicationId) ? styles.cardSelected : ""}`} key={candidate.applicationId}>
        <div className={styles.top}><div className={styles.identity}><input className={styles.checkbox} aria-label={`Select ${candidate.fullName}`} type="checkbox" checked={selected.has(candidate.applicationId)} onChange={() => setSelected((current) => { const next = new Set(current); next.has(candidate.applicationId) ? next.delete(candidate.applicationId) : next.add(candidate.applicationId); return next; })} /><div className={styles.avatar} aria-hidden="true">{initials(candidate.fullName)}</div><div><h2 className={styles.name}>{candidate.fullName}</h2><p className={styles.headline}>{candidate.headline || candidate.departmentRole || "Candidate profile"}</p></div></div><span className={styles.stage}>{humanStage(candidate.pipelineStage)}</span></div>
        <div className={styles.facts}>
          <div className={styles.fact}><span>Job</span><strong>{candidate.jobTitle}</strong></div><div className={styles.fact}><span>Current company</span><strong>{candidate.currentCompany || "Not shared"}</strong></div>
          <div className={styles.fact}><span>Experience</span><strong>{candidate.overallExperienceYears == null ? "Not shared" : `${candidate.overallExperienceYears} years`}</strong></div><div className={styles.fact}><span>Location</span><strong>{candidate.location || "Not shared"}</strong></div>
          <div className={styles.fact}><span>Preferred locations</span><strong>{candidate.preferredLocations?.length ? candidate.preferredLocations.join(", ") : "Not shared"}</strong></div><div className={styles.fact}><span>Education</span><strong>{candidate.educationSummary || "Not shared"}</strong></div>
          <div className={styles.fact}><span>Notice period</span><strong>{candidate.noticePeriodDays == null ? "Not shared" : `${candidate.noticePeriodDays} days`}</strong></div><div className={styles.fact}><span>Expected salary</span><strong>{candidate.expectedSalaryLakhs == null ? "Not shared" : `₹${candidate.expectedSalaryLakhs} LPA`}</strong></div>
          <div className={styles.fact}><span>Source</span><strong>{candidate.applicationSource || "Direct"}</strong></div><div className={styles.fact}><span>Last active</span><strong>{formatFreshness(candidate.lastActiveAt)}</strong></div>
          <div className={styles.fact}><span>Profile updated</span><strong>{formatFreshness(candidate.profileLastUpdatedAt)}</strong></div><div className={styles.fact}><span>Last viewed by you</span><strong>{formatFreshness(candidate.lastRecruiterViewedAt)}</strong></div>
        </div>
        {candidate.skills.length > 0 && <div className={styles.skills}>{candidate.skills.slice(0, 8).map((skill) => <span className={styles.skill} key={skill}>{skill}</span>)}</div>}
        {candidate.recentNotes[0] && <div className={styles.notes}><strong>Latest note:</strong> {candidate.recentNotes[0]}</div>}
        <div className={styles.actions}><a className={styles.actionLink} href={`/recruiter/jobs/${encodeURIComponent(candidate.jobId)}/applications/${candidate.applicationId}`}>View profile</a><a className={styles.actionButton} href={`/recruiter/communications?candidate=${candidate.candidateId}&job=${encodeURIComponent(candidate.jobId)}`}>Message</a><a className={styles.actionButton} href={`/recruiter/interviews?application=${candidate.applicationId}`}>Schedule interview</a><div className={styles.move}><label htmlFor={`stage-${candidate.applicationId}`}>Move stage</label><select id={`stage-${candidate.applicationId}`} value={candidate.pipelineStage} disabled={updatingId === candidate.applicationId} onChange={(event) => void moveStage(candidate, event.target.value as PipelineStage)}>{stages.filter((item): item is { value: PipelineStage; label: string } => Boolean(item.value)).map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></div></div>
      </article>)}</div>
      <nav className={styles.pagination} aria-label="Pipeline pagination"><span className={styles.paginationInfo}>{showing}</span><div className={styles.paginationControls}><button type="button" disabled={data.first} onClick={() => setPage((value) => Math.max(0, value - 1))}>← Previous</button><span className={styles.paginationInfo}>Page {data.number + 1} of {Math.max(1, data.totalPages)}</span><button type="button" disabled={data.last} onClick={() => setPage((value) => value + 1)}>Next →</button><label className={styles.pageSize}>Candidates per page<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value) as (typeof pageSizes)[number]); setPage(0); }}>{pageSizes.map((size) => <option value={size} key={size}>{size}</option>)}</select></label></div></nav>
    </>}
  </WorkspaceShell>;
}
