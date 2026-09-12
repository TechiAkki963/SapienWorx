"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";
import { Button, EmptyState, WorkspaceShell } from "./ui";
import styles from "./candidate-interviews.module.css";

type Application = { applicationId: string; jobId: string; title: string; companyName: string; stage: string };
type ApplicationsPage = { content: Application[]; totalPages: number; number: number };
type Timeline = { interviews: Interview[] };
type Interview = { id: string; platformName?: string | null; meetingLink: string; scheduledAt: string; durationMinutes: number; status: string; timeZone?: string | null; agenda?: string | null; panelNames?: string[] | null };
type InterviewView = Interview & { applicationId: string; title: string; companyName: string };
type View = "UPCOMING" | "PAST" | "CANCELLED";

const tabs: Array<{ id: View; label: string }> = [
  { id: "UPCOMING", label: "Upcoming" },
  { id: "PAST", label: "Past" },
  { id: "CANCELLED", label: "Cancelled" },
];

function providerLabel(url: string, fallback?: string | null) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("meet.google")) return "Google Meet";
    if (host.includes("teams.microsoft") || host.includes("teams.live")) return "Microsoft Teams";
    if (host.includes("zoom.")) return "Zoom";
    if (host.includes("webex.")) return "Webex";
  } catch { return fallback || "External video interview"; }
  return fallback || "External video interview";
}
function classification(interview: InterviewView): View {
  const status = interview.status.toUpperCase();
  if (status.includes("CANCEL")) return "CANCELLED";
  return new Date(interview.scheduledAt).getTime() >= Date.now() ? "UPCOMING" : "PAST";
}
function dayKey(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function dayLabel(value: string) {
  const date = new Date(value); if (Number.isNaN(date.getTime())) return "Date unavailable";
  const today = new Date(); const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const key = dayKey(value); const prefix = key === dayKey(today.toISOString()) ? "Today" : key === dayKey(tomorrow.toISOString()) ? "Tomorrow" : "";
  const formatted = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short" }).format(date);
  return prefix ? `${prefix} · ${formatted}` : formatted;
}
function timeLabel(value: string) {
  const date = new Date(value); if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(date);
}
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "P"; }

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
        if (current) setInterviews(timelines.flat().sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime()));
      } catch (reason) {
        if (current) setError(reason instanceof Error ? reason.message : "We could not load your interviews.");
      } finally { if (current) setLoading(false); }
    };
    void load(); return () => { current = false; };
  }, [reload]);

  const visible = useMemo(() => interviews.filter((interview) => classification(interview) === view), [interviews, view]);
  const grouped = useMemo(() => {
    const groups = new Map<string, InterviewView[]>();
    visible.forEach((interview) => { const key = dayKey(interview.scheduledAt); groups.set(key, [...(groups.get(key) ?? []), interview]); });
    return [...groups.entries()];
  }, [visible]);

  return <WorkspaceShell workspace="candidate" active="interviews" title="Interviews" description="Everything you need to prepare, join and follow up without losing application context.">
    <section className={styles.page}>
      <header className={styles.missionHeader}>
        <div><span className="eyebrow">Interview mission control</span><h2>Be ready for the next conversation.</h2><p>Meeting links come directly from the recruiter. SapienWorx keeps the schedule, application context and preparation actions together.</p></div>
        <Button href="/candidate/applications" variant="secondary">View applications</Button>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Interview views">{tabs.map((tab) => <button type="button" role="tab" aria-selected={view === tab.id} className={view === tab.id ? styles.selected : undefined} onClick={() => setView(tab.id)} key={tab.id}>{tab.label}<span>{interviews.filter((interview) => classification(interview) === tab.id).length}</span></button>)}</div>

      {loading && <div className={styles.state} role="status"><strong>Loading interviews…</strong><p>Checking your application timelines for scheduled interviews.</p></div>}
      {error && <div className={styles.state} role="alert"><strong>We couldn’t load your interviews.</strong><p>{error}</p><Button variant="secondary" onClick={() => setReload((value) => value + 1)}>Try again</Button></div>}
      {!loading && !error && visible.length === 0 && <EmptyState icon="Calendar" title={`No ${tabs.find((tab) => tab.id === view)?.label.toLowerCase()} interviews`} copy="Interview details will appear here as soon as the hiring team schedules or updates them." action={<Button href="/candidate/applications" variant="secondary">View applications</Button>} />}

      {!loading && !error && grouped.length > 0 && <div className={styles.days}>{grouped.map(([key, dayInterviews]) => <section className={styles.dayGroup} key={key}>
        <header className={styles.dayHeader}><h2>{dayLabel(dayInterviews[0].scheduledAt)}</h2><span>{dayInterviews.length} interview{dayInterviews.length === 1 ? "" : "s"}</span></header>
        <div className={styles.list}>{dayInterviews.map((interview) => {
          const panel = interview.panelNames ?? [];
          return <article className={styles.row} key={`${interview.applicationId}-${interview.id}`}>
            <div className={styles.scheduleBlock}><time className={styles.time}>{timeLabel(interview.scheduledAt)}</time><span>{interview.durationMinutes} min</span></div>
            <div className={styles.role}><strong>{interview.title}</strong><span>{interview.companyName}</span>{interview.agenda && <small>{interview.agenda}</small>}</div>
            <div className={styles.mode}><span>Meeting</span><strong>{providerLabel(interview.meetingLink, interview.platformName)}</strong><small>{interview.timeZone || "Local time"}</small></div>
            <div className={styles.panel}><span>Interviewers</span>{panel.length ? <div>{panel.slice(0, 3).map((name) => <span className={styles.panelPerson} key={name}><i aria-hidden="true">{initials(name)}</i><b>{name}</b></span>)}{panel.length > 3 && <small>+{panel.length - 3} more</small>}</div> : <small>Panel details not shared yet</small>}</div>
            {view === "UPCOMING" && <div className={styles.prep}><span>Preparation checklist</span><ul><li>Review the role requirements</li><li>Prepare two relevant project examples</li><li>Test your microphone and camera</li><li>Keep questions ready for the interviewer</li></ul></div>}
            <div className={styles.actions}>
              {view === "UPCOMING" && <a className="button button-primary" href={interview.meetingLink} target="_blank" rel="noreferrer">Join interview</a>}
              <a className="button button-secondary" href={`/api/candidate/applications/${interview.applicationId}/interviews/${interview.id}/calendar`}>Add to calendar (.ics)</a>
              <a className="button button-quiet" href="/candidate/messages">Message recruiter</a>
            </div>
          </article>;
        })}</div>
      </section>)}</div>}

      <p className={styles.privacyNote}>Meeting links are supplied by the recruiter and open in the external provider. SapienWorx does not require Google, Microsoft, Zoom or calendar-account access for this workflow.</p>
    </section>
  </WorkspaceShell>;
}
