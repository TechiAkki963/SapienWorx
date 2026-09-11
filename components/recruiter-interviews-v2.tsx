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

function providerLabel(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (host.includes("meet.google.com")) return "Google Meet";
    if (host.includes("teams.microsoft.com") || host.includes("teams.live.com")) return "Microsoft Teams";
    if (host.includes("zoom.us")) return "Zoom";
    if (host.includes("webex.com")) return "Webex";
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

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setCreated(null);

    if (!applicationId.trim()) return setError("Choose an application before scheduling the interview.");
    if (!scheduledAt) return setError("Choose the interview date and time.");
    if (!isHttpsUrl(meetingLink)) return setError("Enter a valid HTTPS external meeting URL.");

    const instant = new Date(scheduledAt);
    if (Number.isNaN(instant.getTime()) || instant.getTime() <= Date.now()) {
      return setError("Choose a future interview date and time.");
    }

    setSubmitting(true);
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

          <form className={styles.form} onSubmit={submit}>
            <label className={styles.field}>
              <span>Application ID</span>
              <input
                className={styles.input}
                value={applicationId}
                onChange={(event) => setApplicationId(event.target.value)}
                placeholder="Select from a candidate pipeline card"
                required
              />
              <small className={styles.hint}>When opened from Pipeline this is filled automatically.</small>
            </label>

            <div className={styles.grid}>
              <label className={styles.field}>
                <span>Interview date and time</span>
                <input
                  className={styles.input}
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Duration</span>
                <select
                  className={styles.select}
                  value={durationMinutes}
                  onChange={(event) => setDurationMinutes(Number(event.target.value))}
                >
                  {[30, 45, 60, 90, 120].map((value) => (
                    <option value={value} key={value}>{value} minutes</option>
                  ))}
                </select>
              </label>
            </div>

            <label className={styles.field}>
              <span>Timezone</span>
              <input
                className={styles.input}
                value={timeZone}
                onChange={(event) => setTimeZone(event.target.value)}
                placeholder="Asia/Kolkata"
              />
            </label>

            <label className={styles.field}>
              <span>External meeting URL</span>
              <input
                className={styles.input}
                type="url"
                value={meetingLink}
                onChange={(event) => setMeetingLink(event.target.value)}
                placeholder="https://meet.google.com/..."
                required
              />
              <small className={styles.hint}>Use an HTTPS link from Meet, Teams, Zoom, Webex or another provider.</small>
              {meetingLink && isHttpsUrl(meetingLink) && <span className={styles.provider}>{provider} ↗</span>}
            </label>

            <label className={styles.field}>
              <span>Candidate instructions / agenda</span>
              <textarea
                className={styles.textarea}
                value={agenda}
                onChange={(event) => setAgenda(event.target.value)}
                placeholder="What should the candidate prepare?"
              />
            </label>

            <div className={styles.notificationNote}>
              <strong>Candidate notification</strong>
              <span>Scheduling uses the current recruiter interview workflow, which sends the candidate the interview details and external meeting link.</span>
            </div>

            {error && <p className={styles.error} role="alert">{error}</p>}
            {created && (
              <div className={styles.success} role="status">
                <strong>Interview scheduled and candidate notified.</strong>
                {created.candidateName} · {created.jobTitle}
              </div>
            )}

            <div className={styles.actions}>
              <button className={styles.primary} disabled={submitting} type="submit">
                {submitting ? "Scheduling & notifying…" : "Schedule & notify candidate"}
              </button>
              <a className={styles.secondary} href="/recruiter/pipeline">Back to pipeline</a>
            </div>
          </form>
        </section>

        <aside className={styles.aside}>
          <h2>Upcoming interviews</h2>
          <p className={styles.intro}>Your next scheduled candidate conversations.</p>
          {listError && <p className={styles.error} role="alert">{listError}</p>}
          <div className={styles.upcomingList} aria-live="polite">
            {listLoading ? (
              <p className={styles.empty}>Loading upcoming interviews…</p>
            ) : upcoming.length ? (
              upcoming.map((item) => (
                <article className={styles.upcomingCard} key={`${item.candidateName}-${item.scheduledAt}`}>
                  <time>{interviewTime(item.scheduledAt)}</time>
                  <strong>{item.candidateName}</strong>
                  <span>{item.jobTitle} · {item.platformName}</span>
                  <small>{item.durationMinutes} minutes</small>
                  {isHttpsUrl(item.meetingLink) && (
                    <a href={item.meetingLink} target="_blank" rel="noreferrer">Join meeting ↗</a>
                  )}
                </article>
              ))
            ) : !listError ? (
              <p className={styles.empty}>No upcoming interviews.</p>
            ) : null}
          </div>
          <p className={styles.providerNote}>
            <strong>External-provider safe.</strong> SapienWorx stores only the meeting URL and interview metadata; the meeting remains with its provider.
          </p>
        </aside>
      </div>
    </WorkspaceShell>
  );
}
