"use client";

import Link from "next/link";
import { useEffect, useState } from "react";



import {JobApplyButton} from "./job-apply-button";
import {useOptionalCandidateWorkspace} from "./candidate-workspace-state";
import {apiRequest} from "@/lib/api";
import {JobSaveButton} from "./job-save-button";
import { JobShareButton } from "./job-share-button";
import { ReferSomeone } from "./refer-someone";
import { Button } from "@/components/ui/button";


export function JobActions({
  jobId,
  canonicalUrl,
  referralEnabled = false,
  referralRewardEnabled = false,
  referralTerms = "",
  referralEligibility = "",
  jobTitle = "this role",
  companyName = "the employer",
  location,
  isCandidate,
  initialSaved = false,
  acceptingApplications = true,
}: {
  jobId: string;
  canonicalUrl?: string;
  referralEnabled?: boolean;
  referralRewardEnabled?: boolean;
  referralTerms?: string;
  referralEligibility?: string;
  jobTitle?: string;
  companyName?: string;
  location?: string;
  isCandidate: boolean;
  initialSaved?: boolean;
  initialApplied?: boolean;
  acceptingApplications?: boolean;
  applicationStateAvailable?: boolean;
}) {
  const workspace=useOptionalCandidateWorkspace();
 useEffect(()=>{if(!isCandidate||!workspace?.identity?.product_analytics_enabled)return;let sent=false;const viewed=()=>{if(sent||document.visibilityState!=="visible")return;sent=true;void apiRequest("/api/v1/candidate/job-events",{method:"POST",body:JSON.stringify({job_id:jobId,event:"job_detail_viewed"})}).catch(()=>{})};viewed();document.addEventListener("visibilitychange",viewed);return()=>document.removeEventListener("visibilitychange",viewed)},[jobId,isCandidate,workspace?.identity?.product_analytics_enabled]);
  const [pendingReferral,setPendingReferral]=useState(false);
  useEffect(()=>{try{setPendingReferral(sessionStorage.getItem("swx.pending.referral.job")===jobId&&!!sessionStorage.getItem("swx.pending.referral"))}catch{setPendingReferral(false)}},[jobId]);

  if (!isCandidate) {
    return (
      <div className="candidate-detail-actions grid gap-3">
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
        <JobShareButton jobId={jobId} jobTitle={jobTitle} companyName={companyName} canonicalUrl={canonicalUrl}/>
      </div>
    );
  }

  return (
    <div className="candidate-detail-actions grid gap-3">
      <div className="candidate-job-card-actions"><JobSaveButton jobId={jobId} initialSaved={initialSaved} iconOnly/><JobApplyButton jobId={jobId} jobTitle={jobTitle} companyName={companyName} detail/></div>
      {referralEnabled&&acceptingApplications&&<ReferSomeone jobId={jobId} title={jobTitle} company={companyName} location={location} terms={referralTerms} eligibility={referralEligibility} rewardEnabled={referralRewardEnabled}/>}
      {referralEnabled&&referralRewardEnabled&&acceptingApplications&&<p className="text-[13px] leading-6 text-ink-muted">Referral reward programme available. Employer eligibility and terms apply; submitting an invitation does not guarantee a reward.</p>}
      <JobShareButton jobId={jobId} jobTitle={jobTitle} companyName={companyName} canonicalUrl={canonicalUrl}/>

    </div>
  );
}
