"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";
import { searchParamsFor, type RecruiterSearchState } from "../lib/recruiter-search";
import { Badge, Button, WorkspaceShell } from "./ui";
import styles from "./recruiter-talent-crm.module.css";

type SavedSearch = {
  id: string;
  name: string;
  criteria: RecruiterSearchState;
  alertFrequency: "OFF" | "DAILY" | "INSTANT";
  lastAlertedAt: string | null;
  alertStatus: string;
  updatedAt: string | null;
};

type TalentPool = {
  id: string;
  name: string;
  description: string | null;
  jobId: string | null;
  jobTitle: string | null;
  candidateCount: number;
  updatedAt: string | null;
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
  nextAction: string | null;
  experienceYears: number | null;
  expectedSalaryLakhs: number | null;
  noticePeriodDays: number | null;
  skills: string[];
  lastActiveAt: string | null;
  updatedAt: string | null;
};

type WorkflowAnalytics = {
  savedSearches: number;
  talentPools: number;
  candidatesInPools: number;
  dueReminders: number;
  activeCampaigns: number;
};

type RediscoveryCandidate = {
  candidateId: string;
  fullName: string;
  headline: string | null;
  location: string | null;
  currentCompany: string | null;
  experienceYears: number | null;
  noticePeriodDays: number | null;
  skills: string[];
  latestJobTitle: string | null;
  latestStage: string | null;
  applicationCount: number;
  interviewedBefore: boolean;
  reachedFinalStage: boolean;
  poolCount: number;
  lastAppliedAt: string | null;
  lastActiveAt: string | null;
};

type RediscoveryWorkspace = {
  metrics: {
    totalCandidates: number;
    interviewedCandidates: number;
    finalStageCandidates: number;
    pooledCandidates: number;
  };
  candidates: RediscoveryCandidate[];
};

