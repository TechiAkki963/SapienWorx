"use client";

import { useEffect, useMemo, useState } from "react";
import { apiBaseUrl, apiClient } from "../lib/api-client";
import { publicJobPath } from "../lib/jobs/routes";
import { Badge, Button, SectionTitle, WorkspaceShell } from "./ui";

type ApplicationStage = "APPLIED" | "SCREENING" | "INTERVIEWING" | "FINAL_STAGE" | "OFFER" | "ONBOARDED" | "REJECTED";
type ApplicationFilter = "ALL" | "ACTIVE" | "INTERVIEWS" | "OFFERS" | "CLOSED";

type CandidateApplication = {
  applicationId: string;
  jobId: string;
  title: string;
  companyName: string;
  location: string | null;
  recruiterName: string | null;
  recruiterTitle: string | null;
  stage: ApplicationStage;
  appliedAt: string;
  updatedAt: string;
};

type CandidateApplicationsPage = {
  content: CandidateApplication[];
  totalPages: number;
  totalElements: number;
  number: number;
  first: boolean;
  last: boolean;
};

type CandidateApplicationSummary = {
  totalApplications: number;
  activeApplications: number;
  interviewApplications: number;
  offerApplications: number;
};

type ApplicationTimeline = {
  applicationId: string;
  stage: ApplicationStage;
  nextStep: string;
  events: Array<{ type: string; summary: string; occurredAt: string }>;
  interviews: Array<{ id: string; platformName: string; meetingLink: string; scheduledAt: string; durationMinutes: number; status: string }>;
};

type CandidateOffer = {
  offerId: string; applicationId: string; jobTitle: string; organisationName: string;
  status: "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "WITHDRAWN"; version: number;
  designation: string; joiningDate: string; workplaceModel: "ON_SITE" | "HYBRID" | "REMOTE";
  probationMonths: number; noticeBuyout: boolean; expiresAt: string; currency: string;
  annualFixedAmount: number; annualVariableAmount: number; joiningBonus: number; retentionBonus: number;
  otherCompensation: string; candidateMessage: string; termsText: string; sentAt: string | null;
  respondedAt: string | null; responseNote: string | null; canRespond: boolean;
};
type CandidateOfferWorkspace = { offer: CandidateOffer | null };

const filters: Array<{ id: ApplicationFilter; label: string }> = [
  { id: "ALL", label: "All applications" },
  { id: "ACTIVE", label: "In review" },
  { id: "INTERVIEWS", label: "Interviews" },
  { id: "OFFERS", label: "Offers" },
  { id: "CLOSED", label: "Closed" },
];

const stageCopy: Record<ApplicationStage, { label: string; note: string; tone: "blue" | "green" | "amber" | "rose" | "purple" }> = {
  APPLIED: { label: "Applied", note: "Your application has been delivered to the hiring team.", tone: "blue" },
  SCREENING: { label: "In review", note: "The hiring team is reviewing your profile.", tone: "blue" },
  INTERVIEWING: { label: "Interview", note: "You are moving through the interview process.", tone: "purple" },
  FINAL_STAGE: { label: "Final review", note: "The hiring team is making a final decision.", tone: "amber" },
  OFFER: { label: "Offer", note: "Good news — this application has progressed to an offer.", tone: "green" },
  ONBOARDED: { label: "Hired", note: "This opportunity is complete. Congratulations on your next step.", tone: "green" },
  REJECTED: { label: "Not selected", note: "This opportunity is now closed. Keep exploring roles that fit.", tone: "rose" },
};

