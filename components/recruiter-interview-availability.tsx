"use client";

import { useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";
import { Button, WorkspaceShell } from "./ui";
import styles from "./recruiter-interview-availability.module.css";

type SlotDraft = { startsAt: string; durationMinutes: string; timeZone: string; externalMeetingUrl: string };
const emptySlot = (): SlotDraft => ({ startsAt: "", durationMinutes: "30", timeZone: "Asia/Kolkata", externalMeetingUrl: "" });

export function RecruiterInterviewAvailability({ applicationId }: { applicationId: string }) {
  const [slots, setSlots] = useState<SlotDraft[]>([emptySlot()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const validCount = useMemo(() => slots.filter((slot) => slot.startsAt && slot.externalMeetingUrl.trim()).length, [slots]);

  const update = (index: number, patch: Partial<SlotDraft>) => setSlots((current) => current.map((slot, slotIndex) => slotIndex === index ? { ...slot, ...patch } : slot));
  const submit = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const payload = slots.filter((slot) => slot.startsAt && slot.externalMeetingUrl.trim()).map((slot) => ({
        startsAt: new Date(slot.startsAt).toISOString(),
        durationMinutes: Number(slot.durationMinutes) || 30,
        timeZone: slot.timeZone.trim() || "Asia/Kolkata",
        externalMeetingUrl: slot.externalMeetingUrl.trim(),
      }));
      if (!payload.length) { setError("Add at least one complete interview slot."); return; }
      const result = await apiClient<{ created: number }>(`/api/recruiter/evolution/applications/${applicationId}/interview-slots`, { method: "POST", body: JSON.stringify({ slots: payload }) });
      setNotice(`${result.created} interview slot${result.created === 1 ? "" : "s"} shared with the candidate.`);
      setSlots([emptySlot()]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Interview availability could not be saved."); }
    finally { setBusy(false); }
  };

  return <WorkspaceShell workspace="recruiter" active="interviews" title="Candidate self-scheduling" description="Offer a small set of interview times. SapienWorx stores the schedule and your externally created meeting URL; it does not connect to a meeting provider." actions={<Button href="/recruiter/interviews" variant="secondary">Interviews</Button>}>
    <div className={styles.stack}>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      <section className={styles.guidance}><div><span className="eyebrow">v5 Structured Hiring</span><h2>Give the candidate a clear choice.</h2><p>Add up to 20 future slots. Each slot uses an external HTTPS meeting URL you create separately. The URL is only surfaced to the candidate after they book.</p></div><div><strong>{validCount}</strong><span>ready to share</span></div></section>
      <section className={styles.panel}>
        <header><div><h2>Interview availability</h2><p>Use the same meeting URL for multiple options or provide a separate URL per slot.</p></div><Button variant="secondary" onClick={() => setSlots((current) => current.length >= 20 ? current : [...current, emptySlot()])} disabled={slots.length >= 20}>Add slot</Button></header>
        <div className={styles.slots}>{slots.map((slot, index) => <article key={index}><div className={styles.index}>{index + 1}</div><label><span>Date & time</span><input type="datetime-local" value={slot.startsAt} onChange={(event) => update(index, { startsAt: event.target.value })}/></label><label><span>Duration</span><select value={slot.durationMinutes} onChange={(event) => update(index, { durationMinutes: event.target.value })}><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option><option value="90">90 min</option></select></label><label><span>Time zone</span><input value={slot.timeZone} onChange={(event) => update(index, { timeZone: event.target.value })}/></label><label className={styles.url}><span>External meeting URL</span><input type="url" inputMode="url" placeholder="https://..." value={slot.externalMeetingUrl} onChange={(event) => update(index, { externalMeetingUrl: event.target.value })}/></label><Button variant="quiet" onClick={() => setSlots((current) => current.length === 1 ? [emptySlot()] : current.filter((_, slotIndex) => slotIndex !== index))}>Remove</Button></article>)}</div>
        <footer><p>The candidate sees available times, duration and time zone. The meeting URL stays hidden until booking.</p><Button disabled={busy || !validCount} onClick={() => void submit()}>{busy ? "Sharing…" : `Share ${validCount || ""} slot${validCount === 1 ? "" : "s"}`}</Button></footer>
      </section>
    </div>
  </WorkspaceShell>;
}
