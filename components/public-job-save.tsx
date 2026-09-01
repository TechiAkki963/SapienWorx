"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";

type SavedJob = { jobId: string; savedAt: string };

let savedJobsRequest: Promise<Set<string>> | null = null;

function loadSavedJobs() {
  if (!savedJobsRequest) {
    savedJobsRequest = apiClient<SavedJob[]>("/api/candidate/saved-jobs")
      .then((jobs) => new Set(jobs.map((job) => job.jobId)))
      .catch((error) => {
        savedJobsRequest = null;
        throw error;
      });
  }
  return savedJobsRequest;
}

function needsCandidateSignIn(reason: unknown) {
  if (!(reason instanceof Error)) return false;
  return [
    "Sign in to continue.",
    "This page is available only to your signed-in account.",
  ].includes(reason.message);
}

export function PublicJobSave({ jobId, jobTitle, signInHref = "/login" }: { jobId: string; jobTitle: string; signInHref?: string }) {
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(true);
  const [signInRequired, setSignInRequired] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void loadSavedJobs()
      .then((savedJobs) => { if (active) setSaved(savedJobs.has(jobId)); })
      .catch((reason) => { if (active && needsCandidateSignIn(reason)) setSignInRequired(true); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [jobId]);

  async function toggle() {
    setPending(true);
    setError("");
    try {
      if (saved) await apiClient<void>(`/api/candidate/saved-jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
      else await apiClient<SavedJob>(`/api/candidate/saved-jobs/${encodeURIComponent(jobId)}`, { method: "POST" });
      setSaved((current) => !current);
      savedJobsRequest = null;
    } catch (reason) {
      if (needsCandidateSignIn(reason)) setSignInRequired(true);
      else setError(reason instanceof Error ? reason.message : "The job could not be saved.");
    } finally { setPending(false); }
  }

  if (signInRequired) return <Link className="public-job-signin-save" href={signInHref}>Sign in to save</Link>;
  return <span className="public-job-save-wrap"><button className={`public-job-save${saved ? " saved" : ""}`} type="button" aria-label={`${saved ? "Remove" : "Save"} ${jobTitle}`} aria-pressed={saved} disabled={checking || pending} onClick={() => void toggle()}>{saved ? "♥ Saved" : "♡ Save"}</button>{error && <small role="alert">{error}</small>}</span>;
}
