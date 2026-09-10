"use client";

import { useMemo, useState } from "react";
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
  const provider = useMemo(() => providerLabel(meetingLink), [meetingLink]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setCreated(null);
    if (!applicationId.trim()) {
      setError("Choose an application before scheduling the interview.");
      return;
    }
    if (!scheduledAt) {
      setError("Choose the interview date and time.");
      return;
    }
    if (!isHttpsUrl(meetingLink)) {
      setError("Enter a valid HTTPS external meeting URL.");
      return;
    }
    const instant = new Date(scheduledAt);
    if (Number.isNaN(instant.getTime()) || instant.getTime() <= Date.now()) {
      setError("Choose a future interview date and time.");
      return;
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
      description="Schedule and manage SapienWorx interview records using meeting links created in external tools."
    >
      <div className={styles.layout}>
        <section className={styles.panel}>
          <h2>Schedule interview</h2>
          <p className={styles.intro}>SapienWorx stores the interview details and sends the external meeting link. It does not create or control the external meeting.</p>
          <form className={styles.form} onSubmit={submit}>
            <label className={styles.field}>
              <span>Application ID</span>
              <input className={styles.input} value={applicationId} onChange={(event) => setApplicationId(event.target.value)} placeholder="Select from a candidate pipeline card" required />
              <small className={styles.hint}>When opened from Pipeline this is filled automatically.</small>
            </label>
            <div className={styles.grid}>
              <label className={styles.field}>
                <span>Interview date and time</span>
                <input className={styles.input} aria-label="Interview date and time" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required />
              </label>
              <label className={styles.field}>
                <span>Duration</span>
                <select className={styles.select} value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}>
                  {[30, 45, 60, 90, 120].map((value) => <option value={value} key={value}>{value} minutes</option>)}
                </select>
              </label>
            </div>
            <label className={styles.field}>
              <span>Timezone</span>
              <input className={styles.input} value={timeZone} onChange={(event) => setTimeZone(event.target.value)} placeholder="Asia/Kolkata" />
            </label>
            <label className={styles.field}>
              <span>External meeting URL</span>
              <input className={styles.input} aria-label="External meeting URL" type="url" inputMode="url" value={meetingLink} onChange={(event) => setMeetingLink(event.target.value)} placeholder="https://meet.google.com/..." required />
              <small className={styles.hint}>The meeting must be created outside SapienWorx. HTTPS links from Meet, Teams, Zoom, Webex or another approved provider can be used.</small>
              {meetingLink && isHttpsUrl(meetingLink) && <span className={styles.provider}>{provider} ↗</span>}
            </label>
            <label className={styles.field}>
              <span>Candidate instructions / agenda</span>
              <textarea className={styles.textarea} value={agenda} onChange={(event) => setAgenda(event.target.value)} placeholder="What should the candidate prepare?" />
            </label>
            {error && <p className={styles.error} role="alert">{error}</p>}
            {created && <div className={styles.success} role="status"><strong>Interview scheduled ✓</strong>{created.candidateName} · {created.jobTitle}. The external meeting link is saved with the SapienWorx interview record.</div>}
            <div className={styles.actions}>
              <button className={styles.primary} disabled={submitting} type="submit">{submitting ? "Scheduling…" : "Schedule Interview"}</button>
              <a className={styles.secondary} href="/recruiter/pipeline">Back to pipeline</a>
            </div>
          </form>
        </section>
        <aside className={styles.aside}>
          <h2>How this works</h2>
          <ul>
            <li>Create the video meeting in your preferred external provider.</li>
            <li>Copy its HTTPS link into SapienWorx.</li>
            <li>SapienWorx stores the interview date, time and link.</li>
            <li>The candidate uses Join Interview to open the external provider.</li>
          </ul>
          <p><strong>No provider connection required.</strong> SapienWorx does not read Google or Outlook calendars and does not create Meet or Teams meetings.</p>
        </aside>
      </div>
    </WorkspaceShell>
  );
}
