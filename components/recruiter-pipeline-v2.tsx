"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";
import { WorkspaceShell } from "./ui";
import styles from "./recruiter-pipeline-v2.module.css";

type PipelineStage = "APPLIED" | "SCREENING" | "INTERVIEWING" | "FINAL_STAGE" | "OFFER" | "ONBOARDED" | "REJECTED";

type PipelineCandidate = {
  applicationId: string;
  candidateId: string;
  fullName: string;
  headline: string | null;
  currentCompany: string | null;
  location: string | null;
  preferredLocations: string | null;
  overallExperienceYears: number | null;
  expectedSalaryLakhs: number | null;
  noticePeriodDays: number | null;
  jobId: string;
  jobTitle: string;
  skills: string[];
  maskedEmail: string | null;
  maskedMobile: string | null;
  pipelineStage: PipelineStage;
  recentNotes: string[];
  profileLastUpdatedAt: string | null;
  lastActiveAt: string | null;
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

const stages: Array<{ value: "" | PipelineStage; label: string }> = [
  { value: "", label: "All stages" },
  { value: "APPLIED", label: "Applied" },
  { value: "SCREENING", label: "Screening" },
  { value: "INTERVIEWING", label: "Interviewing" },
  { value: "FINAL_STAGE", label: "Final stage" },
  { value: "OFFER", label: "Offer" },
  { value: "ONBOARDED", label: "Hired" },
  { value: "REJECTED", label: "Rejected" },
];

const pageSizes = [10, 20, 40, 80] as const;

function humanStage(stage: PipelineStage) {
  return stages.find((item) => item.value === stage)?.label ?? stage;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C";
}

function formatFreshness(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}

export function RecruiterPipelineV2() {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<"" | PipelineStage>("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<(typeof pageSizes)[number]>(20);
  const [data, setData] = useState<PageResponse<PipelineCandidate> | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (query.trim()) params.set("query", query.trim());
    if (stage) params.set("stage", stage);
    try {
      const response = await apiClient<PageResponse<PipelineCandidate>>(`/api/recruiter/pipeline?${params.toString()}`);
      setData(response);
      setStatus("ready");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "We could not load the candidate pipeline.");
    }
  }, [page, pageSize, query, stage]);

  useEffect(() => { void load(); }, [load]);

  const moveStage = async (candidate: PipelineCandidate, nextStage: PipelineStage) => {
    if (nextStage === candidate.pipelineStage) return;
    setUpdatingId(candidate.applicationId);
    setActionMessage("");
    setError("");
    try {
      await apiClient<PipelineCandidate>(`/api/recruiter/pipeline/${candidate.applicationId}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stage: nextStage }),
      });
      setActionMessage(`${candidate.fullName} moved to ${humanStage(nextStage)}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not update the candidate stage.");
    } finally {
      setUpdatingId(null);
    }
  };

  const showing = useMemo(() => {
    if (!data || data.totalElements === 0) return "0 candidates";
    const start = data.number * data.size + 1;
    const end = start + data.numberOfElements - 1;
    return `Showing ${start}–${end} of ${data.totalElements} candidates`;
  }, [data]);

  return (
    <WorkspaceShell
      workspace="recruiter"
      active="pipeline"
      title="Candidate Pipeline"
      description="Review candidates in a mobile-friendly list. Search, filter, take action and move stages without a Kanban board."
    >
      <section aria-label="Pipeline controls" className={styles.toolbar}>
        <label className={styles.fieldGrow}>
          <span className={styles.label}>Search candidates</span>
          <input
            className={styles.input}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(0); }}
            placeholder="Name, job or keyword"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Pipeline stage</span>
          <select className={styles.select} value={stage} onChange={(event) => { setStage(event.target.value as "" | PipelineStage); setPage(0); }}>
            {stages.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </section>

      {actionMessage && <p className={styles.success} role="status">{actionMessage}</p>}
      {error && status !== "error" && <p className={styles.error} role="alert">{error}</p>}
      {status === "loading" && <div className={styles.state} aria-live="polite"><h2>Loading candidates…</h2><p>Fetching the latest pipeline records.</p></div>}
      {status === "error" && <div className={styles.state} role="alert"><h2>Pipeline unavailable</h2><p>{error}</p><button className={styles.actionButton} type="button" onClick={() => void load()}>Retry</button></div>}
      {status === "ready" && data?.empty && <div className={styles.state}><h2>No candidates found</h2><p>Try another search or stage, or return after candidates enter the pipeline.</p></div>}

      {status === "ready" && data && !data.empty && <>
        <p className={styles.status} aria-live="polite">{showing}</p>
        <div className={styles.list}>
          {data.content.map((candidate) => (
            <article className={styles.card} key={candidate.applicationId}>
              <div className={styles.top}>
                <div className={styles.identity}>
                  <div className={styles.avatar} aria-hidden="true">{initials(candidate.fullName)}</div>
                  <div>
                    <h2 className={styles.name}>{candidate.fullName}</h2>
                    <p className={styles.headline}>{candidate.headline || "Candidate profile"}</p>
                  </div>
                </div>
                <span className={styles.stage}>{humanStage(candidate.pipelineStage)}</span>
              </div>

              <div className={styles.facts}>
                <div className={styles.fact}><span>Job</span><strong>{candidate.jobTitle}</strong></div>
                <div className={styles.fact}><span>Current company</span><strong>{candidate.currentCompany || "Not shared"}</strong></div>
                <div className={styles.fact}><span>Experience</span><strong>{candidate.overallExperienceYears == null ? "Not shared" : `${candidate.overallExperienceYears} years`}</strong></div>
                <div className={styles.fact}><span>Location</span><strong>{candidate.location || "Not shared"}</strong></div>
                <div className={styles.fact}><span>Notice period</span><strong>{candidate.noticePeriodDays == null ? "Not shared" : `${candidate.noticePeriodDays} days`}</strong></div>
                <div className={styles.fact}><span>Expected salary</span><strong>{candidate.expectedSalaryLakhs == null ? "Not shared" : `₹${candidate.expectedSalaryLakhs} LPA`}</strong></div>
                <div className={styles.fact}><span>Source</span><strong>{candidate.applicationSource || "Direct"}</strong></div>
                <div className={styles.fact}><span>Last active</span><strong>{formatFreshness(candidate.lastActiveAt)}</strong></div>
              </div>

              {candidate.skills.length > 0 && <div className={styles.skills} aria-label={`${candidate.fullName} skills`}>
                {candidate.skills.slice(0, 8).map((skill) => <span className={styles.skill} key={skill}>{skill}</span>)}
              </div>}
              {candidate.recentNotes[0] && <div className={styles.notes}><strong>Latest note:</strong> {candidate.recentNotes[0]}</div>}

              <div className={styles.actions}>
                <a className={styles.actionLink} href={`/recruiter/jobs/${encodeURIComponent(candidate.jobId)}/applications/${candidate.applicationId}`}>View profile</a>
                <a className={styles.actionButton} href={`/recruiter/communications?candidate=${candidate.candidateId}&job=${encodeURIComponent(candidate.jobId)}`}>Message</a>
                <a className={styles.actionButton} href={`/recruiter/interviews?application=${candidate.applicationId}`}>Schedule interview</a>
                <div className={styles.move}>
                  <label htmlFor={`stage-${candidate.applicationId}`}>Move stage</label>
                  <select
                    id={`stage-${candidate.applicationId}`}
                    aria-label={`Move ${candidate.fullName} to`}
                    value={candidate.pipelineStage}
                    disabled={updatingId === candidate.applicationId}
                    onChange={(event) => void moveStage(candidate, event.target.value as PipelineStage)}
                  >
                    {stages.filter((item): item is { value: PipelineStage; label: string } => Boolean(item.value)).map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                  </select>
                </div>
              </div>
            </article>
          ))}
        </div>

        <nav className={styles.pagination} aria-label="Pipeline pagination">
          <span className={styles.paginationInfo}>{showing}</span>
          <div className={styles.paginationControls}>
            <button type="button" disabled={data.first} onClick={() => setPage((value) => Math.max(0, value - 1))}>← Previous</button>
            <span className={styles.paginationInfo}>Page {data.number + 1} of {Math.max(1, data.totalPages)}</span>
            <button type="button" disabled={data.last} onClick={() => setPage((value) => value + 1)}>Next →</button>
            <label className={styles.pageSize}>Candidates per page
              <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value) as (typeof pageSizes)[number]); setPage(0); }}>
                {pageSizes.map((size) => <option value={size} key={size}>{size}</option>)}
              </select>
            </label>
          </div>
        </nav>
      </>}
    </WorkspaceShell>
  );
}
