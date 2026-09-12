"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient } from "../lib/api-client";
import { WorkspaceShell } from "./ui";
import styles from "./recruiter-interviews-v2.module.css";

type ScheduledInterview = {
  candidateName: string;
  jobTitle: string;
  platformName: string;
  meetingLink: string;
  scheduledAt: string;
  durationMinutes: number;
};

function hostMatches(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

function providerLabel(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/\.$/, "");
    if (host === "meet.google.com") return "Google Meet";
    if (hostMatches(host, "teams.microsoft.com") || hostMatches(host, "teams.live.com")) return "Microsoft Teams";
    if (hostMatches(host, "zoom.us")) return "Zoom";
    if (hostMatches(host, "webex.com")) return "Webex";
    return "External meeting";
  } catch {
    return "External meeting";
  }
}

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function interviewTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function RecruiterInterviewsV2() {
  const searchParams = useSearchParams();
  const [applicationId, setApplicationId] = useState(searchParams.get("application") ?? "");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [timeZone, setTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata");
  const [meetingLink, setMeetingLink] = useState("");
  const [agenda, setAgenda] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<ScheduledInterview | null>(null);
  const [upcoming, setUpcoming] = useState<ScheduledInterview[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const provider = useMemo(() => providerLabel(meetingLink), [meetingLink]);

  const loadUpcoming = async () => {
    setListLoading(true);
    try {
      setUpcoming(await apiClient<ScheduledInterview[]>("/api/recruiter/interviews/upcoming"));
      setListError("");
    } catch (caught) {
      setListError(caught instanceof Error ? caught.message : "Upcoming interviews could not be loaded.");
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    void loadUpcoming();
  }, []);

  const validate = () => {
    setError("");
    if (!applicationId.trim()) return "Choose an application before scheduling the interview.";
    if (!scheduledAt) return "Choose the interview date and time.";
    if (!isHttpsUrl(meetingLink)) return "Enter a valid HTTPS external meeting URL.";
    const instant = new Date(scheduledAt);
    if (Number.isNaN(instant.getTime()) || instant.getTime() <= Date.now()) return "Choose a future interview date and time.";
    return "";
  };

  const beginReview = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreated(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setReviewing(true);
  };

  const confirmSchedule = async () => {
    const validationError = validate();
    if (validationError) {
      setReviewing(false);
      setError(validationError);
      return;
    }

    const instant = new Date(scheduledAt);
    setSubmitting(true);
    setError("");
    try {
      const response = await apiClient<ScheduledInterview>("/api/recruiter/interviews", {
        method: "POST",
        body: JSON.stringify({
          applicationId: applicationId.trim(),
          platformName: provider,
          meetingLink: meetingLink.trim(),
          scheduledAt: instant.toISOString(),
          durationMinutes,
          timeZone: timeZone.trim() || "UTC",
          agenda: agenda.trim() || null,
          panelRecruiterIds: [],
        }),
      });
      setCreated(response);
      setReviewing(false);
      setScheduledAt("");
      setMeetingLink("");
      setAgenda("");
      await loadUpcoming();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not schedule the interview.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WorkspaceShell
      workspace="recruiter"
      active="interviews"
      title="Interviews"
      description="Schedule interviews and keep the next candidate conversations visible in one workspace."
    >
      <div className={styles.layout}>
        <section className={styles.panel}>
          <h2>Schedule interview</h2>
          <p className={styles.intro}>
            SapienWorx stores the interview details and external meeting URL. It does not create or control the meeting room.
          </p>

          <form className={styles.form} onSubmit={beginReview}>
            <label className={styles.field}>
              <span>Application ID</span>
              <input className={styles.input} value={applicationId} onChange={(event) => { setApplicationId(event.target.value); setReviewing(false); }} placeholder="Select from a candidate pipeline card" required />
              <small className={styles.hint}>When opened from Pipeline this is filled automatically.</small>
            </label>

            <div className={styles.grid}>
              <label className={styles.field}>
                <span>Interview date and time</span>
                <input className={styles.input} type="datetime-local" value={scheduledAt} onChange={(event) => { setScheduledAt(event.target.value); setReviewing(false); }} required />
              </label>
              <label className={styles.field}>
                <span>Duration</span>
                <select className={styles.select} value={durationMinutes} onChange={(event) => { setDurationMinutes(Number(event.target.value)); setReviewing(false); }}>
                  {[30, 45, 60, 90, 120].map((value) => <option value={value} key={value}>{value} minutes</option>)}
                </select>
              </label>
            </div>

            <label className={styles.field}>
              <span>Timezone</span>
              <input className={styles.input} value={timeZone} onChange={(event) => { setTimeZone(event.target.value); setReviewing(false); }} placeholder="Asia/Kolkata" />
            </label>

            <label className={styles.field}>
              <span>External meeting URL</span>
              <input className={styles.input} type="url" value={meetingLink} onChange={(event) => { setMeetingLink(event.target.value); setReviewing(false); }} placeholder="https://meet.google.com/..." required />
              <small className={styles.hint}>Paste an HTTPS link from Meet, Teams, Zoom, Webex or another external provider.</small>
              {meetingLink && isHttpsUrl(meetingLink) && <span className={styles.provider}>{provider} ↗</span>}
            </label>

            <label className={styles.field}>
              <span>Candidate instructions / agenda</span>
              <textarea className={styles.textarea} value={agenda} onChange={(event) => { setAgenda(event.target.value); setReviewing(false); }} placeholder="What should the candidate prepare?" />
            </label>

            <div className={styles.notificationNote}>
              <strong>Candidate notification</strong>
              <span>The candidate is notified only after you review these details and explicitly confirm the schedule.</span>
            </div>

            {error && <p className={styles.error} role="alert">{error}</p>}
            {created && <div className={styles.success} role="status"><strong>Interview scheduled and candidate notified.</strong>{created.candidateName} · {created.jobTitle}</div>}

            {!reviewing && <div className={styles.actions}>
              <button className={styles.primary} type="submit">Review interview</button>
              <a className={styles.secondary} href="/recruiter/pipeline">Back to pipeline</a>
            </div>}
          </form>

          {reviewing && <section className={styles.confirmation} aria-label="Confirm interview details">
            <div className={styles.confirmationHeader}><div><span className="eyebrow">Final check</span><h3>Confirm before notifying the candidate</h3></div><button type="button" onClick={() => setReviewing(false)}>Edit</button></div>
            <dl className={styles.reviewGrid}>
              <div><dt>Application</dt><dd>{applicationId}</dd></div>
              <div><dt>Date and time</dt><dd>{interviewTime(scheduledAt)}</dd></div>
              <div><dt>Duration</dt><dd>{durationMinutes} minutes</dd></div>
              <div><dt>Timezone</dt><dd>{timeZone || "UTC"}</dd></div>
              <div><dt>Provider</dt><dd>{provider}</dd></div>
              <div><dt>Meeting URL</dt><dd className={styles.urlValue}>{meetingLink}</dd></div>
              <div className={styles.reviewWide}><dt>Candidate instructions</dt><dd>{agenda.trim() || "No additional instructions"}</dd></div>
            </dl>
            <p className={styles.confirmationWarning}>Selecting Confirm & notify will create the interview and immediately send the current interview details and meeting link through the existing candidate notification workflow.</p>
            <div className={styles.actions}>
              <button className={styles.primary} type="button" disabled={submitting} onClick={() => void confirmSchedule()}>{submitting ? "Scheduling & notifying…" : "Confirm & notify candidate"}</button>
              <button className={styles.secondary} type="button" onClick={() => setReviewing(false)} disabled={submitting}>Back to edit</button>
            </div>
          </section>}
        </section>

        <aside className={styles.aside}>
          <h2>Upcoming interviews</h2>
          <p className={styles.intro}>Your next scheduled candidate conversations.</p>
          {listError && <p className={styles.error} role="alert">{listError}</p>}
          <div className={styles.upcomingList} aria-live="polite">
            {listLoading ? <p className={styles.empty}>Loading upcoming interviews…</p> : upcoming.length ? upcoming.map((item) => <article className={styles.upcomingCard} key={`${item.candidateName}-${item.scheduledAt}`}><time>{interviewTime(item.scheduledAt)}</time><strong>{item.candidateName}</strong><span>{item.jobTitle} · {item.platformName}</span><small>{item.durationMinutes} minutes</small>{isHttpsUrl(item.meetingLink) && <a href={item.meetingLink} target="_blank" rel="noreferrer">Join meeting ↗</a>}</article>) : !listError ? <p className={styles.empty}>No upcoming interviews.</p> : null}
          </div>
          <p className={styles.providerNote}><strong>External-provider safe.</strong> SapienWorx stores only the meeting URL and interview metadata; the meeting remains with its provider.</p>
        </aside>
      </div>
    </WorkspaceShell>
  );
}
