"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CandidateProfile, CandidateProfileDetails } from "@/lib/candidate";
import { candidateExperienceText, profileReadiness } from "@/lib/profile-readiness";
import { professionalProfileDocument } from "@/lib/profile-document";
import { apiRequest } from "@/lib/api";
import { CandidateAvatar } from "./candidate-avatar";
import { CandidatePhotoControls } from "./candidate-photo-controls";
import { CandidatePopover } from "./candidate-popover";
import { ProfileFactIcon } from "./profile-fact-icon";
import { WorkspaceDialog } from "./workspace-dialog";
import { useCandidateWorkspace } from "./candidate-workspace-state";
import {CareerIcon} from "./career-icon";
export function CandidateOverviewIdentity({profile,details}:{profile:CandidateProfile;details:CandidateProfileDetails|null}){
  const {identity,patchIdentity}=useCandidateWorkspace(),router=useRouter();
  const [confirmDiscovery,setConfirmDiscovery]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const current=details?.details.employment?.find(row=>["yes","true"].includes(String(row.current_company).toLowerCase()));
  const name=identity?.full_name||profile.full_name,phone=identity?.primary_phone||profile.phone,email=identity?.email||profile.email;
  const experience=candidateExperienceText(identity?.total_experience_months??profile.total_experience_months,details?.details.work_status,!!details?.details.employment?.length);
  const completion=Math.max(0,Math.min(100,identity?.profile_completion??profile.profile_completion));
  const discovery=identity?.discoverable_to_recruiters===true;
  const missing=details?profileReadiness(profile,details):[];
  const phoneLabel=phone&&/^\+91\d{10}$/.test(phone)?phone.slice(0,3)+" "+phone.slice(3,8)+" "+phone.slice(8):phone;
  function download(){
    if(!identity||!details)return;
    const url=URL.createObjectURL(new Blob([professionalProfileDocument(identity,details)],{type:"text/html;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download="SapienWorx-professional-profile.html";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="candidate-readiness-card candidate-identity-card" aria-label="Your profile">
    <div className="candidate-readiness-photo">
      <Link href="/candidate/profile?panel=completion#profile-completion" className="candidate-completion-link" aria-label={completion+"% complete. Open incomplete profile sections."}>
        <span className="candidate-completion-ring" style={{background:"conic-gradient(#2c9d63 "+completion+"%, var(--color-line) 0)"}}><CandidateAvatar name={name}/></span>
        <strong>{completion}% complete</strong>
      </Link>
      <CandidatePhotoControls/>
    </div>
    <div className="candidate-readiness-content">
      <header><h2>{name}</h2><p className="candidate-readiness-title">{details?.details.current_designation||current?.job_title||identity?.headline||profile.headline||"Your next career chapter"}</p></header>
      <dl className="candidate-readiness-facts" data-has-experience={!!experience}>
        <div className="candidate-fact-current"><dt><ProfileFactIcon type="location"/>Current</dt><dd>{identity?.current_location||[profile.current_city,profile.current_state].filter(Boolean).join(", ")||<Link href="/candidate/profile?edit=intro">Add current location</Link>}</dd></div>
        <div className="candidate-fact-phone"><dt><ProfileFactIcon type="phone"/>Mobile number</dt><dd>{phone?<><span>{phoneLabel}</span><Link href="/candidate/settings#mobile">Change</Link></>:<Link href="/candidate/settings#mobile">+ Add mobile number</Link>}</dd></div>
        {experience&&<div className="candidate-fact-experience"><dt><ProfileFactIcon type="experience"/>Experience</dt><dd>{experience}</dd></div>}
        <div className="candidate-fact-email"><dt><ProfileFactIcon type="email"/>Email</dt><dd className="candidate-readiness-email">{email}{identity?.email_verified&&<svg role="img" aria-label="Email verified" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m12 2 3 2 4 1 1 4 2 3-2 3-1 4-4 1-3 2-3-2-4-1-1-4-2-3 2-3 1-4 4-1Z"/><path d="m7 12 3 3 7-7"/></svg>}</dd></div>
        <div className="candidate-fact-preferred"><dt><ProfileFactIcon type="location"/>Preferred</dt><dd>{identity?.preferred_locations?.length?identity.preferred_locations.join(" · "):<Link href="/candidate/profile?edit=preferences#section-preferences">Add preferred locations</Link>}</dd></div>
        <div className="candidate-fact-availability"><dt><ProfileFactIcon type="calendar"/>Availability</dt><dd>{profile.notice_period_days==null?<Link href="/candidate/profile?edit=preferences#section-preferences">Add availability</Link>:profile.notice_period_days===0?"Available immediately":"Join in "+profile.notice_period_days+" days"}</dd></div>
      </dl>
      <div className="candidate-readiness-actions">
        <Link className="candidate-primary-action" href="/candidate/profile?edit=intro">Edit profile</Link>
        <Link href="/candidate/profile/preview">Preview profile</Link>
        <CandidatePopover label="More profile actions" title="Profile actions" className="candidate-icon-button" trigger={<span aria-hidden="true">•••</span>}>
          {close=><nav className="candidate-account-links" aria-label="Profile actions"><Link href="/candidate/profile?panel=visibility" onClick={close}>Profile visibility</Link><button type="button" onClick={()=>{close();setConfirmDiscovery(true)}}>{discovery?"Recruiter discovery settings":"Turn on recruiter discovery"}</button><button type="button" disabled={!identity||!details} onClick={()=>{download();close()}}>Download profile (HTML)</button><Link href="/candidate/settings#privacy" onClick={close}>Privacy settings</Link></nav>}
        </CandidatePopover>
      </div>
      <div className="candidate-readiness-bottom">
      <div className="candidate-discovery-control"><div><h3>Recruiter discovery</h3><p>{discovery?"Your professional profile can appear in recruiter searches.":"Let verified recruiters discover your professional profile."}</p></div><button type="button" role="switch" aria-label="Recruiter discovery" aria-checked={discovery} disabled={!identity||busy} onClick={()=>setConfirmDiscovery(true)}><span className="candidate-switch-track" aria-hidden="true"><span/></span><span>{discovery?"On":"Off"}</span></button></div>
      {missing.length>0&&<div className="candidate-readiness-task"><CareerIcon name="application"/><div><strong>Complete your profile</strong><p>{missing[0].label}</p></div><Link href={missing[0].href.startsWith("#")?"/candidate/profile"+missing[0].href:missing[0].href}>{missing[0].label.startsWith("Upload")?"Upload resume":"Continue"} <span aria-hidden="true">→</span></Link></div>}
      </div>
      {details?.profile_updated_at&&<p className="candidate-readiness-updated">Profile updated {new Date(details.profile_updated_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"})}</p>}
    </div>
    {confirmDiscovery&&<WorkspaceDialog title={discovery?"Turn off recruiter discovery":"Turn on recruiter discovery"} busy={busy} onClose={()=>setConfirmDiscovery(false)}>
      <p className="text-sm leading-7">{discovery?"Your profile will stop appearing in recruiter discovery. Existing applications and conversations remain available.":"Allow verified recruiters to find your professional profile and start conversations before you apply. Your email, phone, salary and resume stay private under your existing sharing controls."}</p>
      <button type="button" className="candidate-primary-action" disabled={busy} onClick={()=>{setBusy(true);setError("");void apiRequest("/api/v1/candidate/profile/discovery",{method:"PATCH",body:JSON.stringify({enabled:!discovery})}).then(()=>{patchIdentity({discoverable_to_recruiters:!discovery});setConfirmDiscovery(false);router.refresh()}).catch(cause=>setError(cause instanceof Error?cause.message:"Could not change discovery. Try again.")).finally(()=>setBusy(false))}}>{busy?"Saving…":discovery?"Turn off discovery":"Turn on discovery"}</button>
      <button type="button" className="candidate-secondary-action ml-2" disabled={busy} onClick={()=>setConfirmDiscovery(false)}>Cancel</button>
      {error&&<p role="alert" className="candidate-error">{error}</p>}
    </WorkspaceDialog>}
  </section>;
}
