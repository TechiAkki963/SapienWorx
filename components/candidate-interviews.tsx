"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";
import { Button, EmptyState, WorkspaceShell } from "./ui";

type Application = { applicationId: string; jobId: string; title: string; companyName: string; stage: string };
type ApplicationsPage = { content: Application[]; totalPages: number; number: number };
type Timeline = { interviews: Interview[] };
type Interview = { id: string; platformName?: string | null; meetingLink: string; scheduledAt: string; durationMinutes: number; status: string; timeZone?: string | null; agenda?: string | null; panelNames?: string[] | null };
type InterviewView = Interview & { applicationId: string; title: string; companyName: string };
type View = "UPCOMING" | "AWAITING" | "PAST" | "CANCELLED";

const tabs: Array<{ id: View; label: string }> = [
  { id: "UPCOMING", label: "Upcoming" },
  { id: "AWAITING", label: "Awaiting confirmation" },
  { id: "PAST", label: "Past" },
  { id: "CANCELLED", label: "Cancelled" },
];

function providerLabel(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("meet.google")) return "Google Meet";
    if (host.includes("teams.microsoft") || host.includes("teams.live")) return "Microsoft Teams";
    if (host.includes("zoom.")) return "Zoom";
    if (host.includes("webex.")) return "Webex";
  } catch { /* validation handled by the backend */ }
  return "External video interview";
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}

function classification(interview: InterviewView): View {
  const status = interview.status.toUpperCase();
  if (status.includes("CANCEL")) return "CANCELLED";
  if (status.includes("PENDING") || status.includes("AWAIT")) return "AWAITING";
  return new Date(interview.scheduledAt).getTime() >= Date.now() ? "UPCOMING" : "PAST";
}

export function CandidateInterviews() {
  const [view, setView] = useState<View>("UPCOMING");
  const [interviews, setInterviews] = useState<InterviewView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let current = true;
    const load = async () => {
      setLoading(true); setError("");
      try {
        const first = await apiClient<ApplicationsPage>("/api/candidate/applications?page=0");
        const pages = [first];
        for (let page = 1; page < Math.min(first.totalPages, 10); page += 1) pages.push(await apiClient<ApplicationsPage>(`/api/candidate/applications?page=${page}`));
        const apps = pages.flatMap((item) => item.content);
        const timelines = await Promise.all(apps.map(async (application) => {
          try {
            const timeline = await apiClient<Timeline>(`/api/candidate/applications/${application.applicationId}/timeline`);
            return timeline.interviews.map((interview) => ({ ...interview, applicationId: application.applicationId, title: application.title, companyName: application.companyName }));
          } catch { return [] as InterviewView[]; }
        }));
        if (current) setInterviews(timelines.flat().sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()));
      } catch (reason) {
        if (current) setError(reason instanceof Error ? reason.message : "We could not load your interviews.");
      } finally { if (current) setLoading(false); }
    };
    void load();
    return () => { current = false; };
  }, [reload]);

  const visible = useMemo(() => interviews.filter((interview) => classification(interview) === view), [interviews, view]);

  return <WorkspaceShell workspace="candidate" active="interviews" title="Interviews" description="Everything you need for upcoming and past interviews, without connecting an external calendar account.">
    <section className="candidate-interview-centre">
      <div className="candidate-interview-tabs" role="tablist" aria-label="Interview views">
        {tabs.map((tab) => <button type="button" role="tab" aria-selected={view === tab.id} className={view === tab.id ? "selected" : ""} onClick={() => setView(tab.id)} key={tab.id}>{tab.label}<span>{interviews.filter((interview) => classification(interview) === tab.id).length}</span></button>)}
      </div>
      {loading && <div className="candidate-interview-state" role="status"><strong>Loading interviews…</strong><p>Checking your application timelines for scheduled interviews.</p></div>}
      {error && <div className="candidate-interview-state" role="alert"><strong>We couldn’t load your interviews.</strong><p>{error}</p><Button variant="secondary" onClick={() => setReload((value) => value + 1)}>Try again</Button></div>}
      {!loading && !error && visible.length === 0 && <EmptyState icon="Calendar" title={`No ${tabs.find((tab) => tab.id === view)?.label.toLowerCase()} interviews`} copy="Interview details will appear here as soon as the hiring team schedules or updates them." action={<Button href="/candidate/applications" variant="secondary">View applications</Button>} />}
      {!loading && !error && visible.length > 0 && <div className="candidate-interview-list">{visible.map((interview) => <article className="candidate-interview-card" key={`${interview.applicationId}-${interview.id}`}>
        <div className="candidate-interview-card-main"><span className="eyebrow">{classification(interview) === "UPCOMING" ? "Upcoming interview" : tabs.find((tab) => tab.id === classification(interview))?.label}</span><h2>{interview.title}</h2><p className="candidate-interview-company">{interview.companyName}</p><dl><div><dt>When</dt><dd>{dateLabel(interview.scheduledAt)}</dd></div><div><dt>Duration</dt><dd>{interview.durationMinutes} minutes</dd></div><div><dt>Mode</dt><dd>{providerLabel(interview.meetingLink)}</dd></div>{interview.agenda && <div><dt>Preparation</dt><dd>{interview.agenda}</dd></div>}</dl></div>
        <div className="candidate-interview-actions"><a className="button button-primary" href={interview.meetingLink} target="_blank" rel="noreferrer">Join Interview</a><a className="button button-secondary" href={`/api/candidate/applications/${interview.applicationId}/interviews/${interview.id}/calendar`}>Download calendar file</a><a className="button button-quiet" href="/candidate/messages">Message recruiter</a></div>
      </article>)}</div>}
      <p className="candidate-interview-privacy-note">Meeting links are supplied by the recruiter and open in the external provider. SapienWorx does not require Google or Microsoft account access for this workflow.</p>
    </section>
  </WorkspaceShell>;
}
