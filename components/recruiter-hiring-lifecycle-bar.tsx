"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { Button } from "./ui";

type PipelineStage = "APPLIED" | "SCREENING" | "INTERVIEWING" | "FINAL_STAGE" | "OFFER" | "ONBOARDED" | "REJECTED";
type ApplicantLifecycle = {
  applicationId: string;
  fullName: string;
  jobTitle: string;
  pipelineStage: PipelineStage;
  currentUserCanManage: boolean;
  decisionReadiness: { offerReady: boolean; blockers: string[] };
};
type OfferWorkspace = { offer: null | { status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "WITHDRAWN" } };

const stages: Array<{ value: Exclude<PipelineStage, "REJECTED">; label: string }> = [
  { value: "APPLIED", label: "Applied" },
  { value: "SCREENING", label: "Screening" },
  { value: "INTERVIEWING", label: "Interview" },
  { value: "FINAL_STAGE", label: "Final" },
  { value: "OFFER", label: "Offer" },
  { value: "ONBOARDED", label: "Hired" },
];

export function RecruiterHiringLifecycleBar({ jobId, applicationId }: { jobId: string; applicationId: string }) {
  const [profile, setProfile] = useState<ApplicantLifecycle | null>(null);
  const [offer, setOffer] = useState<OfferWorkspace["offer"]>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const applicant = await apiClient<ApplicantLifecycle>(`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(applicationId)}`);
      setProfile(applicant);
      if (applicant.pipelineStage === "OFFER") {
        const workspace = await apiClient<OfferWorkspace>(`/api/recruiter/applications/${encodeURIComponent(applicationId)}/offer`);
        setOffer(workspace.offer);
      } else {
        setOffer(null);
      }
    } catch {
      // Candidate 360 owns the full-page error experience. This compact layer
      // should disappear rather than duplicate a second error panel.
      setProfile(null);
    }
  }, [applicationId, jobId]);

  useEffect(() => { void load(); }, [load]);

  const markHired = async () => {
    if (!profile?.currentUserCanManage || offer?.status !== "ACCEPTED") return;
    setPending(true);
    setError("");
    try {
      await apiClient(`/api/recruiter/pipeline/${encodeURIComponent(applicationId)}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stage: "ONBOARDED" }),
      });
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The hiring step could not be completed.");
      setPending(false);
    }
  };

  if (!profile) return null;

  const activeIndex = profile.pipelineStage === "REJECTED"
    ? -1
    : stages.findIndex((stage) => stage.value === profile.pipelineStage);
  const next = nextAction(profile, offer?.status ?? null);
  const accepted = profile.pipelineStage === "OFFER" && offer?.status === "ACCEPTED";

  return <section className={`hiring-lifecycle-bar${profile.pipelineStage === "REJECTED" ? " is-rejected" : ""}`} aria-label="Hiring workflow">
    <div className="hiring-lifecycle-heading">
      <div>
        <span className="eyebrow">Hiring workflow</span>
        <strong>{next.title}</strong>
        <small>{next.detail}</small>
      </div>
      {accepted && profile.currentUserCanManage && <Button onClick={() => void markHired()} disabled={pending}>{pending ? "Completing…" : "Mark as hired"}</Button>}
    </div>
    {error && <p className="job-publish-error" role="alert">{error}</p>}
    <ol className="hiring-lifecycle-steps">
      {stages.map((stage, index) => <li key={stage.value} className={index < activeIndex ? "complete" : index === activeIndex ? "current" : "upcoming"}>
        <span aria-hidden="true">{index < activeIndex ? "✓" : index + 1}</span>
        <b>{stage.label}</b>
      </li>)}
    </ol>
    {profile.pipelineStage === "REJECTED" && <p className="hiring-lifecycle-closed">Application closed · Reopen it through the stage control only if the hiring team intentionally wants to reconsider the candidate.</p>}
  </section>;
}

function nextAction(profile: ApplicantLifecycle, offerStatus: OfferWorkspace["offer"] extends infer _T ? string | null : never) {
  if (profile.pipelineStage === "REJECTED") return { title: "Application closed", detail: "The candidate is no longer in the active hiring workflow." };
  if (profile.pipelineStage === "ONBOARDED") return { title: "Hiring complete", detail: `${profile.fullName} has been marked as hired for ${profile.jobTitle}.` };
  if (profile.pipelineStage === "APPLIED") return { title: "Review the application", detail: "Confirm role fit, evidence and ownership before advancing to screening." };
  if (profile.pipelineStage === "SCREENING") return { title: "Schedule the first interview", detail: "Creating the interview will now advance this application to Interviewing automatically." };
  if (profile.pipelineStage === "INTERVIEWING") {
    return profile.decisionReadiness.offerReady
      ? { title: "Interview evidence is complete", detail: "The submitted scorecards meet the configured decision policy. Continue to the final decision or offer stage." }
      : { title: "Collect structured interview evidence", detail: profile.decisionReadiness.blockers[0] || "Complete the assigned scorecards before making the offer decision." };
  }
  if (profile.pipelineStage === "FINAL_STAGE") {
    return profile.decisionReadiness.offerReady
      ? { title: "Ready for offer decision", detail: "Required feedback and approvals are complete." }
      : { title: "Complete the final decision", detail: profile.decisionReadiness.blockers[0] || "Resolve outstanding scorecards before creating an offer." };
  }
  if (offerStatus === "ACCEPTED") return { title: "Offer accepted", detail: "The candidate accepted the offer. Mark as hired when the hiring team is ready to close the workflow." };
  if (offerStatus === "DECLINED") return { title: "Offer declined", detail: "Review the candidate response and close or intentionally reopen the application." };
  if (offerStatus === "SENT") return { title: "Awaiting candidate response", detail: "The offer has been sent. The application remains in Offer until the candidate responds." };
  if (offerStatus === "PENDING_APPROVAL") return { title: "Internal approval in progress", detail: "Complete the configured offer approvals before sending anything to the candidate." };
  if (offerStatus === "APPROVED") return { title: "Offer approved", detail: "The offer is ready to send securely to the candidate." };
  return { title: "Prepare the offer", detail: "Create or complete the private offer draft, approvals and candidate terms." };
}
