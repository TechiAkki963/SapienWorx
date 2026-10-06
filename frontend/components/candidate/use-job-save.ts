"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { apiRequest } from "@/lib/api";

const savedEvent = "sapienworx:saved-job-changed";
type SavedChange = { jobId: string; saved: boolean; busy: boolean };
const pendingJobs = new Set<string>();

// Share immediate feedback between duplicate cards; persisted state always comes
// from the candidate-scoped API rather than browser storage.
export function useJobSave(jobId: string, initialSaved = false) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  useEffect(() => {
    if (!inFlight.current) setSaved(initialSaved);
  }, [initialSaved]);
  useEffect(() => {
    const update = (event: Event) => {
      const change = (event as CustomEvent<SavedChange>).detail;
      if (change.jobId === jobId && !inFlight.current) {
        setSaved(change.saved);
        setBusy(change.busy);
      }
    };
    window.addEventListener(savedEvent, update);
    return () => window.removeEventListener(savedEvent, update);
  }, [jobId]);

  async function toggle() {
    if (inFlight.current || pendingJobs.has(jobId)) return;
    const previous = saved;
    const desired = !previous;
    inFlight.current = true;
    pendingJobs.add(jobId);
    setBusy(true);
    setError("");
    setSaved(desired);
    let confirmed = desired;
    let mutationComplete = false;
    const publish = (value: boolean, pending = true) =>
      window.dispatchEvent(
        new CustomEvent<SavedChange>(savedEvent, {
          detail: { jobId, saved: value, busy: pending },
        }),
      );
    publish(desired);
    try {
      await apiRequest(
        `/api/v1/candidate/saved-jobs/${encodeURIComponent(jobId)}`,
        { method: desired ? "PUT" : "DELETE" },
      );
      mutationComplete = true;
      const result = await apiRequest<{ items: { id: string }[] | null }>(
        "/api/v1/candidate/saved-jobs",
      );
      const persisted = (result.items ?? []).some((item) => item.id === jobId);
      confirmed = persisted;
      setSaved(persisted);
      publish(persisted);
      if (persisted !== desired)
        setError(
          "The saved-job list changed. Your current saved status has been restored.",
        );
      router.refresh();
    } catch (cause) {
      confirmed = mutationComplete ? desired : previous;
      setSaved(confirmed);
      publish(confirmed);
      setError(
        mutationComplete
          ? "Your change was saved, but the shortlist couldn’t be refreshed. Please reload to confirm."
          : cause instanceof Error
            ? cause.message
            : "Could not update this saved job. Try again.",
      );
      if (mutationComplete) router.refresh();
    } finally {
      inFlight.current = false;
      pendingJobs.delete(jobId);
      setBusy(false);
      publish(confirmed, false);
    }
  }

  return { saved, busy, error, toggle };
}
