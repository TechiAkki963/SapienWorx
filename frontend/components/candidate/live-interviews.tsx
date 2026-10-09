"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Surface } from "@/components/ui/surface";
import { CandidateInterview } from "@/lib/candidate";
import { apiRequest } from "@/lib/api";
import { candidateDate, safeMeetingURL } from "./workspace-job-utils";

function interviewLabel(item: CandidateInterview, overdue = false) {
  if (item.status === "scheduled")
    return overdue
      ? "Awaiting status update"
      : item.rescheduled
        ? "Rescheduled"
        : "Upcoming";
  return (
    (
      {
        completed: "Completed",
        cancelled: "Cancelled",
        no_show: "Not attended",
      } as Record<string, string>
    )[item.status] ?? "Status update"
  );
}
const escapeICS = (value: string) =>
  value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replace(/\r?\n/g, "\\n");
const calendarDate = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
function downloadCalendar(item: CandidateInterview) {
  const start = new Date(item.scheduled_at);
  if (!Number.isFinite(start.getTime())) return;
  const end = new Date(start.getTime() + item.duration_minutes * 60000);
  const meetingURL = safeMeetingURL(item.meeting_url);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SapienWorx//Candidate Interviews//EN",
    "BEGIN:VEVENT",
    `UID:${escapeICS(item.id)}@sapienworx.com`,
    `DTSTAMP:${calendarDate(new Date())}`,
    `DTSTART:${calendarDate(start)}`,
    `DTEND:${calendarDate(end)}`,
    `SUMMARY:${escapeICS(`${item.round_label || "Interview"}: ${item.job_title}`)}`,
    `DESCRIPTION:${escapeICS(`Interview with ${item.company_name}. ${meetingURL || "Check SapienWorx for meeting details."}`)}`,
    ...(meetingURL ? [`URL:${meetingURL}`] : []),
    ...(item.location ? [`LOCATION:${escapeICS(item.location)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];
  const url = URL.createObjectURL(
    new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "sapienworx-interview.ics";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LiveInterviews({
  initialItems,
}: {
  initialItems: CandidateInterview[];
}) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const requestVersion = useRef(0);
  const mounted = useRef(true);
  useEffect(() => setItems(initialItems), [initialItems]);
  async function refresh() {
    const version = ++requestVersion.current;
    setBusy(true);
    try {
      const result = await apiRequest<{ items: CandidateInterview[] | null }>(
        "/api/v1/candidate/interviews",
      );
      if (mounted.current && version === requestVersion.current) {
        setItems(result.items ?? []);
        setError("");
      }
    } catch (cause) {
      if (mounted.current && version === requestVersion.current)
        setError(
          cause instanceof Error
            ? `Schedule updates couldn’t be loaded: ${cause.message}`
            : "Schedule updates couldn’t be loaded. Your last available schedule is shown.",
        );
    } finally {
      if (mounted.current && version === requestVersion.current) setBusy(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    setNow(Date.now());
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible") void refresh();
    }, 10000);
    return () => {
      mounted.current = false;
      ++requestVersion.current;
      window.clearInterval(timer);
    };
  }, []);
  return (
    <div className="mt-6 min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <p>Times shown in India Standard Time (Asia/Kolkata).</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="min-h-11 rounded-lg px-3 font-semibold text-indigo hover:bg-indigo-soft/40 disabled:opacity-50"
        >
          {busy ? "Refreshing…" : "Refresh interviews"}
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-xl bg-peach/40 p-3 text-sm text-ink"
        >
          {error}
        </p>
      )}
      {!items.length ? (
        <Surface className="p-8 text-center" tone="mint">
          <h2 className="text-xl font-bold text-navy">
            No interviews scheduled yet.
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            When a recruiter schedules an interview, it will appear here
            automatically.
          </p>
          <Link
            href="/candidate/applications"
            className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-indigo hover:underline"
          >
            View applications
          </Link>
        </Surface>
      ) : (
        <div className="grid min-w-0 gap-4">
          {items.map((item) => {
            const meetingURL = safeMeetingURL(item.meeting_url);
            const validDate = Number.isFinite(
              new Date(item.scheduled_at).getTime(),
            );
            const scheduled = item.status === "scheduled";
            const overdue =
              validDate &&
              now !== null &&
              new Date(item.scheduled_at).getTime() +
                item.duration_minutes * 60000 <
                now;
            return (
              <Surface key={item.id} className="min-w-0 p-5 sm:p-6">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-indigo">
                      {item.round_label || "Interview"} ·{" "}
                      {item.mode === "online" || !item.mode
                        ? "Online"
                        : ({ video: "Video", phone: "Phone", in_person: "In-person" } as Record<string,string>)[item.mode] || item.mode}
                    </p>
                    <h2 className="mt-2 break-words text-xl font-bold text-navy">
                      {item.job_title || "Role unavailable"}
                    </h2>
                    <p className="mt-1 text-sm text-ink-muted">
                      {item.company_name || "Company unavailable"}
                    </p>
                  </div>
                  <span className="rounded-full bg-indigo-soft/70 px-3 py-1.5 text-xs font-bold text-indigo">
                    {interviewLabel(item, overdue)}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-1 gap-3 min-[428px]:grid-cols-2">
                  <div>
                    <dt className="text-xs text-ink-muted">Date and time</dt>
                    <dd className="mt-1 text-sm font-semibold text-ink">
                      {candidateDate(item.scheduled_at, true)} IST
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">Duration</dt>
                    <dd className="mt-1 text-sm font-semibold text-ink">
                      {item.duration_minutes} minutes
                    </dd>
                  </div>
                </dl>
                <details className="mt-4 rounded-xl border border-line">
                  <summary className="cursor-pointer p-3 text-sm font-semibold text-ink">
                    Interview details
                  </summary>
                  <div className="border-t border-line p-3 text-sm text-ink-muted">
                    <p>
                      Scheduled instant:{" "}
                      {validDate
                        ? candidateDate(item.scheduled_at, true, "UTC")
                        : "Date unavailable"}{" "}
                      UTC.
                    </p>
                    <p className="mt-2">
                      {scheduled
                        ? "Use the meeting link provided by your recruiter. For a schedule change, discuss it in your existing conversation."
                        : "This interview is retained in your schedule history."}
                    </p>
                    {item.location && <p className="mt-2">{item.mode === "phone" ? "Call instructions" : "Location"}: {item.location}</p>}
                    {item.time_zone && item.time_zone !== "Asia/Kolkata" && <p className="mt-2">Organizer time: {candidateDate(item.scheduled_at, true, item.time_zone)} · {item.time_zone}</p>}
                    {scheduled && !meetingURL && (!item.mode || item.mode === "video" || item.mode === "online") && (
                      <p className="mt-2">
                        A valid meeting link isn’t available. Contact the
                        recruiter in your inbox.
                      </p>
                    )}
                  </div>
                </details>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line/60 pt-3">
                  <Link
                    href={`/candidate/jobs/${item.job_id}`}
                    className="inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-sm font-semibold text-ink"
                  >
                    View role
                  </Link>
                  {scheduled && validDate && !overdue && (
                    <button
                      type="button"
                      className="min-h-11 rounded-lg border border-line px-3 text-sm font-semibold text-ink"
                      onClick={() => downloadCalendar(item)}
                    >
                      Add to calendar
                    </button>
                  )}
                  {scheduled && meetingURL && !overdue && (
                    <a
                      href={meetingURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center rounded-lg bg-indigo px-4 text-sm font-semibold text-white"
                    >
                      Join interview
                      <span className="sr-only"> (opens a new tab)</span>
                    </a>
                  )}
                  {scheduled && (
                    <Link
                      href="/candidate/inbox"
                      className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-indigo hover:underline"
                    >
                      Discuss a schedule change
                    </Link>
                  )}
                </div>
              </Surface>
            );
          })}
        </div>
      )}
    </div>
  );
}