function when(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function stage(value: string | null) {
  if (!value) return "Previous applicant";
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "TC";
}

export function RecruiterTalentCrm() {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [pools, setPools] = useState<TalentPool[]>([]);
  const [members, setMembers] = useState<TalentPoolMember[]>([]);
  const [analytics, setAnalytics] = useState<WorkflowAnalytics | null>(null);
  const [rediscovery, setRediscovery] = useState<RediscoveryWorkspace | null>(null);
  const [activePoolId, setActivePoolId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [poolLoading, setPoolLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [newPoolName, setNewPoolName] = useState("");
  const [newPoolDescription, setNewPoolDescription] = useState("");
  const [creatingPool, setCreatingPool] = useState(false);
  const [addingCandidateId, setAddingCandidateId] = useState("");

  const loadRediscovery = useCallback(async (searchQuery = "") => {
    setSearching(true);
    try {
      const result = await apiClient<RediscoveryWorkspace>(`/api/recruiter/talent-crm/rediscovery?query=${encodeURIComponent(searchQuery)}&limit=30`);
      setRediscovery(result);
    } finally {
      setSearching(false);
    }
  }, []);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [searches, talentPools, workflowAnalytics, rediscovered] = await Promise.all([
        apiClient<SavedSearch[]>("/api/recruiter/workflow/saved-searches"),
        apiClient<TalentPool[]>("/api/recruiter/workflow/talent-pools"),
        apiClient<WorkflowAnalytics>("/api/recruiter/workflow/analytics"),
        apiClient<RediscoveryWorkspace>("/api/recruiter/talent-crm/rediscovery?limit=30"),
      ]);
      setSavedSearches(searches);
      setPools(talentPools);
      setAnalytics(workflowAnalytics);
      setRediscovery(rediscovered);
      setActivePoolId((current) => current || talentPools[0]?.id || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Talent CRM could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);

  useEffect(() => {
    if (!activePoolId) { setMembers([]); return; }
    const controller = new AbortController();
    setPoolLoading(true);
    void apiClient<TalentPoolMember[]>(`/api/recruiter/workflow/talent-pools/${activePoolId}/members`, { signal: controller.signal })
      .then(setMembers)
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Talent pool members could not be loaded."); })
      .finally(() => { if (!controller.signal.aborted) setPoolLoading(false); });
    return () => controller.abort();
  }, [activePoolId]);

  const selectedPool = useMemo(() => pools.find((pool) => pool.id === activePoolId) ?? null, [pools, activePoolId]);
  const dueMembers = useMemo(() => members.filter((member) => member.reminderAt && new Date(member.reminderAt).getTime() <= Date.now()), [members]);

  const runSavedSearch = (record: SavedSearch) => {
    const criteria = { ...record.criteria, gender: "" as const };
    const params = searchParamsFor(criteria).toString();
    window.location.assign(`/search/results${params ? `?${params}` : ""}`);
  };

  const createPool = async () => {
    if (!newPoolName.trim()) return;
    setCreatingPool(true); setNotice(""); setError("");
    try {
      const pool = await apiClient<TalentPool>("/api/recruiter/workflow/talent-pools", {
        method: "POST",
        body: JSON.stringify({ name: newPoolName.trim(), description: newPoolDescription.trim() || null, jobId: null }),
      });
      setPools((current) => [pool, ...current]);
      setActivePoolId(pool.id);
      setNewPoolName(""); setNewPoolDescription("");
      setNotice(`Talent pool “${pool.name}” created.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Talent pool could not be created.");
    } finally {
      setCreatingPool(false);
    }
  };

  const addToPool = async (candidate: RediscoveryCandidate) => {
    if (!activePoolId) {
      setError("Create or select a talent pool before adding a candidate.");
      return;
    }
    setAddingCandidateId(candidate.candidateId); setNotice(""); setError("");
    try {
      const member = await apiClient<TalentPoolMember>(`/api/recruiter/workflow/talent-pools/${activePoolId}/members`, {
        method: "PUT",
        body: JSON.stringify({
          candidateId: candidate.candidateId,
          tags: ["Rediscovered"],
          ownerRecruiterId: null,
          reminderAt: null,
          note: `Rediscovered from ${candidate.applicationCount} previous application${candidate.applicationCount === 1 ? "" : "s"}.`,
          nextAction: "Review for a current or upcoming role",
        }),
      });
      setMembers((current) => [member, ...current.filter((item) => item.candidateId !== member.candidateId)]);
      setPools((current) => current.map((pool) => pool.id === activePoolId ? { ...pool, candidateCount: Math.max(pool.candidateCount, members.some((item) => item.candidateId === member.candidateId) ? pool.candidateCount : pool.candidateCount + 1) } : pool));
      setNotice(`${candidate.fullName} added to ${selectedPool?.name ?? "the talent pool"}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Candidate could not be added to the talent pool.");
    } finally {
      setAddingCandidateId("");
    }
  };

  return (
    <WorkspaceShell
      workspace="recruiter"
      active="sourcing"
      title="Talent CRM"
      description="Rediscover proven candidates, maintain reusable talent pools, and return to saved sourcing searches without losing hiring context."
      actions={<><Button href="/recruiter/sourcing" variant="secondary">Search new talent</Button><Button href="/recruiter/communications">Outreach</Button></>}
    >
      <div className={styles.workspace}>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {notice && <p className={styles.notice} role="status">{notice}</p>}

        <section className={styles.metrics} aria-label="Talent CRM summary">
          <article><span>Previous candidates</span><strong>{rediscovery?.metrics.totalCandidates ?? "—"}</strong><small>Known to your organisation</small></article>
          <article><span>Previously interviewed</span><strong>{rediscovery?.metrics.interviewedCandidates ?? "—"}</strong><small>Evidence already exists</small></article>
          <article><span>Reached final stages</span><strong>{rediscovery?.metrics.finalStageCandidates ?? "—"}</strong><small>High-context rediscovery</small></article>
          <article><span>Talent pools</span><strong>{analytics?.talentPools ?? pools.length}</strong><small>{analytics?.candidatesInPools ?? 0} memberships</small></article>
          <article><span>Due follow-ups</span><strong>{analytics?.dueReminders ?? dueMembers.length}</strong><small>CRM actions needing attention</small></article>
        </section>

        <div className={styles.grid}>
          <main className={styles.main}>
            <section className={styles.panel}>
              <header className={styles.panelHeader}>
                <div><span className="eyebrow">Rediscovery</span><h2>Search people you already know</h2><p>Previous applicants are ordered by hiring evidence and recency—not a fabricated AI fit score.</p></div>
                <Badge tone="blue">{rediscovery?.metrics.pooledCandidates ?? 0} already pooled</Badge>
              </header>
              <form className={styles.rediscoverySearch} onSubmit={(event) => { event.preventDefault(); void loadRediscovery(query); }}>
                <label><span className="sr-only">Search previous candidates</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, title, company or skill" /></label>
                <Button type="submit" disabled={searching}>{searching ? "Searching…" : "Search history"}</Button>
                {query && <Button variant="quiet" onClick={() => { setQuery(""); void loadRediscovery(""); }}>Clear</Button>}
              </form>

              <div className={styles.candidateTableWrap}>
                <table className={styles.candidateTable}>
                  <thead><tr><th>Candidate</th><th>Prior hiring evidence</th><th>Professional context</th><th>Activity</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {rediscovery?.candidates.map((candidate) => (
                      <tr key={candidate.candidateId}>
                        <td><div className={styles.person}><span>{initials(candidate.fullName)}</span><div><a href={`/recruiter/candidates/${candidate.candidateId}`}>{candidate.fullName}</a><small>{candidate.headline || candidate.currentCompany || "Profile headline not shared"}</small></div></div></td>
                        <td><div className={styles.evidence}><strong>{stage(candidate.latestStage)}</strong><small>{candidate.latestJobTitle || "Previous role"}</small><div>{candidate.interviewedBefore && <Badge tone="blue">Interviewed</Badge>}{candidate.reachedFinalStage && <Badge tone="green">Final-stage history</Badge>}{candidate.applicationCount > 1 && <Badge>{candidate.applicationCount} applications</Badge>}</div></div></td>
                        <td><strong>{candidate.experienceYears == null ? "Experience not shared" : `${candidate.experienceYears} yrs`}</strong><small>{candidate.location || "Location not shared"}{candidate.noticePeriodDays == null ? "" : ` · ${candidate.noticePeriodDays}d notice`}</small><div className={styles.skills}>{candidate.skills.slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}</div></td>
                        <td><strong>{when(candidate.lastAppliedAt)}</strong><small>Last application</small><small>{candidate.poolCount ? `${candidate.poolCount} pool${candidate.poolCount === 1 ? "" : "s"}` : "Not in a pool"}</small></td>
                        <td><Button variant="secondary" onClick={() => void addToPool(candidate)} disabled={addingCandidateId === candidate.candidateId || !activePoolId}>{addingCandidateId === candidate.candidateId ? "Adding…" : "Add to pool"}</Button></td>
                      </tr>
                    ))}
                    {!loading && !rediscovery?.candidates.length && <tr><td colSpan={5} className={styles.empty}>No previous candidates match this search.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHeader}><div><span className="eyebrow">Saved sourcing</span><h2>Reusable searches & alerts</h2><p>Return to proven sourcing criteria without reconstructing filters.</p></div><Button href="/recruiter/sourcing" variant="secondary">New search</Button></header>
              <div className={styles.savedSearches}>
                {savedSearches.slice(0, 8).map((record) => <article key={record.id}><div><strong>{record.name}</strong><small>Updated {when(record.updatedAt)}</small></div><span><Badge tone={record.alertFrequency === "OFF" ? "neutral" : "green"}>{record.alertFrequency === "OFF" ? "Alerts off" : `${record.alertFrequency.toLowerCase()} alerts`}</Badge><button type="button" onClick={() => runSavedSearch(record)}>Run search</button></span></article>)}
                {!loading && !savedSearches.length && <p className={styles.empty}>No saved searches yet. Save a sourcing search to make it reusable here.</p>}
              </div>
            </section>
          </main>

          <aside className={styles.sidebar}>
            <section className={styles.panel}>
              <header className={styles.panelHeader}><div><span className="eyebrow">Talent pools</span><h2>Reusable lists</h2></div></header>
              <label className={styles.poolSelect}><span>Active pool</span><select value={activePoolId} onChange={(event) => setActivePoolId(event.target.value)}><option value="">Select a pool</option>{pools.map((pool) => <option value={pool.id} key={pool.id}>{pool.name} · {pool.candidateCount}</option>)}</select></label>
              {selectedPool && <div className={styles.poolSummary}><strong>{selectedPool.name}</strong><p>{selectedPool.description || "Shared organisation talent pool"}</p>{selectedPool.jobTitle && <small>Linked job · {selectedPool.jobTitle}</small>}</div>}
              <details className={styles.createPool}><summary>Create talent pool</summary><label><span>Name</span><input value={newPoolName} onChange={(event) => setNewPoolName(event.target.value)} maxLength={160} placeholder="Senior Java · Mumbai" /></label><label><span>Description</span><textarea value={newPoolDescription} onChange={(event) => setNewPoolDescription(event.target.value)} maxLength={1000} rows={3} placeholder="Who belongs in this pool and why" /></label><Button onClick={() => void createPool()} disabled={creatingPool || !newPoolName.trim()}>{creatingPool ? "Creating…" : "Create pool"}</Button></details>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHeader}><div><span className="eyebrow">CRM follow-up</span><h2>{selectedPool ? selectedPool.name : "Pool members"}</h2></div>{poolLoading && <small>Loading…</small>}</header>
              <div className={styles.members}>
                {members.slice(0, 10).map((member) => <article key={member.candidateId}><div className={styles.memberTop}><a href={`/recruiter/candidates/${member.candidateId}`}>{member.fullName}</a>{member.reminderAt && new Date(member.reminderAt).getTime() <= Date.now() && <Badge tone="amber">Due</Badge>}</div><small>{member.headline || member.location || "Candidate profile"}</small>{member.nextAction && <p><b>Next:</b> {member.nextAction}</p>}<div className={styles.memberMeta}>{member.ownerName && <span>Owner · {member.ownerName}</span>}{member.reminderAt && <span>Follow-up · {when(member.reminderAt)}</span>}</div>{member.tags.length > 0 && <div className={styles.skills}>{member.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}</article>)}
                {!poolLoading && activePoolId && !members.length && <p className={styles.empty}>This pool is empty. Add a rediscovered or sourced candidate.</p>}
                {!activePoolId && <p className={styles.empty}>Select or create a talent pool to manage CRM follow-ups.</p>}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </WorkspaceShell>
  );
}
