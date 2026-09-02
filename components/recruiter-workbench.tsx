"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";
import { defaultRecruiterSearch, searchParamsFor, sourceRequest, type RecruiterSearchState } from "../lib/recruiter-search";
import { Badge, Button, SectionTitle, WorkspaceShell } from "./ui";

type AlertFrequency = "OFF" | "DAILY" | "INSTANT";
type SavedSearch = {
  id: string;
  name: string;
  criteria: Record<string, unknown>;
  alertFrequency: AlertFrequency;
  lastAlertedAt?: string | null;
  alertStatus?: "OFF" | "READY" | "HEALTHY" | string;
  updatedAt: string;
};
type TalentPool = {
  id: string;
  name: string;
  description: string | null;
  jobId?: string | null;
  jobTitle?: string | null;
  candidateCount: number;
  updatedAt: string;
};
type TalentPoolMember = {
  candidateId: string;
  fullName: string;
  headline: string | null;
  location: string | null;
  tags: string[];
  ownerName: string | null;
  reminderAt: string | null;
  note: string | null;
  nextAction?: string | null;
  experienceYears?: number | null;
  expectedSalaryLakhs?: number | null;
  noticePeriodDays?: number | null;
  skills?: string[];
  emailVerified?: boolean;
  mobileVerified?: boolean;
  lastActiveAt?: string | null;
  profileUpdatedAt?: string | null;
  updatedAt: string;
};
type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: "DRAFT" | "QUEUED" | "SENT" | "COMPLETED";
  recipientCount: number;
  sentCount: number;
  repliedCount: number;
  optedOutCount: number;
  excludedCount?: number;
  replyRate?: number;
  jobId?: string | null;
  jobTitle?: string | null;
  updatedAt: string;
};
type Interview = {
  id: string;
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  platformName: string;
  meetingLink: string;
  scheduledAt: string;
  durationMinutes: number;
  timeZone?: string;
  agenda?: string | null;
  panelRecruiterIds?: string[];
  panelRecruiterNames?: string[];
  status: string;
  scorecards: Array<{
    id: string;
    recruiterName: string;
    recommendation: string;
    score: number;
    feedback: string;
    submittedAt: string;
  }>;
};
type PipelineApplication = {
  applicationId: string;
  candidateId: string;
  fullName: string;
  headline: string | null;
  jobId: string;
  jobTitle: string;
  pipelineStage: string;
};
type PipelinePage = { content: PipelineApplication[] };
type JobOption = { jobId: string; title: string; status: string; location: string };
type JobPage = { content: Array<{ job: JobOption }> };
type CandidateOption = {
  candidateId: string;
  fullName: string;
  headline: string | null;
  location: string | null;
  overallExperienceYears: number | null;
  expectedSalaryLakhs: number | null;
  noticePeriodDays: number | null;
  skills: string | null;
  emailVerified: boolean;
  mobileVerified: boolean;
  profileLastUpdatedAt: string | null;
  lastActiveAt: string | null;
  relevanceScore: number | null;
};
type CandidatePage = { content: CandidateOption[] };
type Analytics = {
  savedSearches: number;
  talentPools: number;
  candidatesInPools: number;
  activeCampaigns: number;
  campaignsSent: number;
  interviewsThisWeek: number;
  scorecardsSubmitted: number;
  dueReminders?: number;
  campaignReplies?: number;
  pendingScorecards?: number;
  upcomingInterviews?: number;
};
type OrganisationControls = {
  currentUserRole: "ORG_ADMIN" | "HIRING_MANAGER" | "RECRUITER";
  candidateRetentionDays: number;
  auditRetentionDays: number;
  savedSearchAlertsEnabled: boolean;
  campaignsEnabled: boolean;
  updatedAt: string;
  members: Array<{
    recruiterId: string;
    fullName: string;
    officialEmail: string;
    workspaceRole: "ORG_ADMIN" | "HIRING_MANAGER" | "RECRUITER";
  }>;
};

