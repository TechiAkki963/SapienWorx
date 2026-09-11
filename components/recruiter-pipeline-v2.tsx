"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";
import { WorkspaceShell } from "./ui";
import styles from "./recruiter-pipeline-v2.module.css";

type PipelineStage =
  | "APPLIED"
  | "SCREENING"
  | "INTERVIEWING"
  | "FINAL_STAGE"
  | "OFFER"
  | "ONBOARDED"
  | "REJECTED";
type CareerStage = "" | "FRESHER" | "EXPERIENCED";
type SortKey = "updated" | "name" | "experience" | "notice" | "stage" | "activity";
type SortDirection = "asc" | "desc";
type ContactChannel = "EMAIL" | "MOBILE";

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
  query: string;
  jobRole: string;
  skill: string;
  minExp: string;
  maxExp: string;
  location: string;
  notice: string;
  company: string;
  education: string;
  minSalary: string;
  maxSalary: string;
  activeDays: string;
  careerStage: CareerStage;
};

type RevealedContact = {
  email?: string;
  mobile?: string;
};

const pageSizes = [10, 20, 40, 80] as const;
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

const emptyFilters: Filters = {
  query: "",
  jobRole: "",
  skill: "",
  minExp: "",
  maxExp: "",
  location: "",
  notice: "",
  company: "",
  education: "",
  minSalary: "",
  maxSalary: "",
  activeDays: "",
  careerStage: "",
};

const sortOptions: Array<{ value: SortKey; label: string }> = [
  { value: "updated", label: "Pipeline updated" },
  { value: "activity", label: "Candidate activity" },
  { value: "name", label: "Candidate name" },
  { value: "experience", label: "Experience" },
  { value: "notice", label: "Notice period" },
  { value: "stage", label: "Pipeline stage" },
];

function stageLabel(stage: PipelineStage) {
  return stages.find((item) => item.value === stage)?.label ?? stage;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "C"
  );
}

function compactDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function activeFilterCount(filters: Filters, stage: "" | PipelineStage) {
  return Object.values(filters).filter(Boolean).length + (stage ? 1 : 0);
}

function ContactCell({
  candidate,
  channel,
  revealed,
  pending,
  onReveal,
}: {
  candidate: PipelineCandidate;
  channel: ContactChannel;
  revealed: RevealedContact | undefined;
  pending: boolean;
  onReveal: (candidate: PipelineCandidate, channel: ContactChannel) => Promise<void>;
}) {
  const value =
    channel === "EMAIL"
      ? revealed?.email ?? candidate.maskedEmail ?? "••••"
      : revealed?.mobile ?? candidate.maskedMobile ?? "••••";
  const isRevealed = channel === "EMAIL" ? Boolean(revealed?.email) : Boolean(revealed?.mobile);
  return (
    <div className={styles.contactLine}>
      <span>{channel === "EMAIL" ? "Email" : "Mobile"}</span>
      <code>{value}</code>
      <button
        type="button"
        disabled={pending || isRevealed}
        onClick={() => void onReveal(candidate, channel)}
      >
        {pending ? "Recording…" : isRevealed ? "Revealed" : "Reveal"}
      </button>
    </div>
  );
}

function CandidateIdentity({ candidate }: { candidate: PipelineCandidate }) {
  return (
    <div className={styles.identity}>
      <span className={styles.avatar} aria-hidden="true">{initials(candidate.fullName)}</span>
      <span>
        <strong>{candidate.fullName}</strong>
        <small>{candidate.headline || candidate.departmentRole || candidate.jobTitle}</small>
        <small>{candidate.currentCompany || candidate.jobTitle}</small>
      </span>
    </div>
  );
}

function SkillChips({ skills }: { skills: string[] }) {
  const visible = skills.slice(0, 5);
  return (
    <div className={styles.skills} aria-label="Candidate skills">
      {visible.map((skill) => <span key={skill}>{skill}</span>)}
      {skills.length > visible.length && <small>+{skills.length - visible.length}</small>}
    </div>
  );
}

