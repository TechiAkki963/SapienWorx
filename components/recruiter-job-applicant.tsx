"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiBaseUrl, apiClient } from "../lib/api-client";
import { Badge, Button, WorkspaceShell } from "./ui";

type ApplicantNote = { text: string; author: string; updatedAt: string | null };
type OrganisationMember = { recruiterId: string; fullName: string; designation: string | null };
type TimelineEvent = { type: string; summary: string; actorType: string; occurredAt: string | null };
type DecisionReadiness = { requiredApprovals: number; expectedReviewers: number; submittedScorecards: number; positiveApprovals: number; averageScore: number | null; missingReviewerNames: string[]; conflictingRecommendations: boolean; offerReady: boolean; blockers: string[] };
type Scorecard = { id: string; recruiterId?: string; recruiterName: string; recommendation: string; score: number; criteriaScores?: Record<string, number>; feedback: string; submittedAt: string | null };
type ApplicantInterview = {
  interviewId: string; platformName: string; meetingLink: string; scheduledAt: string; durationMinutes: number;
  timeZone: string; agenda: string | null; status: string; interviewOwnerId: string; interviewOwnerName: string;
  panelRecruiterIds: string[]; panelRecruiterNames: string[]; currentUserCanScore: boolean; scorecards: Scorecard[];
};
type ApplicantDetail = {
  applicationId: string; candidateId: string; jobId: string; jobTitle: string; fullName: string; headline: string | null;
  currentCompany: string | null; previousRole: string | null; previousCompany: string | null; departmentRole: string | null;
  industry: string | null; highestEducation: string; location: string | null; preferredLocations: string[];
  overallExperienceYears: number | null; expectedSalaryLakhs: number | null; noticePeriodDays: number | null;
  skills: string[]; workLinks: string[]; profileSummary: string | null; emailVerified: boolean; mobileVerified: boolean;
  cvAvailable: boolean; maskedEmail: string; maskedMobile: string; pipelineStage: string; applicationSource: string;
  referralCode: string | null; appliedAt: string | null; applicationUpdatedAt: string | null; lastActiveAt: string | null;
  profileLastUpdatedAt: string | null; postingRecruiterId: string; postingRecruiterName: string; assignedRecruiterId: string;
  assignedRecruiterName: string; currentUserCanManage: boolean; organisationMembers: OrganisationMember[];
  decisionReadiness: DecisionReadiness; recentNotes: ApplicantNote[]; timeline: TimelineEvent[]; interviews: ApplicantInterview[];
};
type PipelineUpdate = { pipelineStage: string; recentNotes: string[] };
type ContactResponse = { value: string };
type OfferStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "WITHDRAWN";
type OfferApproval = { approvalId: string; recruiterId: string; recruiterName: string; decision: "PENDING" | "APPROVED" | "REJECTED"; comments: string | null; decidedAt: string | null };
type OfferDetails = {
  offerId: string; applicationId: string; jobId: string; jobTitle: string; candidateName: string; status: OfferStatus; version: number;
  designation: string; joiningDate: string; workplaceModel: "ON_SITE" | "HYBRID" | "REMOTE"; probationMonths: number; noticeBuyout: boolean;
  expiresAt: string; currency: string; annualFixedAmount: number; annualVariableAmount: number; joiningBonus: number; retentionBonus: number;
  otherCompensation: string; candidateMessage: string; termsText: string; sentAt: string | null; respondedAt: string | null; responseNote: string | null;
  editable: boolean; submittable: boolean; sendable: boolean; withdrawable: boolean; approvable: boolean; approvals: OfferApproval[];
  versions: Array<{ version: number; designation: string; currency: string; totalCompensation: number; createdBy: string; createdAt: string | null }>;
};
type OfferWorkspace = { currentRecruiterId: string; entitlement: { planName: string; maximumApprovers: number; advancedApprovals: boolean; customBranding: boolean; auditExport: boolean }; offer: OfferDetails | null };
type OfferDraft = {
  designation: string; joiningDate: string; workplaceModel: "ON_SITE" | "HYBRID" | "REMOTE"; probationMonths: string; noticeBuyout: boolean;
  expiresAt: string; currency: string; annualFixedAmount: string; annualVariableAmount: string; joiningBonus: string; retentionBonus: string;
  otherCompensation: string; candidateMessage: string; termsText: string; approverRecruiterIds: string[];
};

const pipelineStages = ["APPLIED", "SCREENING", "INTERVIEWING", "FINAL_STAGE", "OFFER", "ONBOARDED", "REJECTED"];
const scoreCriteria = [
  ["technical", "Role expertise"],
  ["problemSolving", "Problem solving"],
  ["communication", "Communication"],
  ["roleFit", "Role alignment"],
] as const;

function applicantInitials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "CA"; }
function readable(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
function formattedDate(value: string | null, includeTime = false) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", includeTime ? { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" } : { day: "numeric", month: "short", year: "numeric" }).format(date);
}
function safeExternalUrl(value: string) { try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null; } catch { return null; } }
function stageTone(stage: string): "amber" | "green" | "blue" | "neutral" { return stage === "ONBOARDED" || stage === "OFFER" ? "green" : stage === "INTERVIEWING" || stage === "FINAL_STAGE" ? "blue" : stage === "REJECTED" ? "neutral" : "amber"; }

