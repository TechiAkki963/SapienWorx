"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

export function JobActions({ jobId, isCandidate }: { jobId: string; isCandidate: boolean }) {
  const [message, setMessage] = useState("");
  const [applying, setApplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!isCandidate) {
    return (
      <div className="grid gap-3">
        <Button href={`/login?next=/jobs/${jobId}`} size="lg">Sign in to apply</Button>
        <p className="text-center text-xs leading-5 text-ink-muted">New to SapienWorx? <Link className="font-semibold text-indigo hover:underline" href="/signup">Create a candidate profile</Link>.</p>
      </div>
    );
  }

  async function apply() {
    setApplying(true); setMessage("");
    try {
      await apiRequest("/api/v1/candidate/applications", { method: "POST", body: JSON.stringify({ job_id: jobId }) });
      setMessage("Application added to your tracker.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not apply to this role.");
    } finally { setApplying(false); }
  }

  async function save() {
    setSaving(true); setMessage("");
    try {
      await apiRequest(`/api/v1/candidate/saved-jobs/${jobId}`, { method: saved ? "DELETE" : "PUT" });
      setSaved((current) => !current);
      setMessage(saved ? "Removed from saved jobs." : "Saved for later.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not update saved jobs.");
    } finally { setSaving(false); }
  }

  return (
    <div className="grid gap-3">
      <Button size="lg" onClick={apply} disabled={applying}>{applying ? "Applying…" : "Apply now"}</Button>
      <Button size="lg" variant="secondary" onClick={save} disabled={saving}>{saving ? "Updating…" : saved ? "Saved ✓" : "Save job"}</Button>
      {message && <p className="rounded-2xl bg-indigo-soft/45 px-4 py-3 text-sm leading-5 text-ink" role="status">{message}</p>}
    </div>
  );
}
