"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";
import { Badge, Button, WorkspaceShell } from "./ui";
import styles from "./recruitment-evolution.module.css";

type CollaborationAsset = {
  id: string;
  name: string;
  visibility: "PRIVATE" | "ORGANISATION";
  ownerName: string;
  ownerRecruiterId: string;
  editable: boolean;
  updatedAt: string | null;
  alertFrequency?: string;
  candidateCount?: number;
  description?: string | null;
};
type CollaborationData = { savedSearches: CollaborationAsset[]; talentPools: CollaborationAsset[] };

type RediscoveryCandidate = {
  candidateId: string;
  fullName: string;
  headline: string | null;
  location: string | null;
  currentCompany: string | null;
  experienceYears: number | null;
  noticePeriodDays: number | null;
  lastActiveAt: string | null;
  lastAppliedAt: string | null;
  applicationCount: number;
  interviewedBefore: boolean;
  reachedFinalStage: boolean;
  overlapSkills: string[];
  evidence: string[];
};
type RediscoveryData = { jobId: string; jobTitle: string; requiredSkills: string[]; candidates: RediscoveryCandidate[] };
type TalentPool = { id: string; name: string; candidateCount: number };

type HiringStage = { id?: string; order?: number; name: string; purpose: string | null; criteria: string[]; assignedRecruiterIds: string[] };
type HiringPlanData = {
  jobId: string;
  jobTitle: string;
  plan: null | {
    hiringReason: string | null;
    sixMonthSuccess: string | null;
    mustHaveSkills: string[];
    niceToHaveSkills: string[];
    decisionMakerIds: string[];
    targetSlaDays: number | null;
  };
  stages: HiringStage[];
};

type JourneyEvent = { type: string; label: string; at: string | null };
type JourneyInterview = { id: string; platformName: string; meetingLink: string; scheduledAt: string; durationMinutes: number; status: string };
type JourneyData = {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  currentStage: string;
  appliedAt: string;
  updatedAt: string;
  nextAction: string;
  timeline: JourneyEvent[];
  interviews: JourneyInterview[];
  offer: null | { status: string; designation: string; joiningDate: string | null; expiresAt: string | null; respondedAt: string | null };
};
type InterviewSlot = { id: string; startsAt: string; durationMinutes: number; timeZone: string; status: "AVAILABLE" | "BOOKED" };

