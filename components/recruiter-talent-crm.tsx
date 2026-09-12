"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";
import { defaultRecruiterSearch, searchParamsFor, type RecruiterSearchState } from "../lib/recruiter-search";
import { Badge, Button, WorkspaceShell } from "./ui";
import styles from "./recruiter-talent-crm.module.css";

type SavedSearch = {
  id: string;
  name: string;
  criteria: Partial<RecruiterSearchState>;
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

type OrganisationMember = {
  recruiterId: string;
  fullName: string;
  officialEmail: string;
  workspaceRole: string;
};

type OrganisationControls = {
  members: OrganisationMember[];
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

function reminderInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function MemberCard({
  member,
  poolId,
  organisationMembers,
  onSaved,
  onRemoved,
}: {
  member: TalentPoolMember;
  poolId: string;
  organisationMembers: OrganisationMember[];
  onSaved: (member: TalentPoolMember) => void;
  onRemoved: (candidateId: string) => void;
}) {
  const currentOwner = organisationMembers.find((person) => person.fullName === member.ownerName)?.recruiterId ?? "";
  const [ownerRecruiterId, setOwnerRecruiterId] = useState(currentOwner);
  const [nextAction, setNextAction] = useState(member.nextAction ?? "");
  const [note, setNote] = useState(member.note ?? "");
  const [tags, setTags] = useState(member.tags.join(", "));
  const [reminderAt, setReminderAt] = useState(reminderInput(member.reminderAt));
  const [pending, setPending] = useState<"save" | "remove" | "">("");
  const [error, setError] = useState("");
  const due = Boolean(member.reminderAt && new Date(member.reminderAt).getTime() <= Date.now());

  const save = async () => {
    setPending("save"); setError("");
    try {
      const result = await apiClient<TalentPoolMember>(`/api/recruiter/workflow/talent-pools/${poolId}/members`, {
        method: "PUT",
        body: JSON.stringify({
          candidateId: member.candidateId,
          tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 12),
          ownerRecruiterId: ownerRecruiterId || null,
          reminderAt: reminderAt ? new Date(reminderAt).toISOString() : null,
          note: note.trim() || null,
          nextAction: nextAction.trim() || null,
        }),
      });
      onSaved(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "CRM follow-up could not be saved.");
    } finally {
      setPending("");
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove ${member.fullName} from this talent pool?`)) return;
    setPending("remove"); setError("");
    try {
      await apiClient(`/api/recruiter/workflow/talent-pools/${poolId}/members/${member.candidateId}`, { method: "DELETE" });
      onRemoved(member.candidateId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Candidate could not be removed from this pool.");
    } finally {
      setPending("");
    }
  };

  return <article className={styles.memberCard}>
    <div className={styles.memberTop}>
      <a href={`/recruiter/candidates/${member.candidateId}`}>{member.fullName}</a>
      {due && <Badge tone="amber">Follow-up due</Badge>}
    </div>
    <small>{member.headline || member.location || "Candidate profile"}</small>
    {member.nextAction && <p><b>Next:</b> {member.nextAction}</p>}
    <div className={styles.memberMeta}>
      {member.ownerName && <span>Owner · {member.ownerName}</span>}
      {member.reminderAt && <span>Follow-up · {when(member.reminderAt)}</span>}
    </div>
    {member.tags.length > 0 && <div className={styles.skills}>{member.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
    <details className={styles.crmEditor}>
      <summary>Manage follow-up</summary>
      <div className={styles.crmFields}>
        <label><span>Owner</span><select value={ownerRecruiterId} onChange={(event) => setOwnerRecruiterId(event.target.value)}><option value="">Unassigned</option>{organisationMembers.map((person) => <option key={person.recruiterId} value={person.recruiterId}>{person.fullName}</option>)}</select></label>
        <label><span>Follow-up</span><input type="datetime-local" value={reminderAt} onChange={(event) => setReminderAt(event.target.value)} /></label>
        <label className={styles.fullField}><span>Next action</span><input value={nextAction} maxLength={240} onChange={(event) => setNextAction(event.target.value)} placeholder="Contact for backend opening" /></label>
        <label className={styles.fullField}><span>Tags</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Java, final-stage, warm" /></label>
        <label className={styles.fullField}><span>Recruiter note</span><textarea rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Context worth preserving for the next recruiter" /></label>
      </div>
      {error && <p className={styles.inlineError} role="alert">{error}</p>}
      <div className={styles.crmActions}><Button variant="secondary" onClick={() => void save()} disabled={Boolean(pending)}>{pending === "save" ? "Saving…" : "Save CRM update"}</Button><button type="button" className={styles.removeMember} onClick={() => void remove()} disabled={Boolean(pending)}>{pending === "remove" ? "Removing…" : "Remove from pool"}</button></div>
    </details>
  </article>;
}

export function RecruiterTalentCrm() {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [pools, setPools] = useState<TalentPool[]>([]);
  const [members, setMembers] = useState<TalentPoolMember[]>([]);
  const [organisationMembers, setOrganisationMembers] = useState<OrganisationMember[]>([]);
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

  const refreshAnalytics = useCallback(async () => {
    try { setAnalytics(await apiClient<WorkflowAnalytics>("/api/recruiter/workflow/analytics")); } catch { /* non-blocking summary refresh */ }
  }, []);

  const loadRediscovery = useCallback(async (searchQuery = "") => {
    setSearching(true);
    try {
      setRediscovery(await apiClient<RediscoveryWorkspace>(`/api/recruiter/talent-crm/rediscovery?query=${encodeURIComponent(searchQuery)}&limit=30`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Candidate history could not be searched.");
    } finally {
      setSearching(false);
    }
  }, []);

  const loadWorkspace = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [searches, talentPools, workflowAnalytics, rediscovered, controls] = await Promise.all([
        apiClient<SavedSearch[]>("/api/recruiter/workflow/saved-searches"),
        apiClient<TalentPool[]>("/api/recruiter/workflow/talent-pools"),
        apiClient<WorkflowAnalytics>("/api/recruiter/workflow/analytics"),
        apiClient<RediscoveryWorkspace>("/api/recruiter/talent-crm/rediscovery?limit=30"),
        apiClient<OrganisationControls>("/api/recruiter/workflow/organisation-controls"),
      ]);
      setSavedSearches(searches);
      setPools(talentPools);
      setAnalytics(workflowAnalytics);
      setRediscovery(rediscovered);
      setOrganisationMembers(controls.members ?? []);
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
    const criteria: RecruiterSearchState = { ...defaultRecruiterSearch, ...record.criteria, gender: "" };
    const params = searchParamsFor(criteria).toString();
    window.location.assign(`/search/results${params ? `?${params}` : ""}`);
  };

  const deleteSavedSearch = async (record: SavedSearch) => {
    if (!window.confirm(`Delete saved search “${record.name}”?`)) return;
    setError(""); setNotice("");
    try {
      await apiClient(`/api/recruiter/workflow/saved-searches/${record.id}`, { method: "DELETE" });
      setSavedSearches((current) => current.filter((item) => item.id !== record.id));
      setNotice(`Saved search “${record.name}” deleted.`);
      void refreshAnalytics();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Saved search could not be deleted.");
    }
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
      void refreshAnalytics();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Talent pool could not be created.");
    } finally {
      setCreatingPool(false);
    }
  };

  const addToPool = async (candidate: RediscoveryCandidate) => {
    if (!activePoolId) { setError("Create or select a talent pool before adding a candidate."); return; }
    setAddingCandidateId(candidate.candidateId); setNotice(""); setError("");
    try {
      const existed = members.some((item) => item.candidateId === candidate.candidateId);
      const member = await apiClient<TalentPoolMember>(`/api/recruiter/workflow/talent-pools/${activePoolId}/members`, {
        method: "PUT",
        body: JSON.stringify({
          candidateId: candidate.candidateId,
          tags: ["Rediscovered"], ownerRecruiterId: null, reminderAt: null,
          note: `Rediscovered from ${candidate.applicationCount} previous application${candidate.applicationCount === 1 ? "" : "s"}.`,
          nextAction: "Review for a current or upcoming role",
        }),
      });
      setMembers((current) => [member, ...current.filter((item) => item.candidateId !== member.candidateId)]);
      if (!existed) setPools((current) => current.map((pool) => pool.id === activePoolId ? { ...pool, candidateCount: pool.candidateCount + 1 } : pool));
      setNotice(`${candidate.fullName} added to ${selectedPool?.name ?? "the talent pool"}.`);
      void refreshAnalytics(); void loadRediscovery(query);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Candidate could not be added to the talent pool.");
    } finally {
      setAddingCandidateId("");
    }
  };

  const memberSaved = (updated: TalentPoolMember) => {
    setMembers((current) => current.map((item) => item.candidateId === updated.candidateId ? updated : item));
    setNotice(`${updated.fullName} CRM follow-up updated.`);
    void refreshAnalytics();
  };

  const memberRemoved = (candidateId: string) => {
    const removed = members.find((item) => item.candidateId === candidateId);
    setMembers((current) => current.filter((item) => item.candidateId !== candidateId));
    setPools((current) => current.map((pool) => pool.id === activePoolId ? { ...pool, candidateCount: Math.max(0, pool.candidateCount - 1) } : pool));
    setNotice(`${removed?.fullName ?? "Candidate"} removed from ${selectedPool?.name ?? "the talent pool"}.`);
    void refreshAnalytics(); void loadRediscovery(query);
  };

  return <WorkspaceShell workspace="recruiter" active="sourcing" title="Talent CRM" description="Rediscover proven candidates, maintain reusable talent pools, and return to saved sourcing searches without losing hiring context." actions={<><Button href="/recruiter/sourcing" variant="secondary">Search new talent</Button><Button href="/recruiter/communications">Outreach</Button></>}>
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
            <header className={styles.panelHeader}><div><span className="eyebrow">Rediscovery</span><h2>Search people you already know</h2><p>Previous applicants are ordered by hiring evidence and recency—not a fabricated AI fit score.</p></div><Badge tone="blue">{rediscovery?.metrics.pooledCandidates ?? 0} already pooled</Badge></header>
            <form className={styles.rediscoverySearch} onSubmit={(event) => { event.preventDefault(); void loadRediscovery(query); }}><label><span className="sr-only">Search previous candidates</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, title, company or skill" /></label><Button type="submit" disabled={searching}>{searching ? "Searching…" : "Search history"}</Button>{query && <Button variant="quiet" onClick={() => { setQuery(""); void loadRediscovery(""); }}>Clear</Button>}</form>
            <div className={styles.candidateTableWrap}><table className={styles.candidateTable}><thead><tr><th>Candidate</th><th>Prior hiring evidence</th><th>Professional context</th><th>Activity</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
              {rediscovery?.candidates.map((candidate) => <tr key={candidate.candidateId}>
                <td><div className={styles.person}><span>{initials(candidate.fullName)}</span><div><a href={`/recruiter/candidates/${candidate.candidateId}`}>{candidate.fullName}</a><small>{candidate.headline || candidate.currentCompany || "Profile headline not shared"}</small></div></div></td>
                <td><div className={styles.evidence}><strong>{stage(candidate.latestStage)}</strong><small>{candidate.latestJobTitle || "Previous role"}</small><div>{candidate.interviewedBefore && <Badge tone="blue">Interviewed</Badge>}{candidate.reachedFinalStage && <Badge tone="green">Final-stage history</Badge>}{candidate.applicationCount > 1 && <Badge>{candidate.applicationCount} applications</Badge>}</div></div></td>
                <td><strong>{candidate.experienceYears == null ? "Experience not shared" : `${candidate.experienceYears} yrs`}</strong><small>{candidate.location || "Location not shared"}{candidate.noticePeriodDays == null ? "" : ` · ${candidate.noticePeriodDays}d notice`}</small><div className={styles.skills}>{candidate.skills.slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}</div></td>
                <td><strong>{when(candidate.lastAppliedAt)}</strong><small>Last application</small><small>{candidate.poolCount ? `${candidate.poolCount} pool${candidate.poolCount === 1 ? "" : "s"}` : "Not in a pool"}</small></td>
                <td><Button variant="secondary" onClick={() => void addToPool(candidate)} disabled={addingCandidateId === candidate.candidateId || !activePoolId}>{addingCandidateId === candidate.candidateId ? "Adding…" : "Add to pool"}</Button></td>
              </tr>)}
              {!loading && !rediscovery?.candidates.length && <tr><td colSpan={5} className={styles.empty}>No previous candidates match this search.</td></tr>}
            </tbody></table></div>
          </section>

          <section className={styles.panel}>
            <header className={styles.panelHeader}><div><span className="eyebrow">Saved sourcing</span><h2>Reusable searches & alerts</h2><p>Return to proven sourcing criteria without reconstructing filters.</p></div><Button href="/recruiter/sourcing" variant="secondary">New search</Button></header>
            <div className={styles.savedSearches}>{savedSearches.slice(0, 8).map((record) => <article key={record.id}><div><strong>{record.name}</strong><small>Updated {when(record.updatedAt)}</small></div><span><Badge tone={record.alertFrequency === "OFF" ? "neutral" : "green"}>{record.alertFrequency === "OFF" ? "Alerts off" : `${record.alertFrequency.toLowerCase()} alerts`}</Badge><button type="button" onClick={() => runSavedSearch(record)}>Run</button><button type="button" onClick={() => void deleteSavedSearch(record)}>Delete</button></span></article>)}{!loading && !savedSearches.length && <p className={styles.empty}>No saved searches yet. Save a sourcing search to make it reusable here.</p>}</div>
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
            <div className={styles.members}>{members.slice(0, 10).map((member) => <MemberCard key={member.candidateId} member={member} poolId={activePoolId} organisationMembers={organisationMembers} onSaved={memberSaved} onRemoved={memberRemoved} />)}{!poolLoading && activePoolId && !members.length && <p className={styles.empty}>This pool is empty. Add a rediscovered or sourced candidate.</p>}{!activePoolId && <p className={styles.empty}>Select or create a talent pool to manage CRM follow-ups.</p>}</div>
          </section>
        </aside>
      </div>
    </div>
  </WorkspaceShell>;
}