export function RecruiterJobApplicant({ jobId, applicationId }: { jobId: string; applicationId: string }) {
  const [profile, setProfile] = useState<ApplicantDetail | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [stagePending, setStagePending] = useState(false);
  const [ownerPending, setOwnerPending] = useState(false);
  const [policyPending, setPolicyPending] = useState(false);
  const [contactPending, setContactPending] = useState<"EMAIL" | "MOBILE" | "">("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [emailRevealed, setEmailRevealed] = useState(false);
  const [mobileRevealed, setMobileRevealed] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [notePending, setNotePending] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulePending, setSchedulePending] = useState(false);
  const [interviewAt, setInterviewAt] = useState("");
  const [platformName, setPlatformName] = useState("Google Meet");
  const [meetingLink, setMeetingLink] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("45");
  const [agenda, setAgenda] = useState("");
  const [panelRecruiterIds, setPanelRecruiterIds] = useState<string[]>([]);
  const [scorecardInterviewId, setScorecardInterviewId] = useState("");
  const [recommendation, setRecommendation] = useState("YES");
  const [scoreFeedback, setScoreFeedback] = useState("");
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>({ technical: 4, problemSolving: 4, communication: 4, roleFit: 4 });
  const [scorePending, setScorePending] = useState(false);

  const loadProfile = useCallback(async () => {
    const response = await apiClient<ApplicantDetail>(`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(applicationId)}`);
    setProfile(response);
    setEmail((current) => emailRevealed ? current : response.maskedEmail);
    setMobile((current) => mobileRevealed ? current : response.maskedMobile);
    return response;
  }, [applicationId, emailRevealed, jobId, mobileRevealed]);

  useEffect(() => {
    let active = true;
    void loadProfile().catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "This application could not be loaded."); });
    const defaultInterview = new Date(Date.now() + 86_400_000); defaultInterview.setMinutes(0, 0, 0);
    setInterviewAt(defaultInterview.toISOString().slice(0, 16));
    return () => { active = false; };
  }, [loadProfile]);

  const overallScore = useMemo(() => Math.round(Object.values(criteriaScores).reduce((sum, score) => sum + score, 0) / scoreCriteria.length), [criteriaScores]);

  const updateStage = async (stage: string) => {
    if (!profile?.currentUserCanManage) return;
    setStagePending(true); setActionError(""); setNotice("Updating the application stage…");
    try {
      const response = await apiClient<PipelineUpdate>(`/api/recruiter/pipeline/${profile.applicationId}/stage`, { method: "PATCH", body: JSON.stringify({ stage }) });
      setProfile((current) => current ? { ...current, pipelineStage: response.pipelineStage, timeline: [{ type: "PIPELINE_STAGE_CHANGED", summary: `Application moved to ${readable(response.pipelineStage)}.`, actorType: "RECRUITER", occurredAt: new Date().toISOString() }, ...current.timeline] } : current);
      setNotice(`${profile.fullName} moved to ${readable(response.pipelineStage)}.`);
    } catch (reason) { setNotice(""); setActionError(reason instanceof Error ? reason.message : "The application stage could not be updated."); }
    finally { setStagePending(false); }
  };

  const assignOwner = async (recruiterId: string) => {
    if (!profile?.currentUserCanManage) return;
    setOwnerPending(true); setActionError("");
    try {
      const response = await apiClient<ApplicantDetail>(`/api/recruiter/jobs/${encodeURIComponent(profile.jobId)}/applications/${profile.applicationId}/assignment`, { method: "PATCH", body: JSON.stringify({ recruiterId }) });
      setProfile(response); setNotice(`Application ownership assigned to ${response.assignedRecruiterName}.`);
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "Application ownership could not be updated."); }
    finally { setOwnerPending(false); }
  };

  const updateDecisionPolicy = async (requiredApprovals: number) => {
    if (!profile?.currentUserCanManage) return;
    setPolicyPending(true); setActionError("");
    try {
      const response = await apiClient<ApplicantDetail>(`/api/recruiter/jobs/${encodeURIComponent(profile.jobId)}/applications/${profile.applicationId}/decision-policy`, { method: "PATCH", body: JSON.stringify({ requiredApprovals }) });
      setProfile(response); setNotice(`Offer policy updated to ${requiredApprovals} required approval${requiredApprovals === 1 ? "" : "s"}.`);
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "The offer approval policy could not be updated."); }
    finally { setPolicyPending(false); }
  };

  const revealContact = async (channel: "EMAIL" | "MOBILE") => {
    if (!profile?.currentUserCanManage) return;
    setContactPending(channel); setActionError("");
    try {
      const response = await apiClient<ContactResponse>(`/api/recruiter/candidates/${profile.candidateId}/contact?channel=${channel}&jobId=${encodeURIComponent(profile.jobId)}`);
      if (channel === "EMAIL") { setEmail(response.value); setEmailRevealed(true); } else { setMobile(response.value); setMobileRevealed(true); }
      setNotice(`${channel === "EMAIL" ? "Email" : "Phone number"} access recorded against ${profile.jobId}.`);
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "The contact detail could not be revealed."); }
    finally { setContactPending(""); }
  };

  const copyOrRevealContact = async (channel: "EMAIL" | "MOBILE") => {
    const revealed = channel === "EMAIL" ? emailRevealed : mobileRevealed;
    const value = channel === "EMAIL" ? email : mobile;
    if (!revealed) { await revealContact(channel); return; }
    try { await navigator.clipboard.writeText(value); setNotice(`${channel === "EMAIL" ? "Email" : "Phone number"} copied.`); }
    catch { setActionError("Copy is unavailable in this browser. Select the contact detail manually."); }
  };

  const addNote = async () => {
    if (!profile?.currentUserCanManage || !noteDraft.trim()) return;
    setNotePending(true); setActionError(""); const text = noteDraft.trim();
    try {
      await apiClient<PipelineUpdate>(`/api/recruiter/pipeline/${profile.applicationId}/notes`, { method: "POST", body: JSON.stringify({ note: text }) });
      setProfile((current) => current ? { ...current, recentNotes: [{ text, author: "You", updatedAt: new Date().toISOString() }, ...current.recentNotes].slice(0, 10), timeline: [{ type: "RECRUITER_NOTE_ADDED", summary: "You added a recruiter note.", actorType: "RECRUITER", occurredAt: new Date().toISOString() }, ...current.timeline] } : current);
      setNoteDraft(""); setNotice("Recruiter note saved.");
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "The recruiter note could not be saved."); }
    finally { setNotePending(false); }
  };

  const scheduleInterview = async () => {
    if (!profile?.currentUserCanManage || !interviewAt || !meetingLink.trim()) return;
    setSchedulePending(true); setActionError("");
    try {
      await apiClient("/api/recruiter/interviews", { method: "POST", body: JSON.stringify({ applicationId: profile.applicationId, platformName, meetingLink: meetingLink.trim(), scheduledAt: new Date(interviewAt).toISOString(), durationMinutes: Number(durationMinutes), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", agenda: agenda.trim() || null, panelRecruiterIds }) });
      await loadProfile(); setScheduleOpen(false); setMeetingLink(""); setAgenda(""); setPanelRecruiterIds([]);
      setNotice(`Interview scheduled for ${formattedDate(new Date(interviewAt).toISOString(), true)}.`);
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "The interview could not be scheduled."); }
    finally { setSchedulePending(false); }
  };

  const submitScorecard = async () => {
    if (!scorecardInterviewId || !scoreFeedback.trim()) return;
    setScorePending(true); setActionError("");
    try {
      await apiClient("/api/recruiter/workflow/interview-scorecards", { method: "POST", body: JSON.stringify({ interviewId: scorecardInterviewId, recommendation, score: overallScore, criteriaScores, feedback: scoreFeedback.trim() }) });
      await loadProfile(); setScorecardInterviewId(""); setScoreFeedback(""); setNotice("Structured interview scorecard saved.");
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "The interview scorecard could not be saved."); }
    finally { setScorePending(false); }
  };

  return <WorkspaceShell workspace="recruiter" active="my-jobs" title="Applicant workspace" description="Review profile evidence and progress this application with a complete audit trail.">
    <a className="job-detail-back" href={`/recruiter/jobs/${encodeURIComponent(jobId)}`}>‹ Back to job applicants</a>
    {!profile && !error && <section className="panel applicant-workspace-loading" aria-live="polite">Loading the applicant workspace…</section>}
    {error && <section className="panel job-detail-empty"><div className="job-publish-error" role="alert">{error}</div><p>This application may belong to a different job or recruiter.</p><Button href={`/recruiter/jobs/${encodeURIComponent(jobId)}`} variant="secondary">Back to job</Button></section>}
    {profile && <>
      {notice && <div className="creation-success" role="status">{notice}</div>}
      {actionError && <div className="job-publish-error" role="alert">{actionError}</div>}
      <section className="panel applicant-workspace-hero">
        <div className="applicant-workspace-identity"><span>{applicantInitials(profile.fullName)}</span><div><small>{profile.jobTitle} · {profile.jobId}</small><h1>{profile.fullName}</h1><p>{profile.headline || "Professional profile"}{profile.currentCompany ? ` at ${profile.currentCompany}` : ""}</p><div><Badge tone={stageTone(profile.pipelineStage)}>{readable(profile.pipelineStage)}</Badge><em>Applied {formattedDate(profile.appliedAt)}</em><em>{readable(profile.applicationSource)}</em></div></div></div>
        <div className="applicant-workspace-controls"><label>Application owner<select aria-label="Application owner" value={profile.assignedRecruiterId} disabled={!profile.currentUserCanManage || ownerPending} onChange={(event) => void assignOwner(event.target.value)}>{profile.organisationMembers.map((member) => <option value={member.recruiterId} key={member.recruiterId}>{member.fullName}</option>)}</select></label><label>Pipeline stage<select aria-label="Pipeline stage" value={profile.pipelineStage} disabled={!profile.currentUserCanManage || stagePending} onChange={(event) => void updateStage(event.target.value)}>{pipelineStages.map((stage) => <option value={stage} key={stage} disabled={stage === "OFFER" && !profile.decisionReadiness.offerReady}>{readable(stage)}{stage === "OFFER" && !profile.decisionReadiness.offerReady ? " · blocked" : ""}</option>)}</select></label><small>{profile.currentUserCanManage ? "Ownership and stage changes are recorded in the activity timeline." : "Panel review access · management controls are read-only."}</small></div>
      </section>
      <section className="applicant-workspace-grid"><main className="stack">
        <CareerEvidence profile={profile}/>
        <article className="panel applicant-evidence-card"><span className="eyebrow">Candidate narrative</span><h2>Skills and profile summary</h2><p>{profile.profileSummary || "The candidate has not added a profile summary yet."}</p><div className="candidate-detail-skills">{profile.skills.length ? profile.skills.map((skill) => <span key={skill}>{skill}</span>) : <span>Skills pending</span>}</div><footer><span>{profile.cvAvailable ? "✓ CV attached" : "CV not attached"}</span><span>Profile updated {formattedDate(profile.profileLastUpdatedAt)}</span><span>Last active {formattedDate(profile.lastActiveAt)}</span></footer>{profile.workLinks.map((value) => safeExternalUrl(value)).filter((value): value is string => Boolean(value)).length > 0 && <div className="applicant-work-links"><strong>Work links</strong>{profile.workLinks.map((value) => safeExternalUrl(value)).filter((value): value is string => Boolean(value)).map((value) => <a href={value} target="_blank" rel="noopener noreferrer" key={value}>{new URL(value).hostname} ↗</a>)}</div>}</article>
        <article className="panel applicant-notes"><header><div><span className="eyebrow">Team context</span><h2>Recruiter notes</h2></div><small>Visible to authorised recruiters only</small></header>{profile.currentUserCanManage && <><label><span>Add a screening note</span><textarea aria-label="Add a screening note" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} maxLength={5000} rows={4} placeholder="Capture evidence, questions, or the agreed next step."/></label><Button disabled={notePending || !noteDraft.trim()} onClick={() => void addNote()}>{notePending ? "Saving…" : "Save note"}</Button></>}<div className="applicant-note-list">{profile.recentNotes.length ? profile.recentNotes.map((note, index) => <article key={`${note.updatedAt}-${index}`}><p>{note.text}</p><small>{note.author} · {formattedDate(note.updatedAt, true)}</small></article>) : <p>No recruiter notes yet.</p>}</div></article>
        <article className="panel applicant-timeline"><header><div><span className="eyebrow">Audit-ready history</span><h2>Application activity</h2></div><small>{profile.timeline.length} recorded event{profile.timeline.length === 1 ? "" : "s"}</small></header><ol>{profile.timeline.length ? profile.timeline.map((event, index) => <li key={`${event.occurredAt}-${index}`}><span aria-hidden="true"/><div><strong>{readable(event.type)}</strong><p>{event.summary}</p><small>{readable(event.actorType)} · {formattedDate(event.occurredAt, true)}</small></div></li>) : <li><span aria-hidden="true"/><div><strong>Application received</strong><p>Activity will appear here as the hiring team progresses this candidate.</p><small>{formattedDate(profile.appliedAt, true)}</small></div></li>}</ol></article>
      </main><aside className="stack">
        <DecisionReadinessCard readiness={profile.decisionReadiness} canManage={profile.currentUserCanManage} pending={policyPending} onPolicyChange={updateDecisionPolicy}/>
        <OfferManagement profile={profile}/>
        <ContactCard profile={profile} email={email} mobile={mobile} pending={contactPending} emailRevealed={emailRevealed} mobileRevealed={mobileRevealed} onContact={copyOrRevealContact}/>
        <section className="panel applicant-interviews"><header><div><span className="eyebrow">Interview plan</span><h2>Interviews</h2></div>{profile.currentUserCanManage && <button onClick={() => setScheduleOpen((value) => !value)}>{scheduleOpen ? "Cancel" : "+ Schedule"}</button>}</header>
          {scheduleOpen && <form onSubmit={(event) => { event.preventDefault(); void scheduleInterview(); }}><label>Date and time<input aria-label="Interview date and time" type="datetime-local" required value={interviewAt} onChange={(event) => setInterviewAt(event.target.value)}/></label><label>Platform<input aria-label="Interview platform" required value={platformName} onChange={(event) => setPlatformName(event.target.value)} placeholder="Google Meet"/></label><label>Meeting link<input aria-label="Meeting link" required type="url" value={meetingLink} onChange={(event) => setMeetingLink(event.target.value)} placeholder="https://meet.google.com/…"/></label><label>Duration<select aria-label="Interview duration" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option></select></label><label>Agenda<textarea aria-label="Interview agenda" rows={3} value={agenda} onChange={(event) => setAgenda(event.target.value)} placeholder="Focus areas and preparation notes"/></label><fieldset className="applicant-panel-picker"><legend>Interview panel</legend>{profile.organisationMembers.map((member) => <label key={member.recruiterId}><input type="checkbox" checked={panelRecruiterIds.includes(member.recruiterId)} onChange={(event) => setPanelRecruiterIds((current) => event.target.checked ? [...current, member.recruiterId] : current.filter((id) => id !== member.recruiterId))}/><span>{member.fullName}<small>{member.designation || "Recruiter"}</small></span></label>)}</fieldset><Button type="submit" disabled={schedulePending}>{schedulePending ? "Scheduling…" : "Confirm interview"}</Button></form>}
          <InterviewList interviews={profile.interviews} openScorecardId={scorecardInterviewId} onToggleScorecard={(id) => setScorecardInterviewId((current) => current === id ? "" : id)}/>
        </section>
        {scorecardInterviewId && <section className="panel applicant-scorecard"><span className="eyebrow">Structured evidence</span><h2>Interview scorecard</h2><div className="applicant-score-criteria">{scoreCriteria.map(([key, label]) => <label key={key}><span>{label}</span><select aria-label={label} value={criteriaScores[key]} onChange={(event) => setCriteriaScores((current) => ({ ...current, [key]: Number(event.target.value) }))}>{[1, 2, 3, 4, 5].map((score) => <option value={score} key={score}>{score} / 5</option>)}</select></label>)}</div><div className="applicant-scorecard-summary"><span>Calculated overall score</span><strong>{overallScore}/5</strong></div><label>Recommendation<select aria-label="Recommendation" value={recommendation} onChange={(event) => setRecommendation(event.target.value)}><option value="STRONG_YES">Strong yes</option><option value="YES">Yes</option><option value="MAYBE">Maybe</option><option value="NO">No</option><option value="STRONG_NO">Strong no</option></select></label><label>Evidence and decision notes<textarea aria-label="Scorecard feedback" value={scoreFeedback} onChange={(event) => setScoreFeedback(event.target.value)} rows={4} maxLength={4000} placeholder="Reference examples from the interview and any remaining risk."/></label><Button onClick={() => void submitScorecard()} disabled={scorePending || !scoreFeedback.trim()}>{scorePending ? "Saving…" : "Save scorecard"}</Button></section>}
      </aside></section>
    </>}
  </WorkspaceShell>;
}

