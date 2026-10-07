"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useJobSave } from "@/components/candidate/use-job-save";

import { ReferSomeone } from "./refer-someone";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

export function JobActions({
  jobId,
  referralEnabled = false,
  jobTitle = "this role",
  companyName = "the employer",
  location,
  isCandidate,
  initialSaved = false,
  initialApplied = false,
  acceptingApplications = true,
  applicationStateAvailable = true,
}: {
  jobId: string;
  referralEnabled?: boolean;
  jobTitle?: string;
  companyName?: string;
  location?: string;
  isCandidate: boolean;
  initialSaved?: boolean;
  initialApplied?: boolean;
  acceptingApplications?: boolean;
  applicationStateAvailable?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [applying, setApplying] = useState(false);
  const {
    saved,
    busy: saving,
    error: saveError,
    toggle: save,
  } = useJobSave(jobId, initialSaved);
  const router = useRouter();
  const [applied, setApplied] = useState(initialApplied);
  const [pendingReferral,setPendingReferral]=useState(false),[referralContextReady,setReferralContextReady]=useState(false);
  useEffect(()=>{try{setPendingReferral(sessionStorage.getItem("swx.pending.referral.job")===jobId&&!!sessionStorage.getItem("swx.pending.referral"))}catch{setPendingReferral(false)}finally{setReferralContextReady(true)}},[jobId]);
  useEffect(() => setApplied(initialApplied), [initialApplied]);

  if (!isCandidate) {
    return (
      <div className="grid gap-3">
        <Button href={`/login?next=${encodeURIComponent(pendingReferral?"/referrals":`/jobs/${jobId}`)}`} size="lg">
          Sign in to apply
        </Button>
        <p className="text-center text-xs leading-5 text-ink-muted">
          New to SapienWorx?{" "}
          <Link
            className="font-semibold text-indigo hover:underline"
            href={`/signup?next=${encodeURIComponent(pendingReferral?"/referrals":`/jobs/${jobId}`)}`}
          >
            Create a candidate profile
          </Link>
          .
        </p>
      </div>
    );
  }

  async function apply() {
    if (
      pendingReferral ||
      !referralContextReady ||
      applied ||
      applying ||
      !acceptingApplications ||
      !applicationStateAvailable
    )
      return;
    setApplying(true);
    setMessage("");
    try {
      await apiRequest("/api/v1/candidate/applications", {
        method: "POST",
        body: JSON.stringify({ job_id: jobId }),
      });
      setApplied(true);
      setMessage("Application added to your tracker.");
      router.refresh();
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Could not apply to this role.",
      );
    } finally {
      setApplying(false);
    }
  }

  async function share(){
    setMessage("");
    const url=`${window.location.origin}/jobs/${encodeURIComponent(jobId)}`;
    try { await navigator.clipboard.writeText(url);setMessage("Job link copied. Sharing a link creates no referral record.") }
    catch {setMessage(`Share this job link: ${url}`)}
  }
  return (
    <div className="grid gap-3">
      {pendingReferral?<Button href="/referrals" size="lg">Review referral invitation</Button>:<Button
        size="lg"
        onClick={apply}
        disabled={
          !referralContextReady ||
          applying ||
          applied ||
          !acceptingApplications ||
          !applicationStateAvailable
        }
      >
        {applied
          ? "Applied ✓"
          : !acceptingApplications
            ? "Applications closed"
            : !applicationStateAvailable
              ? "Application status unavailable"
              : applying
                ? "Applying…"
                : !referralContextReady?"Checking application…":"Apply now"}
      </Button>}
      <Button
        size="lg"
        variant="secondary"
        onClick={save}
        disabled={saving}
        aria-pressed={saved}
      >
        {saving ? "Updating…" : saved ? "Remove from saved jobs" : "Save job"}
      </Button>
      <div className="grid grid-cols-2 gap-2"><button type="button" className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink" onClick={()=>void share()}>Share</button>{referralEnabled&&acceptingApplications&&<ReferSomeone jobId={jobId} title={jobTitle} company={companyName} location={location}/>}</div>
      {saveError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {saveError}
        </p>
      )}
      {message && (
        <p
          className="rounded-2xl bg-indigo-soft/45 px-4 py-3 text-sm leading-5 text-ink"
          role="status"
        >
          {message}
        </p>
      )}
    </div>
  );
}