function readable(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function titleCase(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function listFromText(value: string) {
  return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
}

export function RecruiterCollaboration() {
  const [data, setData] = useState<CollaborationData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState("");

  const load = useCallback(async () => {
    setError("");
    try { setData(await apiClient<CollaborationData>("/api/recruiter/evolution/collaboration")); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Team collaboration could not be loaded."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const setVisibility = async (kind: "saved-searches" | "talent-pools", asset: CollaborationAsset, visibility: "PRIVATE" | "ORGANISATION") => {
    setSaving(asset.id); setNotice(""); setError("");
    try {
      await apiClient(`/api/recruiter/evolution/${kind}/${asset.id}/visibility`, { method: "PATCH", body: JSON.stringify({ visibility }) });
      setNotice(`${asset.name} is now ${visibility === "PRIVATE" ? "private" : "shared with your organisation"}.`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Visibility could not be updated."); }
    finally { setSaving(""); }
  };

  const section = (title: string, description: string, kind: "saved-searches" | "talent-pools", assets: CollaborationAsset[]) => (
    <section className={styles.panel}>
      <header><div><span className="eyebrow">v4.1 Collaboration</span><h2>{title}</h2><p>{description}</p></div><Badge tone="blue">{assets.length}</Badge></header>
      <div className={styles.assetList}>
        {assets.map((asset) => <article key={asset.id}>
          <div className={styles.assetMain}><strong>{asset.name}</strong><p>{asset.description || `Owned by ${asset.ownerName}`}</p><div className={styles.meta}><span>Owner · {asset.ownerName}</span><span>Updated · {readable(asset.updatedAt)}</span>{asset.alertFrequency && <span>Alerts · {titleCase(asset.alertFrequency)}</span>}{typeof asset.candidateCount === "number" && <span>{asset.candidateCount} candidates</span>}</div></div>
          <div className={styles.assetActions}><Badge tone={asset.visibility === "ORGANISATION" ? "green" : "neutral"}>{asset.visibility === "ORGANISATION" ? "Organisation" : "Private"}</Badge>{asset.editable ? <select aria-label={`Visibility for ${asset.name}`} disabled={saving === asset.id} value={asset.visibility} onChange={(event) => void setVisibility(kind, asset, event.target.value as "PRIVATE" | "ORGANISATION")}><option value="PRIVATE">Private</option><option value="ORGANISATION">Organisation</option></select> : <small>Owner controls sharing</small>}</div>
        </article>)}
        {!assets.length && <p className={styles.empty}>Nothing has been created here yet.</p>}
      </div>
    </section>
  );

  return <WorkspaceShell workspace="recruiter" active="sourcing" title="Team collaboration" description="Share sourcing knowledge intentionally while keeping ownership and destructive actions explicit." actions={<Button href="/recruiter/talent-crm">Talent CRM</Button>}>
    <div className={styles.stack}>{error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.notice}>{notice}</p>}{section("Shared searches", "Recruiter-owned searches can stay private or become reusable across the organisation.", "saved-searches", data?.savedSearches ?? [])}{section("Shared talent pools", "Pools carry an owner and a clear visibility boundary so teams can collaborate without losing accountability.", "talent-pools", data?.talentPools ?? [])}</div>
  </WorkspaceShell>;
}

export function RecruiterJobRediscovery({ jobId }: { jobId: string }) {
  const [data, setData] = useState<RediscoveryData | null>(null);
  const [pools, setPools] = useState<TalentPool[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [poolId, setPoolId] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (search = "") => {
    setBusy(true); setError("");
    try {
      const [rediscovery, talentPools] = await Promise.all([
        apiClient<RediscoveryData>(`/api/recruiter/evolution/rediscovery?jobId=${encodeURIComponent(jobId)}&query=${encodeURIComponent(search)}&limit=100`),
        apiClient<TalentPool[]>("/api/recruiter/workflow/talent-pools"),
      ]);
      setData(rediscovery); setPools(talentPools); setPoolId((current) => current || talentPools[0]?.id || "");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Job rediscovery could not be loaded."); }
    finally { setBusy(false); }
  }, [jobId]);
  useEffect(() => { void load(); }, [load]);

  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const bulkAdd = async () => {
    if (!poolId || !selected.length) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await apiClient<{ requested: number; addedOrUpdated: number }>("/api/recruiter/evolution/bulk/talent-pool", { method: "POST", body: JSON.stringify({ poolId, candidateIds: selected, ownerRecruiterId: null, reminderAt: null, nextAction: `Review for ${data?.jobTitle ?? jobId}` }) });
      setNotice(`${result.addedOrUpdated} candidate${result.addedOrUpdated === 1 ? "" : "s"} added or updated in the selected pool.`); setSelected([]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Bulk action could not be completed."); }
    finally { setBusy(false); }
  };

  const allSelected = !!data?.candidates.length && data.candidates.every((candidate) => selected.includes(candidate.candidateId));
  return <WorkspaceShell workspace="recruiter" active="sourcing" title={data ? `Rediscover for ${data.jobTitle}` : "Job-aware rediscovery"} description="Search your organisation's prior candidate relationships before sourcing net-new talent. Results use factual skill overlap and hiring history—not an AI score." actions={<><Button href={`/recruiter/jobs/${jobId}/hiring-plan`} variant="secondary">Hiring plan</Button><Button href="/recruiter/talent-crm">Talent CRM</Button></>}>
    <div className={styles.stack}>{error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
      <section className={styles.panel}><header><div><span className="eyebrow">v4.2 Rediscovery</span><h2>Evidence before outreach</h2><p>{data?.requiredSkills.length ? `Role skills: ${data.requiredSkills.join(" · ")}` : "This job has no structured skills yet; historical hiring evidence still applies."}</p></div></header>
        <form className={styles.toolbar} onSubmit={(event) => { event.preventDefault(); void load(query); }}><input aria-label="Filter rediscovered candidates" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, company, headline or skill" /><Button type="submit" disabled={busy}>{busy ? "Searching…" : "Search"}</Button></form>
        <div className={styles.bulkbar}><label><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : (data?.candidates.map((candidate) => candidate.candidateId) ?? []))} /> Select all</label><span>{selected.length} selected</span><select aria-label="Destination talent pool" value={poolId} onChange={(event) => setPoolId(event.target.value)}><option value="">Choose pool</option>{pools.map((pool) => <option key={pool.id} value={pool.id}>{pool.name} · {pool.candidateCount}</option>)}</select><Button disabled={!selected.length || !poolId || busy} onClick={() => void bulkAdd()}>Add selected to pool</Button></div>
        <div className={styles.tableWrap}><table><thead><tr><th><span className="sr-only">Select</span></th><th>Candidate</th><th>Why surfaced</th><th>History</th><th>Availability</th></tr></thead><tbody>{data?.candidates.map((candidate) => <tr key={candidate.candidateId}><td><input aria-label={`Select ${candidate.fullName}`} type="checkbox" checked={selected.includes(candidate.candidateId)} onChange={() => toggle(candidate.candidateId)} /></td><td><a href={`/recruiter/candidates/${candidate.candidateId}`}><strong>{candidate.fullName}</strong></a><small>{candidate.headline || candidate.currentCompany || "Professional profile"}</small><small>{candidate.location || "Location not shared"}</small></td><td><div className={styles.chips}>{candidate.overlapSkills.map((skill) => <span key={skill}>{skill}</span>)}</div>{candidate.evidence.map((item) => <small key={item}>{item}</small>)}</td><td><strong>{candidate.applicationCount} prior application{candidate.applicationCount === 1 ? "" : "s"}</strong><small>{candidate.reachedFinalStage ? "Reached final stage" : candidate.interviewedBefore ? "Previously interviewed" : "Application history"}</small><small>Last applied · {readable(candidate.lastAppliedAt)}</small></td><td><strong>{candidate.experienceYears == null ? "Experience not shared" : `${candidate.experienceYears} yrs`}</strong><small>{candidate.noticePeriodDays == null ? "Notice not shared" : `${candidate.noticePeriodDays}d notice`}</small><small>Active · {readable(candidate.lastActiveAt)}</small></td></tr>)}{!busy && !data?.candidates.length && <tr><td colSpan={5} className={styles.empty}>No historical candidates match this job and search.</td></tr>}</tbody></table></div>
      </section>
    </div>
  </WorkspaceShell>;
}

export function RecruiterHiringPlan({ jobId }: { jobId: string }) {
  const [data, setData] = useState<HiringPlanData | null>(null);
  const [reason, setReason] = useState(""); const [success, setSuccess] = useState(""); const [must, setMust] = useState(""); const [nice, setNice] = useState(""); const [sla, setSla] = useState("30");
  const [stages, setStages] = useState<HiringStage[]>([]);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try {
      const result = await apiClient<HiringPlanData>(`/api/recruiter/evolution/jobs/${jobId}/hiring-plan`); setData(result);
      setReason(result.plan?.hiringReason ?? ""); setSuccess(result.plan?.sixMonthSuccess ?? ""); setMust((result.plan?.mustHaveSkills ?? []).join(", ")); setNice((result.plan?.niceToHaveSkills ?? []).join(", ")); setSla(String(result.plan?.targetSlaDays ?? 30));
      setStages(result.stages.length ? result.stages.map((stage) => ({ ...stage })) : [{ name: "Recruiter screen", purpose: "Validate role fundamentals and candidate motivation", criteria: ["Role fundamentals", "Motivation"], assignedRecruiterIds: [] }, { name: "Structured interview", purpose: "Collect evidence against role-specific competencies", criteria: ["Technical or functional capability", "Problem solving", "Communication"], assignedRecruiterIds: [] }, { name: "Final decision", purpose: "Resolve remaining evidence and make the hiring decision", criteria: ["Role fit", "Evidence quality"], assignedRecruiterIds: [] }]);
    } catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : "Hiring plan could not be loaded."); }
  }, [jobId]);
  useEffect(() => { void load(); }, [load]);
  const updateStage = (index: number, patch: Partial<HiringStage>) => setStages((current) => current.map((stage, stageIndex) => stageIndex === index ? { ...stage, ...patch } : stage));
  const save = async () => {
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await apiClient<HiringPlanData>(`/api/recruiter/evolution/jobs/${jobId}/hiring-plan`, { method: "PUT", body: JSON.stringify({ hiringReason: reason, sixMonthSuccess: success, mustHaveSkills: listFromText(must), niceToHaveSkills: listFromText(nice), decisionMakerIds: data?.plan?.decisionMakerIds ?? [], targetSlaDays: Number(sla) || null, stages: stages.map((stage) => ({ name: stage.name, purpose: stage.purpose, criteria: stage.criteria, assignedRecruiterIds: stage.assignedRecruiterIds })) }) });
      setData(result); setNotice("Hiring plan saved. Interviewers now have one structured definition of success.");
    } catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : "Hiring plan could not be saved."); }
    finally { setSaving(false); }
  };
  return <WorkspaceShell workspace="recruiter" active="jobs" title={data ? `${data.jobTitle} · Hiring plan` : "Structured hiring plan"} description="Define success before interviews begin. Keep criteria job-related, observable and evidence-based." actions={<><Button href={`/recruiter/jobs/${jobId}/rediscovery`} variant="secondary">Rediscover talent</Button><Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save plan"}</Button></>}>
    <div className={styles.stack}>{error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
      <section className={styles.formGrid}><label><span>Why are we hiring?</span><textarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Business problem, replacement or growth context" /></label><label><span>What should success look like in six months?</span><textarea rows={4} value={success} onChange={(event) => setSuccess(event.target.value)} placeholder="Observable outcomes, not personality traits" /></label><label><span>Must-have capabilities</span><textarea rows={3} value={must} onChange={(event) => setMust(event.target.value)} placeholder="Java, Spring, distributed systems" /></label><label><span>Nice-to-have capabilities</span><textarea rows={3} value={nice} onChange={(event) => setNice(event.target.value)} placeholder="AWS, Kafka" /></label><label><span>Target hiring SLA (days)</span><input inputMode="numeric" value={sla} onChange={(event) => setSla(event.target.value)} /></label></section>
      <section className={styles.panel}><header><div><span className="eyebrow">v5 Structured Hiring</span><h2>Interview stages & evidence criteria</h2><p>Each stage has a purpose and predefined criteria. Scorecard evidence should answer these questions rather than introduce new criteria after the interview.</p></div><Button variant="secondary" onClick={() => setStages((current) => [...current, { name: "", purpose: "", criteria: [], assignedRecruiterIds: [] }])}>Add stage</Button></header><div className={styles.stageList}>{stages.map((stage, index) => <article key={`${index}-${stage.id ?? "new"}`}><div className={styles.stageNumber}>{index + 1}</div><div className={styles.stageFields}><label><span>Stage name</span><input value={stage.name} onChange={(event) => updateStage(index, { name: event.target.value })} /></label><label><span>Purpose</span><textarea rows={2} value={stage.purpose ?? ""} onChange={(event) => updateStage(index, { purpose: event.target.value })} /></label><label><span>Scorecard criteria</span><textarea rows={2} value={stage.criteria.join(", ")} onChange={(event) => updateStage(index, { criteria: listFromText(event.target.value) })} /></label></div><Button variant="quiet" onClick={() => setStages((current) => current.filter((_, stageIndex) => stageIndex !== index))}>Remove</Button></article>)}</div></section>
    </div>
  </WorkspaceShell>;
}

export function CandidateApplicationJourney({ applicationId }: { applicationId: string }) {
  const [journey, setJourney] = useState<JourneyData | null>(null); const [slots, setSlots] = useState<InterviewSlot[]>([]); const [rating, setRating] = useState(0); const [feedback, setFeedback] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setError(""); try { const [journeyData, slotData] = await Promise.all([apiClient<JourneyData>(`/api/candidate/evolution/applications/${applicationId}/journey`), apiClient<InterviewSlot[]>(`/api/candidate/evolution/applications/${applicationId}/interview-slots`)]); setJourney(journeyData); setSlots(slotData); } catch (reason) { setError(reason instanceof Error ? reason.message : "Application journey could not be loaded."); }
  }, [applicationId]);
  useEffect(() => { void load(); }, [load]);
  const book = async (slotId: string) => { setBusy(true); setError(""); setNotice(""); try { await apiClient(`/api/candidate/evolution/applications/${applicationId}/interview-slots/${slotId}/book`, { method: "POST" }); setNotice("Interview time confirmed. Your interview workspace has been updated."); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Interview slot could not be booked."); } finally { setBusy(false); } };
  const survey = async () => { if (!rating) return; setBusy(true); setError(""); setNotice(""); try { await apiClient(`/api/candidate/evolution/applications/${applicationId}/experience-survey`, { method: "PUT", body: JSON.stringify({ rating, feedback }) }); setNotice("Thank you. Your candidate-experience feedback has been recorded."); } catch (reason) { setError(reason instanceof Error ? reason.message : "Feedback could not be submitted."); } finally { setBusy(false); } };
  const available = slots.filter((slot) => slot.status === "AVAILABLE");
  return <WorkspaceShell workspace="candidate" active="applications" title={journey?.jobTitle ?? "Application journey"} description="A transparent record of what has happened, what needs your attention and what comes next." actions={<Button href="/candidate/applications" variant="secondary">All applications</Button>}>
    <div className={styles.stack}>{error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
      {journey && <><section className={styles.journeyHero}><div><span className="eyebrow">Current application</span><h2>{titleCase(journey.currentStage)}</h2><p>{journey.nextAction}</p></div><div><small>Applied</small><strong>{readable(journey.appliedAt)}</strong><small>Last updated</small><strong>{readable(journey.updatedAt)}</strong></div></section>
      <div className={styles.twoCol}><main className={styles.stack}><section className={styles.panel}><header><div><span className="eyebrow">v6 Transparency</span><h2>Your hiring timeline</h2><p>Only candidate-safe milestones are shown. Internal recruiter notes and private evaluation content stay private.</p></div></header><ol className={styles.timeline}>{journey.timeline.map((event, index) => <li key={`${event.type}-${index}`}><span aria-hidden="true" /><div><strong>{event.label}</strong><small>{readable(event.at)}</small></div></li>)}</ol></section>
      <section className={styles.panel}><header><div><h2>Interviews</h2><p>Confirmed interviews use meeting links supplied by the recruiter. SapienWorx does not connect to an external meeting provider.</p></div></header><div className={styles.interviews}>{journey.interviews.map((interview) => <article key={interview.id}><div><strong>{readable(interview.scheduledAt)}</strong><small>{interview.durationMinutes} min · {interview.platformName}</small></div><Badge tone={interview.status === "CANCELLED" ? "rose" : "green"}>{titleCase(interview.status)}</Badge>{interview.status !== "CANCELLED" && <a className="button button-secondary" href={interview.meetingLink} target="_blank" rel="noreferrer">Join externally</a>}</article>)}{!journey.interviews.length && <p className={styles.empty}>No interview has been confirmed yet.</p>}</div></section></main>
      <aside className={styles.stack}>{available.length > 0 && <section className={styles.panel}><header><div><span className="eyebrow">Choose a time</span><h2>Interview availability</h2><p>Select one recruiter-provided slot. The meeting URL stays hidden until the interview is confirmed.</p></div></header><div className={styles.slotList}>{available.map((slot) => <article key={slot.id}><div><strong>{readable(slot.startsAt)}</strong><small>{slot.durationMinutes} min · {slot.timeZone}</small></div><Button disabled={busy} onClick={() => void book(slot.id)}>Choose</Button></article>)}</div></section>}
      {journey.offer && <section className={styles.panel}><header><div><span className="eyebrow">Offer</span><h2>{journey.offer.designation}</h2></div><Badge tone={journey.offer.status === "ACCEPTED" ? "green" : "amber"}>{titleCase(journey.offer.status)}</Badge></header><div className={styles.offer}><p>Joining date <strong>{journey.offer.joiningDate ?? "To be confirmed"}</strong></p><p>Response deadline <strong>{readable(journey.offer.expiresAt)}</strong></p></div></section>}
      <section className={styles.panel}><header><div><span className="eyebrow">Candidate experience</span><h2>How was this process?</h2><p>Your feedback is stored against this application and can be updated later.</p></div></header><div className={styles.survey}><div className={styles.rating} role="group" aria-label="Experience rating">{[1,2,3,4,5].map((value) => <button key={value} type="button" aria-pressed={rating === value} onClick={() => setRating(value)}>{value}</button>)}</div><textarea rows={4} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="What worked well or could be improved?" maxLength={2000}/><Button disabled={!rating || busy} onClick={() => void survey()}>Submit feedback</Button></div></section></aside></div></>}
    </div>
  </WorkspaceShell>;
}