export function RecruiterPipelineV2() {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [stage, setStage] = useState<"" | PipelineStage>("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<(typeof pageSizes)[number]>(10);
  const [sortBy, setSortBy] = useState<SortKey>("updated");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [data, setData] = useState<PageResponse<PipelineCandidate> | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStage, setBulkStage] = useState<PipelineStage>("SCREENING");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Record<string, RevealedContact>>({});
  const [contactPending, setContactPending] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortBy,
      sortDirection,
    });
    if (stage) params.set("stage", stage);

    const textParams: Array<[keyof Filters, string]> = [
      ["query", "query"],
      ["jobRole", "jobRole"],
      ["skill", "skill"],
      ["location", "location"],
      ["company", "company"],
      ["education", "education"],
    ];
    textParams.forEach(([key, param]) => {
      const value = filters[key];
      if (typeof value === "string" && value.trim()) params.set(param, value.trim());
    });

    const numericParams: Array<[keyof Filters, string]> = [
      ["minExp", "minimumExperienceYears"],
      ["maxExp", "maximumExperienceYears"],
      ["notice", "maximumNoticePeriodDays"],
      ["minSalary", "minimumSalaryLakhs"],
      ["maxSalary", "maximumSalaryLakhs"],
      ["activeDays", "activeWithinDays"],
    ];
    numericParams.forEach(([key, param]) => {
      const value = filters[key];
      if (value) params.set(param, value);
    });
    if (filters.careerStage) params.set("careerStage", filters.careerStage);

    try {
      const response = await apiClient<PageResponse<PipelineCandidate>>(
        `/api/recruiter/pipeline?${params.toString()}`,
      );
      setData(response);
      setStatus("ready");
      setSelected((current) =>
        new Set(
          [...current].filter((id) =>
            response.content.some((candidate) => candidate.applicationId === id),
          ),
        ),
      );
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "We could not load the candidate pipeline.");
    }
  }, [filters, page, pageSize, sortBy, sortDirection, stage]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setStage("");
    setPage(0);
  };

  const visibleIds = data?.content.map((candidate) => candidate.applicationId) ?? [];
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const filterCount = activeFilterCount(filters, stage);

  const showing = useMemo(() => {
    if (!data || data.totalElements === 0) return "0 candidates";
    const start = data.number * data.size + 1;
    return `${start}–${start + data.numberOfElements - 1} of ${data.totalElements}`;
  }, [data]);

  const moveStage = async (candidate: PipelineCandidate, next: PipelineStage) => {
    if (next === candidate.pipelineStage) return;
    setUpdatingId(candidate.applicationId);
    setNotice("");
    setError("");
    try {
      await apiClient(`/api/recruiter/pipeline/${candidate.applicationId}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stage: next }),
      });
      setNotice(`${candidate.fullName} moved to ${stageLabel(next)}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not update this candidate.");
    } finally {
      setUpdatingId(null);
    }
  };

  const bulkMove = async () => {
    if (!selected.size) return;
    setBulkBusy(true);
    setNotice("");
    setError("");
    try {
      await apiClient("/api/recruiter/pipeline/bulk-stage", {
        method: "PATCH",
        body: JSON.stringify({ applicationIds: [...selected], stage: bulkStage }),
      });
      setNotice(
        `${selected.size} candidate${selected.size === 1 ? "" : "s"} moved to ${stageLabel(bulkStage)}.`,
      );
      setSelected(new Set());
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not update the selected candidates.");
    } finally {
      setBulkBusy(false);
    }
  };

  const revealContact = async (candidate: PipelineCandidate, channel: ContactChannel) => {
    const key = `${candidate.candidateId}:${channel}`;
    setContactPending(key);
    setError("");
    try {
      const response = await apiClient<{ value: string }>(
        `/api/recruiter/candidates/${candidate.candidateId}/contact?channel=${channel}&jobId=${encodeURIComponent(candidate.jobId)}`,
      );
      setContacts((current) => ({
        ...current,
        [candidate.candidateId]: {
          ...current[candidate.candidateId],
          ...(channel === "EMAIL" ? { email: response.value } : { mobile: response.value }),
        },
      }));
      setNotice(
        `${channel === "EMAIL" ? "Email" : "Mobile"} reveal for ${candidate.fullName} was recorded in the audit trail.`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Contact access could not be granted.");
    } finally {
      setContactPending("");
    }
  };

  const toggleCandidate = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <WorkspaceShell
      workspace="recruiter"
      active="pipeline"
      title="Candidate pipeline"
      description="Table-first hiring operations with persistent filters, protected contact access, and ten records per page by default."
    >
      <div className={styles.workspace}>
        <aside className={styles.filterRail} aria-label="Pipeline filters">
          <header className={styles.filterHeader}>
            <div>
              <span>Filters</span>
              <strong>{filterCount ? `${filterCount} active` : "All candidates"}</strong>
            </div>
            <button type="button" onClick={clearFilters} disabled={!filterCount}>Clear</button>
          </header>

          <label className={styles.filter}>
            <span>Name / keyword</span>
            <input
              value={filters.query}
              onChange={(event) => updateFilter("query", event.target.value)}
              placeholder="Candidate or keyword"
            />
          </label>
          <label className={styles.filter}>
            <span>Job title / role</span>
            <input
              value={filters.jobRole}
              onChange={(event) => updateFilter("jobRole", event.target.value)}
              placeholder="Java Developer"
            />
          </label>
          <label className={styles.filter}>
            <span>Skills</span>
            <input
              value={filters.skill}
              onChange={(event) => updateFilter("skill", event.target.value)}
              placeholder="Java, React…"
            />
            <small>Use a skill or keyword to narrow the current pipeline.</small>
          </label>
          <fieldset className={styles.filterGroup}>
            <legend>Experience</legend>
            <div className={styles.range}>
              <input
                aria-label="Minimum experience"
                type="number"
                min="0"
                value={filters.minExp}
                onChange={(event) => updateFilter("minExp", event.target.value)}
                placeholder="Min"
              />
              <span>to</span>
              <input
                aria-label="Maximum experience"
                type="number"
                min="0"
                value={filters.maxExp}
                onChange={(event) => updateFilter("maxExp", event.target.value)}
                placeholder="Max"
              />
            </div>
          </fieldset>
          <label className={styles.filter}>
            <span>Notice period</span>
            <select value={filters.notice} onChange={(event) => updateFilter("notice", event.target.value)}>
              <option value="">Any</option>
              <option value="0">Immediate</option>
              <option value="15">≤ 15 days</option>
              <option value="30">≤ 30 days</option>
              <option value="60">≤ 60 days</option>
              <option value="90">≤ 90 days</option>
            </select>
          </label>
          <label className={styles.filter}>
            <span>Stage</span>
            <select
              value={stage}
              onChange={(event) => {
                setStage(event.target.value as "" | PipelineStage);
                setPage(0);
              }}
            >
              {stages.map((item) => (
                <option value={item.value} key={item.value || "all"}>{item.label}</option>
              ))}
            </select>
          </label>

          <details className={styles.moreFilters}>
            <summary>More filters</summary>
            <div>
              <label className={styles.filter}>
                <span>Location</span>
                <input value={filters.location} onChange={(event) => updateFilter("location", event.target.value)} />
              </label>
              <label className={styles.filter}>
                <span>Current company</span>
                <input value={filters.company} onChange={(event) => updateFilter("company", event.target.value)} />
              </label>
              <label className={styles.filter}>
                <span>Education</span>
                <input value={filters.education} onChange={(event) => updateFilter("education", event.target.value)} />
              </label>
              <fieldset className={styles.filterGroup}>
                <legend>Expected salary (LPA)</legend>
                <div className={styles.range}>
                  <input
                    aria-label="Minimum salary"
                    type="number"
                    min="0"
                    value={filters.minSalary}
                    onChange={(event) => updateFilter("minSalary", event.target.value)}
                    placeholder="Min"
                  />
                  <span>to</span>
                  <input
                    aria-label="Maximum salary"
                    type="number"
                    min="0"
                    value={filters.maxSalary}
                    onChange={(event) => updateFilter("maxSalary", event.target.value)}
                    placeholder="Max"
                  />
                </div>
              </fieldset>
              <label className={styles.filter}>
                <span>Last active</span>
                <select value={filters.activeDays} onChange={(event) => updateFilter("activeDays", event.target.value)}>
                  <option value="">Any time</option>
                  <option value="1">24 hours</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                </select>
              </label>
              <label className={styles.filter}>
                <span>Career stage</span>
                <select value={filters.careerStage} onChange={(event) => updateFilter("careerStage", event.target.value as CareerStage)}>
                  <option value="">Any</option>
                  <option value="FRESHER">Fresher</option>
                  <option value="EXPERIENCED">Experienced</option>
                </select>
              </label>
            </div>
          </details>
        </aside>

        <section className={styles.results} aria-label="Candidate pipeline results">
          <div className={styles.toolbar}>
            <div>
              <strong>{status === "ready" ? showing : "Loading candidates…"}</strong>
              <span>Protected contact details stay masked until an audited reveal.</span>
            </div>
            <div className={styles.sortControls}>
              <label>
                <span>Sort</span>
                <select
                  value={sortBy}
                  onChange={(event) => {
                    setSortBy(event.target.value as SortKey);
                    setPage(0);
                  }}
                >
                  {sortOptions.map((option) => (
                    <option value={option.value} key={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                aria-label={`Sort ${sortDirection === "asc" ? "descending" : "ascending"}`}
                onClick={() => {
                  setSortDirection((current) => current === "asc" ? "desc" : "asc");
                  setPage(0);
                }}
              >
                {sortDirection === "asc" ? "↑" : "↓"}
              </button>
              <label>
                <span>Rows</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value) as (typeof pageSizes)[number]);
                    setPage(0);
                  }}
                >
                  {pageSizes.map((size) => <option value={size} key={size}>{size}</option>)}
                </select>
              </label>
            </div>
          </div>

          {selected.size > 0 && (
            <section className={styles.bulkBar} aria-label="Bulk actions">
              <strong>{selected.size} selected</strong>
              <label>
                <span>Move to</span>
                <select value={bulkStage} onChange={(event) => setBulkStage(event.target.value as PipelineStage)}>
                  {stages
                    .filter((item): item is { value: PipelineStage; label: string } => Boolean(item.value))
                    .map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => void bulkMove()} disabled={bulkBusy}>
                {bulkBusy ? "Updating…" : "Move selected"}
              </button>
              <a href="/recruiter/communications">Bulk message</a>
              <button type="button" className={styles.ghost} onClick={() => setSelected(new Set())}>Clear</button>
            </section>
          )}

          {notice && <p className={styles.success} role="status">{notice}</p>}
          {error && status !== "error" && <p className={styles.error} role="alert">{error}</p>}

          {status === "loading" && (
            <div className={styles.state} aria-live="polite" aria-busy="true">
              <strong>Loading candidates…</strong>
              <span>Fetching the latest pipeline records.</span>
            </div>
          )}
          {status === "error" && (
            <div className={styles.state} role="alert">
              <strong>Pipeline unavailable</strong>
              <span>{error}</span>
              <button type="button" onClick={() => void load()}>Retry</button>
            </div>
          )}
          {status === "ready" && data?.empty && (
            <div className={styles.state}>
              <strong>{filterCount ? "No candidates match these filters" : "No candidates in this pipeline"}</strong>
              <span>{filterCount ? "Clear or relax one or more filters." : "Candidates will appear here when applications enter your pipeline."}</span>
              {filterCount > 0 && <button type="button" onClick={clearFilters}>Clear filters</button>}
            </div>
          )}

          {status === "ready" && data && !data.empty && (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.checkboxCell}>
                        <input
                          aria-label="Select all candidates on this page"
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={() => setSelected(allVisibleSelected ? new Set<string>() : new Set(visibleIds))}
                        />
                      </th>
                      <th>Candidate</th>
                      <th>Skills</th>
                      <th>Experience</th>
                      <th>Notice</th>
                      <th>Stage</th>
                      <th>Protected contact</th>
                      <th>Activity</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.content.map((candidate) => {
                      const revealed = contacts[candidate.candidateId];
                      return (
                        <tr className={selected.has(candidate.applicationId) ? styles.selectedRow : undefined} key={candidate.applicationId}>
                          <td className={styles.checkboxCell}>
                            <input
                              aria-label={`Select ${candidate.fullName}`}
                              type="checkbox"
                              checked={selected.has(candidate.applicationId)}
                              onChange={() => toggleCandidate(candidate.applicationId)}
                            />
                          </td>
                          <td><CandidateIdentity candidate={candidate} /></td>
                          <td><SkillChips skills={candidate.skills} /></td>
                          <td className={styles.data}>{candidate.overallExperienceYears == null ? "—" : `${candidate.overallExperienceYears} yrs`}</td>
                          <td className={styles.data}>{candidate.noticePeriodDays == null ? "—" : candidate.noticePeriodDays === 0 ? "Immediate" : `${candidate.noticePeriodDays}d`}</td>
                          <td><span className={styles.stage}>{stageLabel(candidate.pipelineStage)}</span></td>
                          <td className={styles.contactCell}>
                            <ContactCell
                              candidate={candidate}
                              channel="EMAIL"
                              revealed={revealed}
                              pending={contactPending === `${candidate.candidateId}:EMAIL`}
                              onReveal={revealContact}
                            />
                            <ContactCell
                              candidate={candidate}
                              channel="MOBILE"
                              revealed={revealed}
                              pending={contactPending === `${candidate.candidateId}:MOBILE`}
                              onReveal={revealContact}
                            />
                          </td>
                          <td>
                            <div className={styles.activity}>
                              <strong>{compactDate(candidate.lastActiveAt)}</strong>
                              <small>{candidate.location || "Location not shared"}</small>
                            </div>
                          </td>
                          <td>
                            <div className={styles.actions}>
                              <a href={`/recruiter/jobs/${encodeURIComponent(candidate.jobId)}/applications/${candidate.applicationId}`}>View</a>
                              <a href={`/recruiter/communications?candidate=${candidate.candidateId}&job=${encodeURIComponent(candidate.jobId)}`}>Message</a>
                              <select
                                aria-label={`Move ${candidate.fullName} to pipeline stage`}
                                value={candidate.pipelineStage}
                                disabled={updatingId === candidate.applicationId}
                                onChange={(event) => void moveStage(candidate, event.target.value as PipelineStage)}
                              >
                                {stages
                                  .filter((item): item is { value: PipelineStage; label: string } => Boolean(item.value))
                                  .map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                              </select>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className={styles.mobileList}>
                {data.content.map((candidate) => (
                  <article className={styles.mobileCard} key={candidate.applicationId}>
                    <div className={styles.mobileHead}>
                      <label>
                        <input
                          aria-label={`Select ${candidate.fullName}`}
                          type="checkbox"
                          checked={selected.has(candidate.applicationId)}
                          onChange={() => toggleCandidate(candidate.applicationId)}
                        />
                        <CandidateIdentity candidate={candidate} />
                      </label>
                      <span className={styles.stage}>{stageLabel(candidate.pipelineStage)}</span>
                    </div>
                    <SkillChips skills={candidate.skills} />
                    <dl>
                      <div><dt>Experience</dt><dd>{candidate.overallExperienceYears == null ? "—" : `${candidate.overallExperienceYears} yrs`}</dd></div>
                      <div><dt>Notice</dt><dd>{candidate.noticePeriodDays == null ? "—" : candidate.noticePeriodDays === 0 ? "Immediate" : `${candidate.noticePeriodDays}d`}</dd></div>
                      <div><dt>Last active</dt><dd>{compactDate(candidate.lastActiveAt)}</dd></div>
                    </dl>
                    <div className={styles.mobileContacts}>
                      <ContactCell
                        candidate={candidate}
                        channel="EMAIL"
                        revealed={contacts[candidate.candidateId]}
                        pending={contactPending === `${candidate.candidateId}:EMAIL`}
                        onReveal={revealContact}
                      />
                      <ContactCell
                        candidate={candidate}
                        channel="MOBILE"
                        revealed={contacts[candidate.candidateId]}
                        pending={contactPending === `${candidate.candidateId}:MOBILE`}
                        onReveal={revealContact}
                      />
                    </div>
                    <div className={styles.actions}>
                      <a href={`/recruiter/jobs/${encodeURIComponent(candidate.jobId)}/applications/${candidate.applicationId}`}>View profile</a>
                      <a href={`/recruiter/communications?candidate=${candidate.candidateId}&job=${encodeURIComponent(candidate.jobId)}`}>Message</a>
                      <select
                        aria-label={`Move ${candidate.fullName} to pipeline stage`}
                        value={candidate.pipelineStage}
                        disabled={updatingId === candidate.applicationId}
                        onChange={(event) => void moveStage(candidate, event.target.value as PipelineStage)}
                      >
                        {stages
                          .filter((item): item is { value: PipelineStage; label: string } => Boolean(item.value))
                          .map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                      </select>
                    </div>
                  </article>
                ))}
              </div>

              <nav className={styles.pagination} aria-label="Pipeline pagination">
                <span>{showing} candidates · Page {data.number + 1} of {Math.max(1, data.totalPages)}</span>
                <div>
                  <button type="button" disabled={data.first} onClick={() => setPage((value) => Math.max(0, value - 1))}>← Previous</button>
                  <button type="button" disabled={data.last} onClick={() => setPage((value) => value + 1)}>Next →</button>
                </div>
              </nav>
            </>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}