function matchesFilter(application: CandidateApplication, filter: ApplicationFilter) {
  if (filter === "ALL") return true;
  if (filter === "ACTIVE") return ["APPLIED", "SCREENING", "FINAL_STAGE"].includes(application.stage);
  if (filter === "INTERVIEWS") return application.stage === "INTERVIEWING";
  if (filter === "OFFERS") return application.stage === "OFFER";
  return ["ONBOARDED", "REJECTED"].includes(application.stage);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function relativeDate(value: string) {
  const days = Math.floor(Math.max(0, Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function stageIndex(stage: ApplicationStage) {
  if (stage === "REJECTED") return 1;
  if (stage === "ONBOARDED") return 4;
  return ["APPLIED", "SCREENING", "INTERVIEWING", "FINAL_STAGE", "OFFER"].indexOf(stage);
}

export function CandidateApplications() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<CandidateApplicationsPage | null>(null);
  const [summary, setSummary] = useState<CandidateApplicationSummary | null>(null);
  const [filter, setFilter] = useState<ApplicationFilter>("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    void Promise.allSettled([
      apiClient<CandidateApplicationsPage>(`/api/candidate/applications?page=${page}`),
      apiClient<CandidateApplicationSummary>("/api/candidate/applications/summary"),
    ])
      .then(([applicationsResponse, summaryResponse]) => {
        if (!current) return;
        if (applicationsResponse.status === "fulfilled") setData(applicationsResponse.value);
        else setError(applicationsResponse.reason instanceof Error ? applicationsResponse.reason.message : "We could not load your applications.");
        if (summaryResponse.status === "fulfilled") setSummary(summaryResponse.value);
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [page, reloadToken]);

  const applications = data?.content ?? [];
  const visibleApplications = useMemo(() => applications.filter((application) => {
    const searchable = `${application.title} ${application.companyName} ${application.location ?? ""}`.toLowerCase();
    return matchesFilter(application, filter) && (!query.trim() || searchable.includes(query.trim().toLowerCase()));
  }), [applications, filter, query]);

  return <WorkspaceShell workspace="candidate" active="applications" title="My applications" description="Follow every application from submission through to a decision.">
    <main className="candidate-applications-page">
      <section className="candidate-applications-hero panel">
        <div><span className="eyebrow">Application tracker</span><h2>Keep your search moving.</h2><p>Every application is routed to the recruiter who posted the role. They update the stage; you can always see the latest outcome here.</p></div>
        <Button href="/candidate/jobs" variant="secondary">Explore jobs</Button>
      </section>

      <section className="candidate-application-stat-grid" aria-label="Application summary">
        <article><span>Applications</span><strong>{summary?.totalApplications ?? 0}</strong><small>All roles you have applied for</small></article>
        <article><span>Active</span><strong>{summary?.activeApplications ?? 0}</strong><small>Currently with a hiring team</small></article>
        <article><span>Interviews</span><strong>{summary?.interviewApplications ?? 0}</strong><small>In the interview process</small></article>
        <article><span>Offers</span><strong>{summary?.offerApplications ?? 0}</strong><small>Waiting for your decision</small></article>
      </section>

      <section className="candidate-application-browser panel">
        <SectionTitle eyebrow="Your opportunities" title="Application status" action={<span className="candidate-application-page-count">{data ? `${data.totalElements} total` : "Loading…"}</span>} />
        <div className="candidate-application-controls">
          <div className="candidate-application-filter" role="tablist" aria-label="Application status filter">
            {filters.map((item) => <button key={item.id} role="tab" type="button" aria-selected={filter === item.id} className={filter === item.id ? "selected" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>)}
          </div>
          <label className="candidate-application-search"><span>⌕</span><input aria-label="Search applications" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search role or company" /></label>
        </div>

        {error && <div className="candidate-applications-error" role="alert"><strong>We couldn&apos;t load your applications.</strong><span>{error}</span><div>{error === "Sign in to continue." || error.includes("signed-in account") ? <Button href="/login">Sign in</Button> : <Button onClick={() => setReloadToken((current) => current + 1)} variant="secondary">Try again</Button>}</div></div>}
        {loading && <div className="candidate-applications-loading" role="status"><span></span><span></span><span></span><p>Loading your applications…</p></div>}
        {!loading && !error && visibleApplications.length > 0 && <div className="candidate-application-list">{visibleApplications.map((application) => <ApplicationCard application={application} key={application.applicationId} />)}</div>}
        {!loading && !error && applications.length > 0 && visibleApplications.length === 0 && <div className="candidate-applications-empty"><span>⌕</span><strong>No applications match that view.</strong><p>Try another status or search term to find the application you need.</p><Button onClick={() => { setFilter("ALL"); setQuery(""); }} variant="secondary">Clear filters</Button></div>}
        {!loading && !error && applications.length === 0 && <div className="candidate-applications-empty"><span>◫</span><strong>Your application tracker is ready.</strong><p>When you apply to a role, its status and recruiter context will appear here.</p><Button href="/candidate/jobs">Explore jobs</Button></div>}

        {!loading && !error && data && data.totalPages > 1 && <footer className="candidate-applications-pagination"><span>Page {data.number + 1} of {data.totalPages}</span><div><Button onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={data.first} variant="secondary">Previous</Button><Button onClick={() => setPage((current) => current + 1)} disabled={data.last}>Next</Button></div></footer>}
      </section>
    </main>
  </WorkspaceShell>;
}

function ApplicationCard({ application }: { application: CandidateApplication }) {
  const currentStage = stageCopy[application.stage];
  const progressIndex = stageIndex(application.stage);
  const progressLabels = ["Applied", "In review", "Interview", "Final review", "Offer"];
  const recruiter = application.recruiterName ? `${application.recruiterName}${application.recruiterTitle ? ` · ${application.recruiterTitle}` : ""}` : "Hiring team";
  const [timeline, setTimeline] = useState<ApplicationTimeline | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState("");
  const [offerWorkspace, setOfferWorkspace] = useState<CandidateOfferWorkspace | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerError, setOfferError] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [offerPending, setOfferPending] = useState("");
  const [offerNotice, setOfferNotice] = useState("");
  const toggleTimeline = async () => {
    const nextOpen = !timelineOpen; setTimelineOpen(nextOpen); if (!nextOpen || timeline || timelineLoading) return;
    setTimelineLoading(true); setTimelineError("");
    try { setTimeline(await apiClient<ApplicationTimeline>(`/api/candidate/applications/${application.applicationId}/timeline`)); }
    catch (reason) { setTimelineError(reason instanceof Error ? reason.message : "We could not load this application timeline."); }
    finally { setTimelineLoading(false); }
  };
  const toggleOffer = async () => {
    const nextOpen = !offerOpen; setOfferOpen(nextOpen); if (!nextOpen || offerWorkspace || offerLoading) return;
    setOfferLoading(true); setOfferError("");
    try { setOfferWorkspace(await apiClient<CandidateOfferWorkspace>(`/api/candidate/applications/${application.applicationId}/offer`)); }
    catch (reason) { setOfferError(reason instanceof Error ? reason.message : "We could not load your offer."); }
    finally { setOfferLoading(false); }
  };
  const respondToOffer = async (decision: "ACCEPT" | "DECLINE") => {
    const offer = offerWorkspace?.offer; if (!offer) return;
    if (!window.confirm(decision === "ACCEPT" ? "Accept this offer? The hiring team will be notified immediately." : "Decline this offer? The hiring team will be notified immediately.")) return;
    setOfferPending(decision); setOfferError(""); setOfferNotice("");
    try {
      const result = await apiClient<CandidateOfferWorkspace>(`/api/candidate/applications/${application.applicationId}/offer/response`, { method: "POST", body: JSON.stringify({ expectedVersion: offer.version, decision, note: offerNote.trim() }) });
      setOfferWorkspace(result); setOfferNotice(decision === "ACCEPT" ? "Your acceptance is confirmed and the hiring team has been notified." : "Your decision has been recorded and the hiring team has been notified.");
    } catch (reason) { setOfferError(reason instanceof Error ? reason.message : "Your response could not be recorded."); }
    finally { setOfferPending(""); }
  };

  return <article className={`candidate-application-card stage-${application.stage.toLowerCase()}`}>
    <header className="candidate-application-card-head"><div><span className="candidate-application-company-mark">{application.companyName.slice(0, 1).toUpperCase()}</span><div><h3>{application.title}</h3><p>{application.companyName}{application.location ? ` · ${application.location}` : ""}</p></div></div><Badge tone={currentStage.tone}>{currentStage.label}</Badge></header>
    <div className="candidate-application-card-body"><div className="candidate-application-stage-copy"><strong>{currentStage.note}</strong><span>Applied {formatDate(application.appliedAt)} · Updated {relativeDate(application.updatedAt)}</span></div>
      <ol className="candidate-application-progress" aria-label={`Application progress: ${currentStage.label}`}>{progressLabels.map((label, index) => <li className={application.stage === "REJECTED" ? (index === 0 ? "completed" : "") : index <= progressIndex ? "completed" : ""} key={label}><span aria-hidden="true">{index < progressIndex ? "✓" : index + 1}</span><small>{label}</small></li>)}</ol>
    </div>
    {timelineOpen && <section className="candidate-application-timeline" aria-live="polite">{timelineLoading && <p>Loading your timeline…</p>}{timelineError && <p className="candidate-application-timeline-error" role="alert">{timelineError}</p>}{timeline && <><p className="candidate-application-next-step"><b>Next step:</b> {timeline.nextStep}</p><ol>{timeline.events.map((event, index) => <li key={`${event.type}-${event.occurredAt}-${index}`}><span>●</span><div><b>{event.summary}</b><small>{formatDate(event.occurredAt)}</small></div></li>)}</ol>{timeline.interviews.length > 0 && <div className="candidate-application-interviews"><b>Scheduled interviews</b>{timeline.interviews.map((interview) => <article key={interview.id}><span>{formatDate(interview.scheduledAt)} · {interview.durationMinutes} min · {interview.platformName}</span><a href={interview.meetingLink} target="_blank" rel="noreferrer">Open meeting link</a></article>)}</div>}</>}</section>}
    {offerOpen && <CandidateOfferPanel applicationId={application.applicationId} workspace={offerWorkspace} loading={offerLoading} error={offerError} notice={offerNotice} note={offerNote} setNote={setOfferNote} pending={offerPending} onRespond={respondToOffer}/>}
    <footer className="candidate-application-card-footer"><div><span>Hiring contact</span><strong>{recruiter}</strong></div><div className="candidate-application-card-actions">{application.stage === "OFFER" && <button type="button" className="candidate-review-offer" onClick={() => void toggleOffer()}>{offerOpen ? "Close offer" : "Review offer"}</button>}<button type="button" onClick={() => void toggleTimeline()}>{timelineOpen ? "Hide timeline" : "View timeline"}</button><a href={publicJobPath(application.jobId, application.title)}>View job</a><a href="/candidate/messages">Messages</a></div></footer>
  </article>;
}

function CandidateOfferPanel({ applicationId, workspace, loading, error, notice, note, setNote, pending, onRespond }: { applicationId: string; workspace: CandidateOfferWorkspace | null; loading: boolean; error: string; notice: string; note: string; setNote: (value: string) => void; pending: string; onRespond: (decision: "ACCEPT" | "DECLINE") => Promise<void> }) {
  const offer = workspace?.offer;
  if (loading) return <section className="candidate-offer-panel" role="status">Opening your secure offer…</section>;
  if (error) return <section className="candidate-offer-panel"><p className="candidate-application-timeline-error" role="alert">{error}</p></section>;
  if (workspace && !offer) return <section className="candidate-offer-panel candidate-offer-preparing"><span aria-hidden="true">✦</span><div><strong>Your offer is being prepared.</strong><p>The hiring team has moved you to the offer stage. The approved document will appear here as soon as it is sent.</p></div></section>;
  if (!offer) return null;
  const total = offer.annualFixedAmount + offer.annualVariableAmount + offer.joiningBonus + offer.retentionBonus;
  return <section className={`candidate-offer-panel status-${offer.status.toLowerCase()}`}><header><div><span>Secure offer · version {offer.version}</span><h4>{offer.designation}</h4><p>{offer.organisationName}</p></div><Badge tone={offer.status === "ACCEPTED" ? "green" : offer.status === "SENT" ? "blue" : "amber"}>{offer.status.toLowerCase().replaceAll("_", " ")}</Badge></header>{notice && <p className="candidate-offer-notice" role="status">✓ {notice}</p>}{offer.candidateMessage && <blockquote>{offer.candidateMessage}</blockquote>}<div className="candidate-offer-metrics"><div><span>Total compensation</span><strong>{new Intl.NumberFormat("en-IN", { style: "currency", currency: offer.currency, maximumFractionDigits: 0 }).format(total)}</strong></div><div><span>Joining date</span><strong>{formatDate(offer.joiningDate)}</strong></div><div><span>Workplace</span><strong>{offer.workplaceModel.toLowerCase().replaceAll("_", " ")}</strong></div><div><span>Valid until</span><strong>{formatDate(offer.expiresAt)}</strong></div></div><details><summary>Compensation and terms</summary><dl><div><dt>Annual fixed</dt><dd>{offer.currency} {offer.annualFixedAmount.toLocaleString("en-IN")}</dd></div><div><dt>Annual variable</dt><dd>{offer.currency} {offer.annualVariableAmount.toLocaleString("en-IN")}</dd></div><div><dt>Joining bonus</dt><dd>{offer.currency} {offer.joiningBonus.toLocaleString("en-IN")}</dd></div><div><dt>Retention bonus</dt><dd>{offer.currency} {offer.retentionBonus.toLocaleString("en-IN")}</dd></div><div><dt>Probation</dt><dd>{offer.probationMonths ? `${offer.probationMonths} months` : "Not applicable"}</dd></div><div><dt>Notice buyout</dt><dd>{offer.noticeBuyout ? "Included" : "Not included"}</dd></div></dl>{offer.otherCompensation && <p><b>Additional compensation</b><br/>{offer.otherCompensation}</p>}<p><b>Employment terms</b><br/>{offer.termsText}</p></details><div className="candidate-offer-document"><a href={`${apiBaseUrl}/api/candidate/applications/${applicationId}/offer/document.pdf`} target="_blank" rel="noopener noreferrer">Download offer PDF ↗</a><small>Your response and every version are recorded securely.</small></div>{offer.canRespond && <div className="candidate-offer-response"><label>Optional note to the hiring team<textarea rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Share a question or a short note with your decision"/></label><div><Button variant="secondary" onClick={() => void onRespond("DECLINE")} disabled={Boolean(pending)}>{pending === "DECLINE" ? "Recording…" : "Decline offer"}</Button><Button onClick={() => void onRespond("ACCEPT")} disabled={Boolean(pending)}>{pending === "ACCEPT" ? "Confirming…" : "Accept offer"}</Button></div></div>}{!offer.canRespond && <div className="candidate-offer-complete"><strong>{offer.status === "ACCEPTED" ? "Offer accepted" : offer.status === "DECLINED" ? "Offer declined" : offer.status === "EXPIRED" ? "Offer expired" : "Offer withdrawn"}</strong>{offer.respondedAt && <span>Recorded {formatDate(offer.respondedAt)}</span>}{offer.responseNote && <p>{offer.responseNote}</p>}</div>}</section>;
}