type Tab = "searches" | "pools" | "campaigns" | "interviews" | "controls";
const tabs: Tab[] = ["searches", "pools", "campaigns", "interviews", "controls"];
const tabFromHash = (value: string): Tab | null => {
  const candidate = value.replace(/^#/, "") as Tab;
  return tabs.includes(candidate) ? candidate : null;
};
const formatDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "Not scheduled";
const errorText = (reason: unknown, fallback: string) =>
  reason instanceof Error ? reason.message : fallback;

export function RecruiterWorkbench() {
  const [tab, setTab] = useState<Tab>("searches");
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [pools, setPools] = useState<TalentPool[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [applications, setApplications] = useState<PipelineApplication[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [candidateDirectory, setCandidateDirectory] = useState<CandidateOption[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [controls, setControls] = useState<OrganisationControls | null>(null);
  const [selectedPoolId, setSelectedPoolId] = useState("");
  const [members, setMembers] = useState<TalentPoolMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const refresh = async (includeMembers = false, showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const [
        nextSearches,
        nextPools,
        nextCampaigns,
        nextInterviews,
        nextApplications,
        nextAnalytics,
        nextControls,
      ] = await Promise.all([
        apiClient<SavedSearch[]>("/api/recruiter/workflow/saved-searches"),
        apiClient<TalentPool[]>("/api/recruiter/workflow/talent-pools"),
        apiClient<Campaign[]>("/api/recruiter/workflow/campaigns"),
        apiClient<Interview[]>("/api/recruiter/workflow/interviews"),
        apiClient<PipelinePage>("/api/recruiter/pipeline?page=0"),
        apiClient<Analytics>("/api/recruiter/workflow/analytics"),
        apiClient<OrganisationControls>(
          "/api/recruiter/workflow/organisation-controls",
        ),
      ]);
      setSavedSearches(nextSearches);
      setPools(nextPools);
      setCampaigns(nextCampaigns);
      setInterviews(nextInterviews);
      setApplications(nextApplications.content);
      setAnalytics(nextAnalytics);
      setControls(nextControls);
      const [jobResult, candidateResult] = await Promise.allSettled([
        apiClient<JobPage>("/api/recruiter/jobs?page=0"),
        apiClient<CandidatePage>("/api/recruiter/sourcing/search", {
          method: "POST",
          body: JSON.stringify(sourceRequest({ ...defaultRecruiterSearch, allKeywords: "", activeStatus: "ALL" }, 0, 20)),
        }),
      ]);
      if (jobResult.status === "fulfilled") setJobs(jobResult.value.content.map((item) => item.job));
      if (candidateResult.status === "fulfilled") setCandidateDirectory(candidateResult.value.content);
      const poolId = selectedPoolId || nextPools[0]?.id || "";
      if (poolId && (includeMembers || !selectedPoolId)) {
        setSelectedPoolId(poolId);
        setMembers(
          await apiClient<TalentPoolMember[]>(
            `/api/recruiter/workflow/talent-pools/${poolId}/members`,
          ),
        );
      }
      setLastSyncedAt(new Date());
    } catch (reason) {
      setError(
        errorText(reason, "We could not load your recruitment workflow."),
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    const syncTabFromHash = () => {
      const requested = tabFromHash(window.location.hash);
      if (requested) setTab(requested);
    };
    syncTabFromHash();
    window.addEventListener("hashchange", syncTabFromHash);
    return () => window.removeEventListener("hashchange", syncTabFromHash);
  }, []);
  useEffect(() => {
    if (!selectedPoolId) return;
    void apiClient<TalentPoolMember[]>(
      `/api/recruiter/workflow/talent-pools/${selectedPoolId}/members`,
    )
      .then(setMembers)
      .catch((reason) =>
        setError(errorText(reason, "We could not load this talent pool.")),
      );
  }, [selectedPoolId]);
  const activePool = useMemo(
    () => pools.find((pool) => pool.id === selectedPoolId),
    [pools, selectedPoolId],
  );
  const selectTab = (nextTab: Tab) => {
    setTab(nextTab);
    window.history.replaceState(null, "", `#${nextTab}`);
  };
  const run = async (action: () => Promise<void>, success: string) => {
    setNotice("");
    setError("");
    try {
      await action();
      setNotice(success);
      await refresh(true, false);
      return true;
    } catch (reason) {
      setError(errorText(reason, "The request could not be completed."));
      return false;
    }
  };

  return (
    <WorkspaceShell
      workspace="recruiter"
      active={tab === "interviews" ? "interviews" : "workbench"}
      title={tab === "interviews" ? "Interviews" : "Recruitment workspace"}
      description={tab === "interviews"
        ? "Schedule interviews, coordinate panels, capture scorecards, and track hiring decisions."
        : "Coordinate talent searches, shared pools, outreach, interviews, and organisation controls in one place."}
      actions={
        <><span className="workflow-sync-state">{lastSyncedAt ? `Synced ${formatTimeOnly(lastSyncedAt)}` : "Live data"}</span><Button onClick={() => void refresh(true)} variant="secondary">Refresh</Button></>
      }
    >
      <main className="workflow-page">
        <WorkflowJourney />
        <section
          className="workflow-metrics"
          aria-label="Recruitment operations metrics"
        >
          <Metric
            label="Saved searches"
            value={analytics?.savedSearches ?? 0}
            hint="Reusable search logic"
          />
          <Metric
            label="People in pools"
            value={analytics?.candidatesInPools ?? 0}
            hint={`${analytics?.talentPools ?? 0} shared pools`}
          />
          <Metric
            label="Active campaigns"
            value={analytics?.activeCampaigns ?? 0}
            hint={`${analytics?.campaignsSent ?? 0} messages queued or sent`}
          />
          <Metric
            label="Interview scorecards"
            value={analytics?.scorecardsSubmitted ?? 0}
            hint={`${analytics?.interviewsThisWeek ?? 0} interviews in the last 7 days`}
          />
        </section>
        <ActionQueue analytics={analytics} onSelect={selectTab} />
        <section
          className="workflow-tabs"
          role="tablist"
          aria-label="Recruitment workspace sections"
        >
          <TabButton tab={tab} value="searches" onSelect={selectTab}>
            Saved searches
          </TabButton>
          <TabButton tab={tab} value="pools" onSelect={selectTab}>
            Talent pools
          </TabButton>
          <TabButton tab={tab} value="campaigns" onSelect={selectTab}>
            Campaigns
          </TabButton>
          <TabButton tab={tab} value="interviews" onSelect={selectTab}>
            Interviews
          </TabButton>
          <TabButton tab={tab} value="controls" onSelect={selectTab}>
            Organisation controls
          </TabButton>
        </section>
        {notice && (
          <p className="workflow-notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="workflow-error" role="alert">
            {error}
          </p>
        )}
        {loading && (
          <p className="workflow-loading" role="status">
            Loading live workflow data…
          </p>
        )}
        {!loading && tab === "searches" && (
          <SavedSearches
            searches={savedSearches}
            onDelete={(id) =>
              void run(
                () =>
                  apiClient<void>(
                    `/api/recruiter/workflow/saved-searches/${id}`,
                    { method: "DELETE" },
                  ),
                "Saved search removed.",
              )
            }
            onCreate={(payload) =>
              void run(
                () =>
                  apiClient("/api/recruiter/workflow/saved-searches", {
                    method: "POST",
                    body: JSON.stringify(payload),
                  }).then(() => undefined),
                "Saved search created. Alerts will use its stored criteria.",
              )
            }
            jobs={jobs}
          />
        )}
        {!loading && tab === "pools" && (
          <TalentPools
            pools={pools}
            activePool={activePool}
            members={members}
            onSelect={setSelectedPoolId}
            onCreate={(payload) =>
              void run(
                () =>
                  apiClient("/api/recruiter/workflow/talent-pools", {
                    method: "POST",
                    body: JSON.stringify(payload),
                  }).then(() => undefined),
                "Talent pool created.",
              )
            }
            onAddMember={(payload) =>
              selectedPoolId &&
              void run(
                () =>
                  apiClient(
                    `/api/recruiter/workflow/talent-pools/${selectedPoolId}/members`,
                    { method: "PUT", body: JSON.stringify(payload) },
                  ).then(() => undefined),
                "Candidate added to the shared pool with tags, owner, note, and reminder.",
              )
            }
            onRemove={(candidateId) =>
              selectedPoolId &&
              void run(
                () =>
                  apiClient<void>(
                    `/api/recruiter/workflow/talent-pools/${selectedPoolId}/members/${candidateId}`,
                    { method: "DELETE" },
                  ),
                "Candidate removed from the talent pool.",
              )
            }
            jobs={jobs}
            candidates={candidateDirectory}
            organisationMembers={controls?.members ?? []}
          />
        )}
        {!loading && tab === "campaigns" && (
          <Campaigns
            campaigns={campaigns}
            jobs={jobs}
            pools={pools}
            poolMembers={members}
            candidates={candidateDirectory}
            activePoolId={selectedPoolId}
            onPoolSelect={setSelectedPoolId}
            onCreate={(payload) =>
              void run(
                () =>
                  apiClient("/api/recruiter/workflow/campaigns", {
                    method: "POST",
                    body: JSON.stringify(payload),
                  }).then(() => undefined),
                "Campaign created. Candidates who opted out were excluded.",
              )
            }
            onLaunch={(id) =>
              void run(
                () =>
                  apiClient(`/api/recruiter/workflow/campaigns/${id}/launch`, {
                    method: "POST",
                  }).then(() => undefined),
                "Campaign queued for individual, auditable delivery.",
              )
            }
          />
        )}
        {!loading && tab === "interviews" && (
          <Interviews
            interviews={interviews}
            applications={applications}
            onSchedule={(payload) =>
              run(
                () =>
                  apiClient("/api/recruiter/interviews", {
                    method: "POST",
                    body: JSON.stringify(payload),
                  }).then(() => undefined),
                "Interview scheduled. The candidate has been notified and the meeting is now in your workspace.",
              )
            }
            onScore={(payload) =>
              run(
                () =>
                  apiClient("/api/recruiter/workflow/interview-scorecards", {
                    method: "POST",
                    body: JSON.stringify(payload),
                  }).then(() => undefined),
                "Interview scorecard saved.",
              )
            }
            organisationMembers={controls?.members ?? []}
            onUpdate={(id, payload) =>
              run(
                () => apiClient(`/api/recruiter/workflow/interviews/${id}`, { method: "PATCH", body: JSON.stringify(payload) }).then(() => undefined),
                payload.status === "CANCELLED" ? "Interview cancelled." : payload.status === "COMPLETED" ? "Interview marked complete." : "Interview updated and the schedule is current.",
              )
            }
          />
        )}
        {!loading && tab === "controls" && controls && (
          <OrganisationControlsPanel
            controls={controls}
            onSave={(payload) =>
              void run(
                () =>
                  apiClient<OrganisationControls>(
                    "/api/recruiter/workflow/organisation-controls",
                    { method: "PUT", body: JSON.stringify(payload) },
                  ).then(setControls),
                "Organisation controls updated.",
              )
            }
            onMemberRole={(payload) =>
              void run(
                () =>
                  apiClient<OrganisationControls>(
                    "/api/recruiter/workflow/organisation-controls/members",
                    { method: "PUT", body: JSON.stringify(payload) },
                  ).then(setControls),
                "Member role updated.",
              )
            }
          />
        )}
      </main>
    </WorkspaceShell>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function WorkflowJourney() {
  const steps = [
    ["Source", "/recruiter/sourcing"],
    ["Save search", "#searches"],
    ["Talent pool", "#pools"],
    ["Campaign", "#campaigns"],
    ["Pipeline", "/recruiter/pipeline"],
    ["Interview", "#interviews"],
    ["Decision & hire", "/recruiter/pipeline?stage=offer"],
  ];
  return <section className="workflow-journey" aria-label="Connected recruitment flow"><header><span className="eyebrow">One connected hiring cycle</span><b>Every action keeps its candidate, job and owner context.</b></header><div>{steps.map(([label, href], index) => <span key={label}><a href={href}>{index + 1}<b>{label}</b></a>{index < steps.length - 1 && <i>→</i>}</span>)}</div></section>;
}

function ActionQueue({ analytics, onSelect }: { analytics: Analytics | null; onSelect: (tab: Tab) => void }) {
  const items: Array<{ label: string; value: number; detail: string; tab: Tab }> = [
    { label: "Reminders due", value: analytics?.dueReminders ?? 0, detail: "Shortlist follow-ups", tab: "pools" },
    { label: "Replies waiting", value: analytics?.campaignReplies ?? 0, detail: "Campaign responses", tab: "campaigns" },
    { label: "Feedback due", value: analytics?.pendingScorecards ?? 0, detail: "Interview scorecards", tab: "interviews" },
    { label: "Upcoming", value: analytics?.upcomingInterviews ?? 0, detail: "Scheduled interviews", tab: "interviews" },
  ];
  return <section className="workflow-action-queue" aria-label="Recruiter action queue"><header><span className="eyebrow">Today&apos;s work queue</span><b>Focus on the actions that unblock hiring.</b></header>{items.map((item) => <button type="button" key={item.label} onClick={() => onSelect(item.tab)}><strong>{item.value}</strong><span><b>{item.label}</b><small>{item.detail}</small></span><i>→</i></button>)}</section>;
}

function criteriaSearchState(criteria: Record<string, unknown>): RecruiterSearchState {
  const string = (key: keyof RecruiterSearchState) => typeof criteria[key] === "string" ? String(criteria[key]) : "";
  return {
    ...defaultRecruiterSearch,
    anyKeywords: string("anyKeywords"), allKeywords: string("allKeywords"), excludeKeywords: string("excludeKeywords"),
    booleanQuery: string("booleanQuery") || (typeof criteria.expression === "string" ? criteria.expression : ""),
    minExperience: string("minExperience"), maxExperience: string("maxExperience"), minSalary: string("minSalary"), maxSalary: string("maxSalary"),
    company: string("company"), designation: string("designation"), departmentRole: string("departmentRole"), industry: string("industry"), location: string("location"),
    qualification: string("qualification"), institution: string("institution"),
    educationTypes: Array.isArray(criteria.educationTypes) ? criteria.educationTypes.filter((value): value is string => typeof value === "string") : [],
    ugMode: criteria.ugMode === "specific" || criteria.ugMode === "none" ? criteria.ugMode : "any",
    gender: criteria.gender === "female" || criteria.gender === "male" || criteria.gender === "non-binary" ? criteria.gender : "",
    requireGithub: criteria.requireGithub === true, requireLeetcode: criteria.requireLeetcode === true, requirePortfolio: criteria.requirePortfolio === true,
    activeStatus: typeof criteria.activeStatus === "string" && ["ONE_DAY", "THREE_DAYS", "SEVEN_DAYS", "FIFTEEN_DAYS", "THIRTY_DAYS", "SIXTY_DAYS", "NINETY_DAYS", "ONE_YEAR", "ALL"].includes(criteria.activeStatus) ? criteria.activeStatus as RecruiterSearchState["activeStatus"] : "SEVEN_DAYS",
  };
}
function savedSearchSummary(criteria: Record<string, unknown>) { const state = criteriaSearchState(criteria); return state.booleanQuery || state.allKeywords || state.anyKeywords || "Structured sourcing criteria"; }
function savedSearchChips(criteria: Record<string, unknown>) { const state = criteriaSearchState(criteria); return [typeof criteria.jobId === "string" && criteria.jobId ? `Job ${criteria.jobId}` : "", state.location, state.minExperience || state.maxExperience ? `${state.minExperience || "0"}–${state.maxExperience || "any"} years` : "", state.activeStatus !== "ALL" ? humanStatus(state.activeStatus) : ""].filter(Boolean); }
function savedSearchUrl(criteria: Record<string, unknown>) { return `/search/results?${searchParamsFor(criteriaSearchState(criteria)).toString()}`; }
function formatTimeOnly(value: Date) { return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(value); }
function TabButton({
  tab,
  value,
  onSelect,
  children,
}: {
  tab: Tab;
  value: Tab;
  onSelect: (tab: Tab) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={tab === value}
      className={tab === value ? "selected" : ""}
      onClick={() => onSelect(value)}
    >
      {children}
    </button>
  );
}

function SavedSearches({
  searches,
  jobs,
  onCreate,
  onDelete,
}: {
  searches: SavedSearch[];
  jobs: JobOption[];
  onCreate: (payload: {
    name: string;
    criteria: Record<string, unknown>;
    alertFrequency: AlertFrequency;
  }) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [criteria, setCriteria] = useState("");
  const [jobId, setJobId] = useState("");
  const [location, setLocation] = useState("");
  const [minExperience, setMinExperience] = useState("");
  const [maxExperience, setMaxExperience] = useState("");
  const [frequency, setFrequency] = useState<AlertFrequency>("DAILY");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      criteria: {
        ...defaultRecruiterSearch,
        allKeywords: "",
        booleanQuery: criteria.trim(),
        minExperience,
        maxExperience,
        location: location.trim(),
        jobId,
      },
      alertFrequency: frequency,
    });
    setName("");
    setCriteria("");
    setJobId("");
    setLocation("");
    setMinExperience("");
    setMaxExperience("");
  };
  return (
    <section className="workflow-grid workflow-two">
      <form className="panel workflow-form" onSubmit={submit}>
        <SectionTitle
          eyebrow="Search-to-action"
          title="Save a reusable search"
        />
        <p>Store the complete sourcing intent, connect it to a live role, and return to the same result set whenever new profiles arrive.</p>
        <label>
          <span>Search name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Backend engineers — Bengaluru"
            required
          />
        </label>
        <label>
          <span>Hiring role</span>
          <select aria-label="Hiring role for saved search" value={jobId} onChange={(event) => setJobId(event.target.value)}>
            <option value="">General talent search</option>
            {jobs.map((job) => <option value={job.jobId} key={job.jobId}>{job.title} · {job.jobId}</option>)}
          </select>
        </label>
        <label>
          <span>Search criteria</span>
          <textarea
            value={criteria}
            onChange={(event) => setCriteria(event.target.value)}
            placeholder={"e.g. Node.js AND TypeScript, 5–8 years"}
          />
        </label>
        <div className="workflow-schedule-fields">
          <label><span>Minimum experience</span><input aria-label="Saved search minimum experience" type="number" min="0" value={minExperience} onChange={(event) => setMinExperience(event.target.value)} placeholder="e.g. 5" /></label>
          <label><span>Maximum experience</span><input aria-label="Saved search maximum experience" type="number" min="0" value={maxExperience} onChange={(event) => setMaxExperience(event.target.value)} placeholder="e.g. 8" /></label>
        </div>
        <label><span>Location</span><input aria-label="Saved search location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Bengaluru or Remote" /></label>
        <label>
          <span>Alert frequency</span>
          <select
            value={frequency}
            onChange={(event) =>
              setFrequency(event.target.value as AlertFrequency)
            }
          >
            <option value="OFF">No alerts</option>
            <option value="DAILY">Daily summary</option>
            <option value="INSTANT">As new profiles match</option>
          </select>
        </label>
        <Button type="submit">Save search</Button>
      </form>
      <section className="panel workflow-list">
        <SectionTitle
          eyebrow="Your library"
          title={`${searches.length} saved searches`}
        />
        {searches.length === 0 && (
          <EmptyCopy copy="Save a sourcing query to reuse it, share the intent with your team, and enable matching-candidate alerts." />
        )}
        {searches.map((search) => (
          <article key={search.id}>
            <div>
              <b>{search.name}</b>
              <p>{savedSearchSummary(search.criteria)}</p>
              <div className="workflow-filter-chips">{savedSearchChips(search.criteria).map((chip) => <span key={chip}>{chip}</span>)}</div>
              <small>
                {search.alertFrequency === "OFF"
                  ? "Alerts off"
                  : `${search.alertFrequency.toLowerCase()} alerts`}{" "}
                · Updated {formatDate(search.updatedAt)}
              </small>
            </div>
            <div className="workflow-list-actions workflow-search-actions">
              <Badge tone={search.alertStatus === "HEALTHY" ? "green" : search.alertFrequency === "OFF" ? "neutral" : "blue"}>{search.alertStatus === "HEALTHY" ? "Alert healthy" : search.alertFrequency === "OFF" ? "Alerts off" : "Ready to alert"}</Badge>
              <a className="button button-secondary" href={savedSearchUrl(search.criteria)}>Run search</a>
              <button type="button" className="workflow-text-danger" onClick={() => onDelete(search.id)}>Remove</button>
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}

function TalentPools({
  pools,
  activePool,
  members,
  jobs,
  candidates,
  organisationMembers,
  onSelect,
  onCreate,
  onAddMember,
  onRemove,
}: {
  pools: TalentPool[];
  activePool?: TalentPool;
  members: TalentPoolMember[];
  jobs: JobOption[];
  candidates: CandidateOption[];
  organisationMembers: OrganisationControls["members"];
  onSelect: (id: string) => void;
  onCreate: (payload: { name: string; description: string; jobId: string | null }) => void;
  onAddMember: (payload: {
    candidateId: string;
    tags: string[];
    note: string;
    reminderAt: string | null;
    ownerRecruiterId: string | null;
    nextAction: string;
  }) => void;
  onRemove: (candidateId: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [poolJobId, setPoolJobId] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [ownerRecruiterId, setOwnerRecruiterId] = useState("");
  const [nextAction, setNextAction] = useState("Review profile and decide next step");
  return (
    <section className="workflow-pools-layout">
      <aside className="panel workflow-pool-list">
        <SectionTitle eyebrow="Shared shortlists" title="Talent pools" />
        {pools.map((pool) => (
          <button
            type="button"
            className={pool.id === activePool?.id ? "active" : ""}
            key={pool.id}
            onClick={() => onSelect(pool.id)}
          >
            <b>{pool.name}</b>
            <span>{pool.candidateCount} candidates</span>
            <small>{pool.jobTitle ? `${pool.jobTitle} · ${pool.jobId}` : pool.description || "General talent pool"}</small>
          </button>
        ))}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            onCreate({ name: name.trim(), description: description.trim(), jobId: poolJobId || null });
            setName("");
            setDescription("");
            setPoolJobId("");
          }}
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New talent pool"
            required
          />
          <select aria-label="Talent pool hiring role" value={poolJobId} onChange={(event) => setPoolJobId(event.target.value)}>
            <option value="">General talent pool</option>
            {jobs.map((job) => <option value={job.jobId} key={job.jobId}>{job.title}</option>)}
          </select>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Purpose (optional)"
          />
          <Button type="submit" variant="secondary">
            Create pool
          </Button>
        </form>
      </aside>
      <section className="panel workflow-members">
        <SectionTitle
          eyebrow="Collaboration"
          title={activePool ? activePool.name : "Choose a talent pool"}
          action={
            activePool ? (
              <Badge tone="blue">{members.length} candidates</Badge>
            ) : undefined
          }
        />
        {activePool && (
          <>
            <form
              className="workflow-inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!candidateId.trim()) return;
                onAddMember({
                  candidateId: candidateId.trim(),
                  tags: tags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                  note: note.trim(),
                  reminderAt: reminderAt
                    ? new Date(reminderAt).toISOString()
                    : null,
                  ownerRecruiterId: ownerRecruiterId || null,
                  nextAction: nextAction.trim(),
                });
                setCandidateId("");
                setTags("");
                setNote("");
                setReminderAt("");
                setOwnerRecruiterId("");
                setNextAction("Review profile and decide next step");
              }}
            >
              <label>
                <span>Candidate from sourcing</span>
                <select
                  aria-label="Candidate from sourcing"
                  value={candidateId}
                  onChange={(event) => setCandidateId(event.target.value)}
                  required
                >
                  <option value="">Choose a candidate</option>
                  {candidates.filter((candidate) => !members.some((member) => member.candidateId === candidate.candidateId)).map((candidate) => <option value={candidate.candidateId} key={candidate.candidateId}>{candidate.fullName} — {candidate.headline || "Profile"}</option>)}
                </select>
              </label>
              <label>
                <span>Tags</span>
                <input
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="Backend, priority"
                />
              </label>
              <label>
                <span>Reminder</span>
                <input
                  type="datetime-local"
                  value={reminderAt}
                  onChange={(event) => setReminderAt(event.target.value)}
                />
              </label>
              <label>
                <span>Owner</span>
                <select aria-label="Talent pool candidate owner" value={ownerRecruiterId} onChange={(event) => setOwnerRecruiterId(event.target.value)}>
                  <option value="">Unassigned</option>
                  {organisationMembers.map((member) => <option value={member.recruiterId} key={member.recruiterId}>{member.fullName}</option>)}
                </select>
              </label>
              <label className="span-all"><span>Next action</span><input aria-label="Candidate next action" value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="e.g. Phone screen by Friday" /></label>
              <label className="span-all">
                <span>Shared note and @mentions</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="e.g. @Asha please review portfolio before Friday"
                />
              </label>
              <Button type="submit">Add to pool</Button>
            </form>
            <div className="workflow-member-list">
              {members.length === 0 && (
                <EmptyCopy copy="Add candidates from search results to give your team one shared, owned shortlist with notes, tags, and reminders." />
              )}
              {members.map((member) => (
                <article className="workflow-intelligence-card" key={member.candidateId}>
                  <span className="workflow-avatar">
                    {member.fullName
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <div>
                    <b>{member.fullName}</b>
                    <p>
                      {member.headline || "Profile headline not provided"} ·{" "}
                      {member.location || "Location not provided"}
                    </p>
                    <div className="workflow-candidate-facts">
                      <span><b>{member.experienceYears ?? "—"}</b> years</span>
                      <span><b>{member.expectedSalaryLakhs == null ? "—" : `₹${member.expectedSalaryLakhs}L`}</b> expectation</span>
                      <span><b>{member.noticePeriodDays == null ? "—" : member.noticePeriodDays}</b> notice days</span>
                      <span className={member.emailVerified && member.mobileVerified ? "verified" : ""}><b>{member.emailVerified && member.mobileVerified ? "Verified" : "Check"}</b> contact</span>
                    </div>
                    <div>
                      {member.tags.map((tag) => (
                        <Badge key={tag} tone="blue">
                          {tag}
                        </Badge>
                      ))}
                      {(member.skills ?? []).slice(0, 5).map((skill) => <Badge key={skill} tone="neutral">{skill}</Badge>)}
                    </div>
                    <small><b>Owner:</b> {member.ownerName || "Unassigned"} · <b>Next:</b> {member.nextAction || "Decide the next action"}</small>
                    {member.note && <small>{member.note}</small>}
                    {member.reminderAt && (
                      <small>Reminder: {formatDate(member.reminderAt)}</small>
                    )}
                    <small>Profile updated {member.profileUpdatedAt ? formatDate(member.profileUpdatedAt) : "not available"} · Last active {member.lastActiveAt ? formatDate(member.lastActiveAt) : "not available"}</small>
                  </div>
                  <button
                    type="button"
                    className="workflow-text-danger"
                    onClick={() => onRemove(member.candidateId)}
                  >
                    Remove
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </section>
  );
}

function Campaigns({
  campaigns,
  jobs,
  pools,
  poolMembers,
  candidates,
  activePoolId,
  onPoolSelect,
  onCreate,
  onLaunch,
}: {
  campaigns: Campaign[];
  jobs: JobOption[];
  pools: TalentPool[];
  poolMembers: TalentPoolMember[];
  candidates: CandidateOption[];
  activePoolId: string;
  onPoolSelect: (id: string) => void;
  onCreate: (payload: {
    name: string;
    jobId: string | null;
    subject: string;
    bodyHtml: string;
    candidateIds: string[];
  }) => void;
  onLaunch: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [jobId, setJobId] = useState("");
  const [audienceSource, setAudienceSource] = useState<"pool" | "candidates">("pool");
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const audience = audienceSource === "pool" ? poolMembers.map((member) => member.candidateId) : selectedCandidateIds;
  const audienceNames = audienceSource === "pool" ? poolMembers.map((member) => member.fullName) : candidates.filter((candidate) => selectedCandidateIds.includes(candidate.candidateId)).map((candidate) => candidate.fullName);
  return (
    <section className="workflow-grid workflow-two">
      <form
        className="panel workflow-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            !name.trim() ||
            !subject.trim() ||
            !bodyHtml.trim() ||
            !audience.length
          )
            return;
          onCreate({
            name: name.trim(),
            jobId: jobId || null,
            subject: subject.trim(),
            bodyHtml: bodyHtml.trim(),
            candidateIds: audience,
          });
          setName("");
          setSubject("");
          setBodyHtml("");
          setJobId("");
          setSelectedCandidateIds([]);
        }}
      >
        <SectionTitle eyebrow="Respectful outreach" title="Build a campaign" />
        <p>
          Choose a role and a known audience. Sapienworx checks verification, consent, duplicates and opt-outs before any message is queued.
        </p>
        <label><span>Hiring role</span><select aria-label="Campaign hiring role" value={jobId} onChange={(event) => setJobId(event.target.value)}><option value="">General outreach</option>{jobs.map((job) => <option value={job.jobId} key={job.jobId}>{job.title} · {job.jobId}</option>)}</select></label>
        <label>
          <span>Campaign name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Java platform hiring — September"
            required
          />
        </label>
        <label>
          <span>Subject</span>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="A role that fits your backend experience"
            required
          />
        </label>
        <label>
          <span>Message</span>
          <textarea
            value={bodyHtml}
            onChange={(event) => setBodyHtml(event.target.value)}
            placeholder="Hi {{first_name}}, …"
            required
          />
        </label>
        <fieldset className="workflow-audience-picker"><legend>Audience</legend><div className="workflow-segmented"><button type="button" className={audienceSource === "pool" ? "active" : ""} onClick={() => setAudienceSource("pool")}>Talent pool</button><button type="button" className={audienceSource === "candidates" ? "active" : ""} onClick={() => setAudienceSource("candidates")}>Choose candidates</button></div>
          {audienceSource === "pool" ? <label><span>Talent pool</span><select aria-label="Campaign talent pool" value={activePoolId} onChange={(event) => onPoolSelect(event.target.value)} required><option value="">Choose a pool</option>{pools.map((pool) => <option value={pool.id} key={pool.id}>{pool.name} · {pool.candidateCount} candidates</option>)}</select></label> : <div className="workflow-candidate-checklist">{candidates.map((candidate) => <label key={candidate.candidateId}><input type="checkbox" checked={selectedCandidateIds.includes(candidate.candidateId)} onChange={(event) => setSelectedCandidateIds((current) => event.target.checked ? [...current, candidate.candidateId] : current.filter((id) => id !== candidate.candidateId))} /><span><b>{candidate.fullName}</b><small>{candidate.headline || "Profile"} · {candidate.location || "Location not shared"}</small></span></label>)}</div>}
        </fieldset>
        <div className="workflow-audience-preview"><b>{audience.length} profiles selected for preflight</b><span>{audienceNames.slice(0, 3).join(", ")}{audienceNames.length > 3 ? ` +${audienceNames.length - 3} more` : ""}</span><small>Verification, consent and opt-out checks run before the campaign is queued.</small></div>
        <Button type="submit">Create campaign</Button>
      </form>
      <section className="panel workflow-list">
        <SectionTitle
          eyebrow="Delivery and replies"
          title="Campaign activity"
        />
        {campaigns.length === 0 && (
          <EmptyCopy copy="Create a campaign once you have selected candidates in sourcing. Delivery, replies, and opt-outs will appear here." />
        )}
        {campaigns.map((campaign) => (
          <article key={campaign.id}>
            <div>
              <b>{campaign.name}</b>
              <p>{campaign.subject}</p>
              {campaign.jobTitle && <small>{campaign.jobTitle} · {campaign.jobId}</small>}
              <small>
                {campaign.sentCount}/{campaign.recipientCount} sent ·{" "}
                {campaign.repliedCount} replies · {campaign.optedOutCount} opted
                out · {campaign.excludedCount ?? 0} excluded
              </small>
              <span className="workflow-conversion"><i style={{ width: `${campaign.replyRate ?? (campaign.sentCount ? Math.round(campaign.repliedCount * 100 / campaign.sentCount) : 0)}%` }} /><b>{campaign.replyRate ?? (campaign.sentCount ? Math.round(campaign.repliedCount * 100 / campaign.sentCount) : 0)}% reply rate</b></span>
            </div>
            <div className="workflow-list-actions">
              <Badge
                tone={
                  campaign.status === "SENT"
                    ? "green"
                    : campaign.status === "DRAFT"
                      ? "neutral"
                      : "amber"
                }
              >
                {campaign.status}
              </Badge>
              {campaign.status === "DRAFT" && (
                <Button onClick={() => onLaunch(campaign.id)}>Launch</Button>
              )}
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}

function Interviews({
  interviews,
  applications,
  organisationMembers,
  onSchedule,
  onScore,
  onUpdate,
}: {
  interviews: Interview[];
  applications: PipelineApplication[];
  organisationMembers: OrganisationControls["members"];
  onSchedule: (payload: {
    applicationId: string;
    platformName: string;
    meetingLink: string;
    scheduledAt: string;
    durationMinutes: number;
    timeZone: string;
    agenda: string;
    panelRecruiterIds: string[];
  }) => Promise<boolean>;
  onScore: (payload: {
    interviewId: string;
    recommendation: string;
    score: number;
    feedback: string;
  }) => Promise<boolean>;
  onUpdate: (id: string, payload: { scheduledAt?: string; status?: string; timeZone?: string }) => Promise<boolean>;
}) {
  const [applicationId, setApplicationId] = useState("");
  const [platformName, setPlatformName] = useState("Google Meet");
  const [meetingLink, setMeetingLink] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [timeZone, setTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [agenda, setAgenda] = useState("");
  const [panelRecruiterIds, setPanelRecruiterIds] = useState<string[]>([]);
  const [scheduleError, setScheduleError] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [interviewId, setInterviewId] = useState("");
  const [recommendation, setRecommendation] = useState("YES");
  const [score, setScore] = useState(4);
  const [feedback, setFeedback] = useState("");
  const [scoring, setScoring] = useState(false);
  const [reschedulingId, setReschedulingId] = useState("");
  const [rescheduledAt, setRescheduledAt] = useState("");
  const now = Date.now();
  const upcomingCount = interviews.filter(
    (interview) =>
      !["CANCELLED", "COMPLETED"].includes(interview.status) &&
      Date.parse(interview.scheduledAt) >= now,
  ).length;
  const awaitingFeedback = interviews.filter(
    (interview) => interview.scorecards.length === 0,
  ).length;

  useEffect(() => {
    if (!interviewId && interviews.length) setInterviewId(interviews[0].id);
  }, [interviewId, interviews]);

  const submitSchedule = async (event: FormEvent) => {
    event.preventDefault();
    setScheduleError("");
    const parsedDate = new Date(scheduledAt);
    if (!applicationId) {
      setScheduleError("Choose a candidate application before scheduling.");
      return;
    }
    if (!scheduledAt || Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() <= Date.now()) {
      setScheduleError("Choose a date and time in the future.");
      return;
    }
    if (!meetingLink.trim()) {
      setScheduleError("Add a meeting link or interview location.");
      return;
    }
    setScheduling(true);
    const saved = await onSchedule({
      applicationId,
      platformName,
      meetingLink: meetingLink.trim(),
      scheduledAt: parsedDate.toISOString(),
      durationMinutes,
      timeZone,
      agenda: agenda.trim(),
      panelRecruiterIds,
    });
    setScheduling(false);
    if (saved) {
      setApplicationId("");
      setMeetingLink("");
      setScheduledAt("");
      setDurationMinutes(30);
      setAgenda("");
      setPanelRecruiterIds([]);
    }
  };

  const submitScore = async (event: FormEvent) => {
    event.preventDefault();
    if (!interviewId || !feedback.trim()) return;
    setScoring(true);
    const saved = await onScore({
      interviewId,
      recommendation,
      score,
      feedback: feedback.trim(),
    });
    setScoring(false);
    if (saved) setFeedback("");
  };

  return (
    <section className="workflow-interview-workspace">
      <header className="panel workflow-interview-summary">
        <div>
          <span className="eyebrow">Interview operations</span>
          <h2>Keep every conversation moving.</h2>
          <p>Schedule from live applications, join the meeting, then capture a consistent hiring recommendation.</p>
        </div>
        <div aria-label="Interview summary">
          <span><b>{upcomingCount}</b> upcoming</span>
          <span><b>{awaitingFeedback}</b> awaiting feedback</span>
        </div>
      </header>

      <section className="workflow-grid workflow-two workflow-interview-grid">
        <form className="panel workflow-form" onSubmit={(event) => void submitSchedule(event)}>
          <SectionTitle eyebrow="Plan the conversation" title="Schedule interview" />
          <p>Select an application from your pipeline. Sapienworx will notify the candidate after the interview is saved.</p>
          {scheduleError && <p className="workflow-field-error" role="alert">{scheduleError}</p>}
          <label>
            <span>Candidate application</span>
            <select aria-label="Candidate application" value={applicationId} onChange={(event) => setApplicationId(event.target.value)} required>
              <option value="">Choose a candidate and role</option>
              {applications.map((application) => (
                <option value={application.applicationId} key={application.applicationId}>
                  {application.fullName} — {application.jobTitle} ({humanStatus(application.pipelineStage)})
                </option>
              ))}
            </select>
          </label>
          {!applications.length && <small className="workflow-form-hint">No active applications are available yet. Move a candidate into your pipeline before scheduling.</small>}
          <div className="workflow-schedule-fields">
            <label>
              <span>Interview format</span>
              <select aria-label="Interview format" value={platformName} onChange={(event) => setPlatformName(event.target.value)}>
                <option>Google Meet</option>
                <option>Microsoft Teams</option>
                <option>Zoom</option>
                <option>Phone</option>
                <option>In person</option>
              </select>
            </label>
            <label>
              <span>Duration</span>
              <select aria-label="Interview duration" value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}>
                {[15, 30, 45, 60, 90, 120].map((minutes) => <option value={minutes} key={minutes}>{minutes} minutes</option>)}
              </select>
            </label>
          </div>
          <label>
            <span>Date and time</span>
            <input aria-label="Interview date and time" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required />
          </label>
          <label><span>Timezone</span><select aria-label="Interview timezone" value={timeZone} onChange={(event) => setTimeZone(event.target.value)}>{[timeZone, "Asia/Kolkata", "Europe/London", "America/New_York", "America/Los_Angeles", "UTC"].filter((value, index, items) => items.indexOf(value) === index).map((zone) => <option key={zone}>{zone}</option>)}</select></label>
          <fieldset className="workflow-panel-picker"><legend>Interview panel</legend>{organisationMembers.map((member) => <label key={member.recruiterId}><input type="checkbox" checked={panelRecruiterIds.includes(member.recruiterId)} onChange={(event) => setPanelRecruiterIds((current) => event.target.checked ? [...current, member.recruiterId] : current.filter((id) => id !== member.recruiterId))} /> {member.fullName} <small>{humanStatus(member.workspaceRole)}</small></label>)}</fieldset>
          <label><span>Shared agenda</span><textarea aria-label="Interview agenda" value={agenda} onChange={(event) => setAgenda(event.target.value)} placeholder="Competencies, portfolio areas and questions the panel should cover" /></label>
          <label>
            <span>{platformName === "In person" ? "Interview location" : "Meeting link or dial-in"}</span>
            <input aria-label="Meeting link or location" value={meetingLink} onChange={(event) => setMeetingLink(event.target.value)} placeholder={platformName === "In person" ? "e.g. Bengaluru office · Meeting room 4" : "https://meet.example.com/…"} required />
          </label>
          <Button type="submit" disabled={scheduling || !applications.length}>{scheduling ? "Scheduling…" : "Schedule and notify candidate"}</Button>
        </form>

        <section className="panel workflow-list workflow-interview-list">
          <SectionTitle eyebrow="Shared agenda" title="Interviews and reminders" />
          {interviews.length === 0 && <EmptyCopy copy="Your interview calendar is ready. Schedule the first conversation using an application from the pipeline." />}
          {interviews.map((interview) => {
            const isLink = /^https?:\/\//i.test(interview.meetingLink);
            return <article className="workflow-interview-card" key={interview.id}>
              <time dateTime={interview.scheduledAt}><b>{formatInterviewDay(interview.scheduledAt)}</b><span>{formatInterviewTime(interview.scheduledAt)}</span></time>
              <div>
                <div className="workflow-interview-card-title"><b>{interview.candidateName}</b><Badge tone={interviewTone(interview.status)}>{humanStatus(interview.status)}</Badge></div>
                <p>{interview.jobTitle}</p>
                <small>{interview.platformName} · {interview.durationMinutes} min · {interview.timeZone || "UTC"}</small>
                {interview.panelRecruiterNames?.length ? <small>Panel: {interview.panelRecruiterNames.join(", ")}</small> : <small>Panel owner only</small>}
                {interview.agenda && <small>Agenda: {interview.agenda}</small>}
                <small>{interview.scorecards.length ? `${interview.scorecards.length} scorecard${interview.scorecards.length === 1 ? "" : "s"} submitted` : "Scorecard pending"}</small>
              </div>
              <div className="workflow-interview-actions">
                {isLink ? <a className="button button-secondary" href={interview.meetingLink} target="_blank" rel="noreferrer">Join meeting</a> : <span className="workflow-interview-location">{interview.meetingLink}</span>}
                <button type="button" onClick={() => setInterviewId(interview.id)}>Write feedback</button>
                <button type="button" onClick={() => downloadInterviewCalendar(interview)}>Add to calendar</button>
                {!['CANCELLED', 'COMPLETED'].includes(interview.status) && <><button type="button" onClick={() => { setReschedulingId(interview.id); setRescheduledAt(localDateTimeValue(interview.scheduledAt)); }}>Reschedule</button><button className="workflow-text-danger" type="button" onClick={() => void onUpdate(interview.id, { status: "CANCELLED" })}>Cancel</button><button type="button" onClick={() => void onUpdate(interview.id, { status: "COMPLETED" })}>Complete</button></>}
                {reschedulingId === interview.id && <form className="workflow-reschedule" onSubmit={(event) => { event.preventDefault(); if (!rescheduledAt) return; void onUpdate(interview.id, { scheduledAt: new Date(rescheduledAt).toISOString(), timeZone }).then((saved) => { if (saved) setReschedulingId(""); }); }}><input aria-label={`New time for ${interview.candidateName}`} type="datetime-local" value={rescheduledAt} onChange={(event) => setRescheduledAt(event.target.value)} required /><button type="submit">Save new time</button></form>}
              </div>
            </article>;
          })}
        </section>
      </section>

      <form
        className="panel workflow-form workflow-scorecard-form"
        onSubmit={(event) => void submitScore(event)}
      >
        <SectionTitle eyebrow="Structured feedback" title="Interview scorecard" />
        <p>Capture a consistent recommendation and evidence. Candidates never see private interviewer feedback.</p>
        <div className="workflow-scorecard-grid">
          <label>
            <span>Interview</span>
            <select aria-label="Scorecard interview" value={interviewId} onChange={(event) => setInterviewId(event.target.value)} required>
              <option value="">Choose an interview</option>
              {interviews.map((interview) => <option value={interview.id} key={interview.id}>{interview.candidateName} — {interview.jobTitle}</option>)}
            </select>
          </label>
          <label>
            <span>Recommendation</span>
            <select aria-label="Interview recommendation" value={recommendation} onChange={(event) => setRecommendation(event.target.value)}>
              <option value="STRONG_YES">Strong yes</option><option value="YES">Yes</option><option value="MAYBE">Maybe</option><option value="NO">No</option><option value="STRONG_NO">Strong no</option>
            </select>
          </label>
          <label>
            <span>Score: {score}/5</span>
            <input aria-label="Interview score" type="range" min="1" max="5" value={score} onChange={(event) => setScore(Number(event.target.value))} />
          </label>
          <label className="workflow-scorecard-feedback">
            <span>Feedback</span>
            <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Evidence from the interview, strengths, and risks" required />
          </label>
        </div>
        <Button type="submit" disabled={scoring || !interviews.length}>{scoring ? "Saving…" : "Save scorecard"}</Button>
        {interviewId && <div className="workflow-scorecard-history">{interviews.find((interview) => interview.id === interviewId)?.scorecards.map((card) => <article key={card.id}><b>{card.recruiterName}</b><Badge tone={card.recommendation.includes("NO") ? "rose" : card.recommendation === "MAYBE" ? "amber" : "green"}>{humanStatus(card.recommendation)}</Badge><span>{card.score}/5</span><p>{card.feedback}</p></article>)}</div>}
      </form>
    </section>
  );
}

function humanStatus(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function formatInterviewDay(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(value));
}

function formatInterviewTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function localDateTimeValue(value: string) {
  const date = new Date(value); const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function downloadInterviewCalendar(interview: Interview) {
  const start = new Date(interview.scheduledAt);
  const end = new Date(start.getTime() + interview.durationMinutes * 60_000);
  const stamp = (value: Date) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sapienworx//Recruitment Workspace//EN", "BEGIN:VEVENT", `UID:${interview.id}@sapienworx`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${interview.jobTitle} interview with ${interview.candidateName}`, `DESCRIPTION:${(interview.agenda || "Recruitment interview").replace(/\n/g, "\\n")}`, `LOCATION:${interview.meetingLink}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([body], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `${interview.candidateName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-interview.ics`; link.click(); URL.revokeObjectURL(url);
}

function interviewTone(status: string): "blue" | "green" | "rose" | "neutral" {
  if (status === "COMPLETED") return "green";
  if (status === "CANCELLED") return "rose";
  if (status === "SCHEDULED" || status === "RESCHEDULED") return "blue";
  return "neutral";
}

function OrganisationControlsPanel({
  controls,
  onSave,
  onMemberRole,
}: {
  controls: OrganisationControls;
  onSave: (
    payload: Omit<
      OrganisationControls,
      "currentUserRole" | "updatedAt" | "members"
    >,
  ) => void;
  onMemberRole: (payload: {
    recruiterId: string;
    workspaceRole: string;
  }) => void;
}) {
  const [candidateRetentionDays, setCandidateRetentionDays] = useState(
    controls.candidateRetentionDays,
  );
  const [auditRetentionDays, setAuditRetentionDays] = useState(
    controls.auditRetentionDays,
  );
  const [alerts, setAlerts] = useState(controls.savedSearchAlertsEnabled);
  const [campaigns, setCampaigns] = useState(controls.campaignsEnabled);
  const canManage = controls.currentUserRole === "ORG_ADMIN";
  return (
    <section className="workflow-admin-controls">
      <header className="panel workflow-admin-banner"><div><span className="eyebrow">Administration boundary</span><h2>Organisation controls are separate from daily recruiting.</h2><p>Recruiters can understand the active policy here. Only organisation administrators can change permissions, retention or outreach capabilities.</p></div><Badge tone={canManage ? "green" : "neutral"}>{canManage ? "Admin access" : "Read only"}</Badge></header>
      <div className="workflow-grid workflow-two">
      <form
        className="panel workflow-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            candidateRetentionDays,
            auditRetentionDays,
            savedSearchAlertsEnabled: alerts,
            campaignsEnabled: campaigns,
          });
        }}
      >
        <SectionTitle
          eyebrow="Governance"
          title="Retention and feature controls"
        />
        <p>
          Your workspace role:{" "}
          <Badge tone={canManage ? "green" : "neutral"}>
            {controls.currentUserRole.replace("_", " ")}
          </Badge>
        </p>
        <label>
          <span>Candidate data retention (days)</span>
          <input
            type="number"
            min="30"
            max="3650"
            value={candidateRetentionDays}
            disabled={!canManage}
            onChange={(event) =>
              setCandidateRetentionDays(Number(event.target.value))
            }
          />
        </label>
        <label>
          <span>Audit evidence retention (days)</span>
          <input
            type="number"
            min="365"
            max="7300"
            value={auditRetentionDays}
            disabled={!canManage}
            onChange={(event) =>
              setAuditRetentionDays(Number(event.target.value))
            }
          />
        </label>
        <label className="workflow-check">
          <input
            type="checkbox"
            checked={alerts}
            disabled={!canManage}
            onChange={(event) => setAlerts(event.target.checked)}
          />
          <span>
            <b>Enable saved-search alerts</b>
            <small>Allow recruiter search alerts for this organisation.</small>
          </span>
        </label>
        <label className="workflow-check">
          <input
            type="checkbox"
            checked={campaigns}
            disabled={!canManage}
            onChange={(event) => setCampaigns(event.target.checked)}
          />
          <span>
            <b>Enable recruitment campaigns</b>
            <small>Allow individual queued outreach with opt-outs.</small>
          </span>
        </label>
        {canManage && <Button type="submit">Save controls</Button>}
        <small className="workflow-policy-updated">Last policy update: {formatDate(controls.updatedAt)}</small>
      </form>
      <section className="panel workflow-list">
        <SectionTitle eyebrow="Permissions" title="Organisation members" />
        {controls.members.map((member) => (
          <article key={member.recruiterId}>
            <div>
              <b>{member.fullName}</b>
              <p>{member.officialEmail}</p>
            </div>
            {canManage ? (
              <select
                value={member.workspaceRole}
                onChange={(event) =>
                  onMemberRole({
                    recruiterId: member.recruiterId,
                    workspaceRole: event.target.value,
                  })
                }
              >
                <option value="ORG_ADMIN">Organisation admin</option>
                <option value="HIRING_MANAGER">Hiring manager</option>
                <option value="RECRUITER">Recruiter</option>
              </select>
            ) : (
              <Badge tone="neutral">
                {member.workspaceRole.replace("_", " ")}
              </Badge>
            )}
          </article>
        ))}
      </section>
      </div>
      <section className="panel workflow-policy-impact"><SectionTitle eyebrow="Policy impact" title="What these controls protect" /><div><article><b>{controls.candidateRetentionDays} days</b><span>Candidate records retained</span></article><article><b>{controls.auditRetentionDays} days</b><span>Audit evidence retained</span></article><article><b>{controls.savedSearchAlertsEnabled ? "Enabled" : "Paused"}</b><span>Saved-search alerts</span></article><article><b>{controls.campaignsEnabled ? "Enabled" : "Paused"}</b><span>Recruitment campaigns</span></article></div><p>Every contact reveal remains tied to a candidate, recruiter, purpose and Job ID. Diversity information must never be used for ranking individual candidates.</p></section>
    </section>
  );
}

function EmptyCopy({ copy }: { copy: string }) {
  return (
    <div className="workflow-empty">
      <span>◌</span>
      <p>{copy}</p>
    </div>
  );
}
