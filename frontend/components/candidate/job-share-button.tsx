"use client";
import { useId, useState } from "react";
import { humanize, jobLocation } from "@/lib/candidate";
import { publicJobShareLinks, usePublicJobShare } from "@/lib/use-public-job-share";
import { WorkspaceDialog } from "./workspace-dialog";
import { CareerIcon, SocialIcon } from "./career-icon";
import "./candidate-workspace.css";

export function JobShareButton({ jobId, jobTitle, companyName, canonicalUrl }: {
  jobId: string; jobTitle: string; companyName: string; canonicalUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className="candidate-job-share-trigger" onClick={() => setOpen(true)}><CareerIcon name="share"/>Share</button>{open && <JobShareModal jobId={jobId} jobTitle={jobTitle} companyName={companyName} canonicalUrl={canonicalUrl} onClose={() => setOpen(false)}/>}</>;
}

function JobShareModal({ jobId, jobTitle, companyName, canonicalUrl, onClose }: {
  jobId: string; jobTitle: string; companyName: string; canonicalUrl?: string; onClose: () => void;
}) {
  const { url, job, state, copied, error, input, copy } = usePublicJobShare(jobId, canonicalUrl);
  const [logoFailed, setLogoFailed] = useState(false), [learn, setLearn] = useState(false);
  const inputID = useId(), learnID = useId();
  const title = job?.title || jobTitle, company = job?.company_name || companyName;
  const socials = publicJobShareLinks(url, title, company).filter(social => social.provider !== "whatsapp" && social.provider !== "email");
  return <WorkspaceDialog title="Share this job" onClose={onClose} className="candidate-share-dialog" headerIcon={<CareerIcon name="share" size={24}/>} description="Share with your network or copy the public job link.">
    <div className="candidate-share-job">
      <div className="candidate-share-company-logo" aria-hidden="true">{job?.company_logo_url&&!logoFailed?<img src={job.company_logo_url} alt="" width="56" height="56" onError={()=>setLogoFailed(true)}/>:company.split(/\s+/).slice(0,2).map(word=>word[0]).join("").toUpperCase()}</div>
      <div className="candidate-job-share-context"><h3>{title}</h3><p>{company}</p>{job&&<div className="candidate-share-job-meta">{jobLocation(job)&&<span>{jobLocation(job)}</span>}{job.employment_type&&<span>{humanize(job.employment_type)}</span>}{job.job_reference&&<span>{job.job_reference}</span>}</div>}</div>
    </div>
    {state === "loading" ? <p role="status">Checking public job availability…</p> : state === "error" ? <p role="alert" className="candidate-error">Public job availability could not be checked. Close this dialog and try again.</p> : state === "unavailable" ? <p role="alert" className="candidate-error">This job is private, unavailable or no longer open. A public share link is not available.</p> : <>
      <label className="candidate-share-link-label" htmlFor={inputID}>Job link</label>
      <div className="candidate-share-link-control"><CareerIcon name="link"/><input id={inputID} ref={input} type="url" readOnly value={url}/><button type="button" className="candidate-primary-action" onClick={() => void copy()}>{!copied&&<CareerIcon name="copy"/>}{copied ? "✓ Copied" : "Copy link"}</button></div>
      <span role="status" className="sr-only">{copied ? "Job link copied" : ""}</span>
      {error && <p role="alert" className="candidate-error">{error}</p>}
      <div className="candidate-share-divider"><span>Share via</span></div>
      <nav className="candidate-share-options" aria-label="Share options">{socials.map(social=><a key={social.provider} href={social.href} target="_blank" rel="noopener noreferrer"><span className={`candidate-social-icon candidate-social-${social.provider}`}><SocialIcon provider={social.provider}/></span>{social.label}<CareerIcon name="arrow" size={18}/></a>)}</nav>
    </>}
    <div className="candidate-share-helper"><CareerIcon name="info"/><div><p>Sharing this job does not create a referral.</p>{state==="ready"&&<><button type="button" aria-expanded={learn} aria-controls={learnID} onClick={()=>setLearn(value=>!value)}>Learn about referrals <span aria-hidden="true">→</span></button><p id={learnID} hidden={!learn} className="candidate-referral-explanation">A referral is a personal recommendation sent through the separate Refer someone feature, where available. Sharing this public link does not recommend anyone or create an application.</p></>}</div></div>
  </WorkspaceDialog>;
}