function CareerEvidence({ profile }: { profile: ApplicantDetail }) {
  return <article className="panel applicant-evidence-card"><header><div><span className="eyebrow">Verified profile evidence</span><h2>Career snapshot</h2></div><span className="applicant-verification">{profile.emailVerified && profile.mobileVerified ? "✓ Contact verified" : "Verification incomplete"}</span></header><dl><div><dt>Current</dt><dd>{profile.headline || "Not shared"}{profile.currentCompany ? ` at ${profile.currentCompany}` : ""}</dd></div><div><dt>Previous</dt><dd>{profile.previousRole || "Not shared"}{profile.previousCompany ? ` at ${profile.previousCompany}` : ""}</dd></div><div><dt>Experience</dt><dd>{profile.overallExperienceYears == null ? "Not shared" : `${profile.overallExperienceYears} years`}</dd></div><div><dt>Education</dt><dd>{profile.highestEducation}</dd></div><div><dt>Location</dt><dd>{profile.location || "Not shared"}</dd></div><div><dt>Preferred locations</dt><dd>{profile.preferredLocations.join(", ") || "Not shared"}</dd></div><div><dt>Notice period</dt><dd>{profile.noticePeriodDays == null ? "Not shared" : `${profile.noticePeriodDays} days`}</dd></div><div><dt>Expected salary</dt><dd>{profile.expectedSalaryLakhs == null ? "Not shared" : `₹${profile.expectedSalaryLakhs} Lacs`}</dd></div><div><dt>Function</dt><dd>{[profile.departmentRole, profile.industry].filter(Boolean).join(" · ") || "Not shared"}</dd></div></dl></article>;
}

function OfferManagement({ profile }: { profile: ApplicantDetail }) {
  const [workspace, setWorkspace] = useState<OfferWorkspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [approvalComment, setApprovalComment] = useState("");
  const [draft, setDraft] = useState<OfferDraft>(() => initialOfferDraft(profile));

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await apiClient<OfferWorkspace>(`/api/recruiter/applications/${profile.applicationId}/offer`);
      setWorkspace(result);
      if (result.offer) setDraft(draftFromOffer(result.offer));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Offer Management could not be loaded."); }
    finally { setLoading(false); }
  }, [profile.applicationId]);

  useEffect(() => { if (profile.pipelineStage === "OFFER") void load(); }, [load, profile.pipelineStage]);

  const run = async (action: "submit" | "send" | "withdraw", success: string) => {
    if (!workspace?.offer) return;
    if (action === "send" && !window.confirm(`Send offer version ${workspace.offer.version} to ${profile.fullName}?`)) return;
    if (action === "withdraw" && !window.confirm("Withdraw this offer? The candidate will be notified if it has already been sent.")) return;
    setPending(action); setError(""); setNotice("");
    try {
      const result = await apiClient<OfferWorkspace>(`/api/recruiter/applications/${profile.applicationId}/offer/${action}`, { method: "POST", body: JSON.stringify({ expectedVersion: workspace.offer.version }) });
      setWorkspace(result); setNotice(success);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The offer action could not be completed."); }
    finally { setPending(""); }
  };

  const save = async () => {
    setPending("save"); setError(""); setNotice("");
    try {
      const result = await apiClient<OfferWorkspace>(`/api/recruiter/applications/${profile.applicationId}/offer`, { method: "PUT", body: JSON.stringify({
        expectedVersion: workspace?.offer?.version ?? null,
        designation: draft.designation.trim(), joiningDate: draft.joiningDate, workplaceModel: draft.workplaceModel,
        probationMonths: Number(draft.probationMonths), noticeBuyout: draft.noticeBuyout, expiresAt: new Date(draft.expiresAt).toISOString(),
        currency: draft.currency.trim().toUpperCase(), annualFixedAmount: Number(draft.annualFixedAmount || 0),
        annualVariableAmount: Number(draft.annualVariableAmount || 0), joiningBonus: Number(draft.joiningBonus || 0),
        retentionBonus: Number(draft.retentionBonus || 0), otherCompensation: draft.otherCompensation.trim(),
        candidateMessage: draft.candidateMessage.trim(), termsText: draft.termsText.trim(), approverRecruiterIds: draft.approverRecruiterIds,
      }) });
      setWorkspace(result); setDraft(draftFromOffer(result.offer!)); setFormOpen(false); setNotice(`Offer version ${result.offer?.version} saved privately.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The offer draft could not be saved."); }
    finally { setPending(""); }
  };

  const decide = async (decision: "APPROVED" | "REJECTED") => {
    if (!workspace?.offer) return;
    setPending(decision); setError(""); setNotice("");
    try {
      const result = await apiClient<OfferWorkspace>(`/api/recruiter/applications/${profile.applicationId}/offer/approval`, { method: "POST", body: JSON.stringify({ expectedVersion: workspace.offer.version, decision, comments: approvalComment.trim() }) });
      setWorkspace(result); setApprovalComment(""); setNotice(decision === "APPROVED" ? "Your approval has been recorded." : "The offer was returned for revision.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The approval decision could not be recorded."); }
    finally { setPending(""); }
  };

  if (profile.pipelineStage !== "OFFER") return <section className="panel applicant-offer-card is-gated"><header><div><span className="eyebrow">Offer Management</span><h2>Offer workspace</h2></div><Badge tone={profile.decisionReadiness.offerReady ? "green" : "amber"}>{profile.decisionReadiness.offerReady ? "Unlocked" : "Gated"}</Badge></header><p>{profile.decisionReadiness.offerReady ? "The interview evidence is complete. Move the application to Offer to draft compensation, approvals and candidate terms." : "Complete the required interview evidence before creating an offer."}</p></section>;

  const offer = workspace?.offer;
  const total = offer ? offer.annualFixedAmount + offer.annualVariableAmount + offer.joiningBonus + offer.retentionBonus : 0;
  const independentMembers = profile.organisationMembers.filter((member) => member.recruiterId !== workspace?.currentRecruiterId);
  return <section className={`panel applicant-offer-card${offer ? ` offer-${offer.status.toLowerCase()}` : ""}`}>
    <header><div><span className="eyebrow">Offer Management</span><h2>{offer ? "Employment offer" : "Create the offer"}</h2></div>{offer && <Badge tone={offerStatusTone(offer.status)}>{readable(offer.status)}</Badge>}</header>
    {loading && <p role="status">Preparing the secure offer workspace…</p>}
    {error && <p className="job-publish-error" role="alert">{error}</p>}
    {notice && <p className="offer-management-notice" role="status">✓ {notice}</p>}
    {!loading && workspace && !offer && !formOpen && <div className="offer-management-empty"><span aria-hidden="true">✦</span><p>Build a candidate-ready offer with internal approvals, immutable versions and a secure response trail.</p><Button onClick={() => { setDraft(initialOfferDraft(profile)); setFormOpen(true); }} disabled={!profile.currentUserCanManage}>Create offer</Button><small>{workspace.entitlement.planName} plan · {workspace.entitlement.maximumApprovers} approver{workspace.entitlement.maximumApprovers === 1 ? "" : "s"} available</small></div>}
    {formOpen && workspace && <div className="offer-management-form"><div className="offer-form-grid"><label>Designation<input value={draft.designation} maxLength={200} onChange={(event) => setDraft((value) => ({ ...value, designation: event.target.value }))}/></label><label>Joining date<input type="date" value={draft.joiningDate} onChange={(event) => setDraft((value) => ({ ...value, joiningDate: event.target.value }))}/></label><label>Workplace<select value={draft.workplaceModel} onChange={(event) => setDraft((value) => ({ ...value, workplaceModel: event.target.value as OfferDraft["workplaceModel"] }))}><option value="ON_SITE">On-site</option><option value="HYBRID">Hybrid</option><option value="REMOTE">Remote</option></select></label><label>Probation<select value={draft.probationMonths} onChange={(event) => setDraft((value) => ({ ...value, probationMonths: event.target.value }))}><option value="0">Not applicable</option><option value="3">3 months</option><option value="6">6 months</option><option value="12">12 months</option></select></label><label>Offer expires<input type="datetime-local" value={draft.expiresAt} onChange={(event) => setDraft((value) => ({ ...value, expiresAt: event.target.value }))}/></label><label>Currency<input value={draft.currency} maxLength={3} onChange={(event) => setDraft((value) => ({ ...value, currency: event.target.value.toUpperCase() }))}/></label></div><div className="offer-compensation-grid"><label>Annual fixed<input type="number" min="0" step="1000" value={draft.annualFixedAmount} onChange={(event) => setDraft((value) => ({ ...value, annualFixedAmount: event.target.value }))}/></label><label>Annual variable<input type="number" min="0" step="1000" value={draft.annualVariableAmount} onChange={(event) => setDraft((value) => ({ ...value, annualVariableAmount: event.target.value }))}/></label><label>Joining bonus<input type="number" min="0" step="1000" value={draft.joiningBonus} onChange={(event) => setDraft((value) => ({ ...value, joiningBonus: event.target.value }))}/></label><label>Retention bonus<input type="number" min="0" step="1000" value={draft.retentionBonus} onChange={(event) => setDraft((value) => ({ ...value, retentionBonus: event.target.value }))}/></label></div><label className="offer-check"><input type="checkbox" checked={draft.noticeBuyout} onChange={(event) => setDraft((value) => ({ ...value, noticeBuyout: event.target.checked }))}/><span>Notice-period buyout is included</span></label><label>Additional compensation<textarea rows={2} maxLength={4000} value={draft.otherCompensation} onChange={(event) => setDraft((value) => ({ ...value, otherCompensation: event.target.value }))} placeholder="Equity, allowances or benefits"/></label><label>Message to candidate<textarea rows={3} maxLength={4000} value={draft.candidateMessage} onChange={(event) => setDraft((value) => ({ ...value, candidateMessage: event.target.value }))} placeholder="A short, personal note from the hiring team"/></label><label>Employment terms<textarea rows={5} maxLength={12000} value={draft.termsText} onChange={(event) => setDraft((value) => ({ ...value, termsText: event.target.value }))} placeholder="Conditions, policies and joining checks"/></label><fieldset className="offer-approver-picker"><legend>Internal approval</legend><p>Leave empty for the core, automatically approved workflow. Selected approvers must decide before the offer can be sent.</p>{independentMembers.map((member) => <label key={member.recruiterId}><input type="checkbox" disabled={!draft.approverRecruiterIds.includes(member.recruiterId) && draft.approverRecruiterIds.length >= workspace.entitlement.maximumApprovers} checked={draft.approverRecruiterIds.includes(member.recruiterId)} onChange={(event) => setDraft((value) => ({ ...value, approverRecruiterIds: event.target.checked ? [...value.approverRecruiterIds, member.recruiterId] : value.approverRecruiterIds.filter((id) => id !== member.recruiterId) }))}/><span>{member.fullName}<small>{member.designation || "Recruiter"}</small></span></label>)}</fieldset><div className="offer-form-actions"><Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button><Button onClick={() => void save()} disabled={pending === "save" || !draft.designation.trim() || !draft.joiningDate || !draft.expiresAt}>{pending === "save" ? "Saving…" : offer ? "Save new version" : "Save private draft"}</Button></div></div>}
    {offer && !formOpen && <><div className="offer-management-summary"><div><span>Version</span><strong>v{offer.version}</strong></div><div><span>Total compensation</span><strong>{formatOfferMoney(offer.currency, total)}</strong></div><div><span>Joining</span><strong>{formattedDate(offer.joiningDate)}</strong></div><div><span>Valid until</span><strong>{formattedDate(offer.expiresAt, true)}</strong></div></div><dl className="offer-management-details"><div><dt>Designation</dt><dd>{offer.designation}</dd></div><div><dt>Workplace</dt><dd>{readable(offer.workplaceModel)}</dd></div><div><dt>Probation</dt><dd>{offer.probationMonths ? `${offer.probationMonths} months` : "Not applicable"}</dd></div><div><dt>Notice buyout</dt><dd>{offer.noticeBuyout ? "Included" : "Not included"}</dd></div></dl>{offer.candidateMessage && <blockquote>{offer.candidateMessage}</blockquote>}<div className="offer-approval-list"><strong>Internal approvals</strong>{offer.approvals.length ? offer.approvals.map((approval) => <article key={approval.approvalId}><span>{applicantInitials(approval.recruiterName)}</span><div><b>{approval.recruiterName}</b><small>{readable(approval.decision)}{approval.comments ? ` · ${approval.comments}` : ""}</small></div></article>) : <p>No additional approval required.</p>}</div>{offer.approvable && <div className="offer-approval-decision"><label>Approval note<textarea rows={3} maxLength={1000} value={approvalComment} onChange={(event) => setApprovalComment(event.target.value)} placeholder="Optional when approving; required when requesting changes"/></label><div><Button variant="secondary" onClick={() => void decide("REJECTED")} disabled={Boolean(pending) || !approvalComment.trim()}>Request changes</Button><Button onClick={() => void decide("APPROVED")} disabled={Boolean(pending)}>Approve offer</Button></div></div>}<div className="offer-management-actions">{offer.editable && profile.currentUserCanManage && <Button variant="secondary" onClick={() => { setDraft(draftFromOffer(offer)); setFormOpen(true); }}>Edit as new version</Button>}{offer.submittable && profile.currentUserCanManage && <Button onClick={() => void run("submit", offer.approvals.length ? "Offer sent for internal approval." : "Offer approved and ready to send.")} disabled={Boolean(pending)}>{pending === "submit" ? "Submitting…" : offer.approvals.length ? "Submit for approval" : "Approve offer"}</Button>}{offer.sendable && profile.currentUserCanManage && <Button onClick={() => void run("send", `Offer sent securely to ${profile.fullName}.`)} disabled={Boolean(pending)}>{pending === "send" ? "Sending…" : "Send to candidate"}</Button>}<Button variant="quiet" onClick={() => window.open(`${apiBaseUrl}/api/recruiter/applications/${profile.applicationId}/offer/document.pdf`, "_blank", "noopener,noreferrer")}>Download PDF</Button>{offer.withdrawable && profile.currentUserCanManage && <button className="offer-withdraw" onClick={() => void run("withdraw", "Offer withdrawn and recorded in the timeline.")} disabled={Boolean(pending)}>Withdraw offer</button>}</div>{offer.respondedAt && <div className={`offer-response-state ${offer.status.toLowerCase()}`}><strong>Candidate {offer.status.toLowerCase()}</strong><span>{formattedDate(offer.respondedAt, true)}</span>{offer.responseNote && <p>{offer.responseNote}</p>}</div>}<details className="offer-version-history"><summary>{offer.versions.length} immutable version{offer.versions.length === 1 ? "" : "s"}</summary>{offer.versions.map((version) => <div key={version.version}><span>v{version.version} · {version.designation}</span><small>{formatOfferMoney(version.currency, version.totalCompensation)} · {version.createdBy} · {formattedDate(version.createdAt, true)}</small></div>)}</details></>}
  </section>;
}

function initialOfferDraft(profile: ApplicantDetail): OfferDraft {
  const joining = new Date(Date.now() + 14 * 86_400_000);
  const expiry = new Date(Date.now() + 3 * 86_400_000);
  return { designation: profile.jobTitle, joiningDate: joining.toISOString().slice(0, 10), workplaceModel: "HYBRID", probationMonths: "6", noticeBuyout: false, expiresAt: localDateTime(expiry), currency: "INR", annualFixedAmount: String((profile.expectedSalaryLakhs ?? 0) * 100000), annualVariableAmount: "0", joiningBonus: "0", retentionBonus: "0", otherCompensation: "", candidateMessage: `We are delighted to invite you to join us as ${profile.jobTitle}.`, termsText: "This offer is subject to successful joining checks and the organisation's applicable employment policies.", approverRecruiterIds: [] };
}
function draftFromOffer(offer: OfferDetails): OfferDraft { return { designation: offer.designation, joiningDate: offer.joiningDate, workplaceModel: offer.workplaceModel, probationMonths: String(offer.probationMonths), noticeBuyout: offer.noticeBuyout, expiresAt: localDateTime(new Date(offer.expiresAt)), currency: offer.currency, annualFixedAmount: String(offer.annualFixedAmount), annualVariableAmount: String(offer.annualVariableAmount), joiningBonus: String(offer.joiningBonus), retentionBonus: String(offer.retentionBonus), otherCompensation: offer.otherCompensation, candidateMessage: offer.candidateMessage, termsText: offer.termsText, approverRecruiterIds: offer.approvals.map((approval) => approval.recruiterId) }; }
function localDateTime(value: Date) { const offset = value.getTimezoneOffset() * 60_000; return new Date(value.getTime() - offset).toISOString().slice(0, 16); }
function formatOfferMoney(currency: string, value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value); }
function offerStatusTone(status: OfferStatus): "amber" | "green" | "blue" | "neutral" { return status === "ACCEPTED" || status === "APPROVED" ? "green" : status === "SENT" || status === "PENDING_APPROVAL" ? "blue" : status === "DRAFT" ? "amber" : "neutral"; }

function ContactCard({ profile, email, mobile, pending, emailRevealed, mobileRevealed, onContact }: { profile: ApplicantDetail; email: string; mobile: string; pending: string; emailRevealed: boolean; mobileRevealed: boolean; onContact: (channel: "EMAIL" | "MOBILE") => Promise<void> }) {
  return <section className="panel applicant-contact-card"><span className="eyebrow">Protected contact</span><h2>Contact candidate</h2><p>Each reveal is tied to {profile.jobId} in the privacy audit trail.</p><button onClick={() => void onContact("EMAIL")} disabled={!profile.currentUserCanManage || Boolean(pending)}><span>✉</span><div><small>Email</small><strong>{email}</strong></div><em>{pending === "EMAIL" ? "Recording…" : emailRevealed ? "Copy" : profile.currentUserCanManage ? "Reveal" : "Owner only"}</em></button><button onClick={() => void onContact("MOBILE")} disabled={!profile.currentUserCanManage || Boolean(pending)}><span>⌕</span><div><small>Mobile</small><strong>{mobile}</strong></div><em>{pending === "MOBILE" ? "Recording…" : mobileRevealed ? "Copy" : profile.currentUserCanManage ? "Reveal" : "Owner only"}</em></button></section>;
}

function DecisionReadinessCard({ readiness, canManage, pending, onPolicyChange }: { readiness: DecisionReadiness; canManage: boolean; pending: boolean; onPolicyChange: (value: number) => Promise<void> }) {
  const approvalOptions = Array.from({ length: Math.max(1, readiness.expectedReviewers, readiness.requiredApprovals) }, (_, index) => index + 1);
  const completion = readiness.expectedReviewers ? Math.min(100, Math.round(readiness.submittedScorecards / readiness.expectedReviewers * 100)) : 0;
  return <section className={`panel applicant-decision-card ${readiness.offerReady ? "is-ready" : "is-blocked"}`}><header><div><span className="eyebrow">Offer governance</span><h2>Decision readiness</h2></div><Badge tone={readiness.offerReady ? "green" : "amber"}>{readiness.offerReady ? "Ready for offer" : "Action needed"}</Badge></header><div className="applicant-decision-progress"><span style={{ width: `${completion}%` }}/></div><div className="applicant-decision-metrics"><div><strong>{readiness.submittedScorecards}/{readiness.expectedReviewers}</strong><span>Feedback received</span></div><div><strong>{readiness.positiveApprovals}/{readiness.requiredApprovals}</strong><span>Positive approvals</span></div><div><strong>{readiness.averageScore == null ? "—" : `${readiness.averageScore}/5`}</strong><span>Average score</span></div></div><label>Required positive approvals<select aria-label="Required positive approvals" value={readiness.requiredApprovals} disabled={!canManage || pending} onChange={(event) => void onPolicyChange(Number(event.target.value))}>{approvalOptions.map((value) => <option value={value} key={value}>{value} approval{value === 1 ? "" : "s"}</option>)}</select></label>{readiness.missingReviewerNames.length > 0 && <div className="applicant-missing-reviewers"><strong>Feedback outstanding</strong><div>{readiness.missingReviewerNames.map((name) => <span key={name}>{name}</span>)}</div></div>}{readiness.conflictingRecommendations && <div className="applicant-decision-conflict">Reviewers disagree on the hiring recommendation.</div>}<ul>{readiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>{readiness.offerReady && <p>All required evidence is complete. The owner can now move this application to Offer.</p>}</section>;
}

function InterviewList({ interviews, openScorecardId, onToggleScorecard }: { interviews: ApplicantInterview[]; openScorecardId: string; onToggleScorecard: (id: string) => void }) {
  return <div className="applicant-interview-list">{interviews.length ? interviews.map((interview) => { const safeLink = safeExternalUrl(interview.meetingLink); return <article key={interview.interviewId}><div><strong>{formattedDate(interview.scheduledAt, true)}</strong><small>{interview.durationMinutes} min · {interview.platformName}</small></div><Badge tone={interview.status === "SCHEDULED" ? "blue" : "neutral"}>{readable(interview.status)}</Badge>{interview.agenda && <p>{interview.agenda}</p>}<small>Owner: {interview.interviewOwnerName}</small><small>{interview.panelRecruiterNames.length ? `Panel: ${interview.panelRecruiterNames.join(", ")}` : "No additional panel members"}</small>{safeLink && <a href={safeLink} target="_blank" rel="noopener noreferrer">Open meeting ↗</a>}<div className="applicant-scorecard-history">{interview.scorecards.map((scorecard) => <article key={scorecard.id}><header><strong>{scorecard.recruiterName}</strong><span>{scorecard.score}/5 · {readable(scorecard.recommendation)}</span></header>{scorecard.criteriaScores && <div>{scoreCriteria.map(([key, label]) => scorecard.criteriaScores?.[key] ? <small key={key}>{label} {scorecard.criteriaScores[key]}/5</small> : null)}</div>}<p>{scorecard.feedback}</p><small>{formattedDate(scorecard.submittedAt, true)}</small></article>)}</div>{interview.currentUserCanScore && <button className="applicant-scorecard-open" onClick={() => onToggleScorecard(interview.interviewId)}>{openScorecardId === interview.interviewId ? "Cancel scorecard" : interview.scorecards.length ? "Update my scorecard" : "Add scorecard"}</button>}</article>; }) : <p>No interviews scheduled for this application.</p>}</div>;
}
