"use client";
import Image from "next/image";
import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { experience, type PipelineRow } from "@/lib/recruiter";

export type CandidateCardSummary={
 id:string;name:string;href?:string;profileWithheld?:boolean;headline?:string;photo?:string;experienceMonths?:number;
 location?:string;preferredLocation?:string;noticeDays?:number;currentCompany?:string;
 previousCompany?:string;education?:string[];skills?:string[];matchScore?:number|null;
};
export function applicationCardSummary(row:PipelineRow):CandidateCardSummary & {href:string} {
 return {id:row.candidate_id,name:row.candidate_name,href:`/recruiter/candidates/${row.candidate_id}?job_id=${encodeURIComponent(row.job_id)}&application_id=${encodeURIComponent(row.application_id)}`,headline:row.designation||row.headline,photo:row.photo_data_url,experienceMonths:row.experience_months,location:row.city,preferredLocation:row.preferred_location,noticeDays:row.notice_period_days,currentCompany:row.current_company,previousCompany:row.previous_company,education:[[row.education,row.university].filter(Boolean).join(" · ")].filter(Boolean),skills:row.key_skills.split(",").map(s=>s.trim()).filter(Boolean)};
}
function ProfileLink({href,children,...props}:HTMLAttributes<HTMLSpanElement>&{href?:string}){return href?<Link href={href} {...props}>{children}</Link>:<span {...props}>{children}</span>}
/** One candidate presentation in every workspace; context controls are adapters. */
export function CandidateCard({candidate,selection,context,actions,utilities}:{candidate:CandidateCardSummary;selection?:ReactNode;context?:ReactNode;actions?:ReactNode;utilities?:ReactNode}) {
 const skills=[...new Set(candidate.skills?.map(s=>s.trim()).filter(Boolean)??[])];
 const preferred=candidate.preferredLocation?.trim();
 const sameLocation=preferred?.toLocaleLowerCase()===candidate.location?.trim().toLocaleLowerCase();
 const score=candidate.matchScore;
 return <article className="swx-workspace-surface swx-candidate-card" data-candidate-id={candidate.id} aria-label={`Candidate ${candidate.name}`}>
  <div className="swx-candidate-identity"><div className="flex min-w-0 items-start gap-3">{selection}<ProfileLink href={candidate.href} aria-label={`View ${candidate.name}'s profile`} className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-indigo-soft font-semibold text-indigo">{candidate.photo?<Image src={candidate.photo} alt="" fill sizes="48px" unoptimized className="object-cover"/>:<span aria-hidden="true">{candidate.name.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join("").toUpperCase()}</span>}</ProfileLink><div className="min-w-0"><h3 className="text-base font-semibold leading-6 text-navy"><ProfileLink href={candidate.href} className="inline-flex min-h-11 items-center hover:text-indigo">{candidate.name}</ProfileLink></h3>{candidate.headline&&<p className="break-words text-sm leading-6 text-ink-muted">{candidate.headline}</p>}</div></div>
   <div className="mt-3 grid gap-1 text-[13px] leading-5 text-ink-muted">{candidate.experienceMonths!=null&&candidate.experienceMonths>=0&&<p>{experience(candidate.experienceMonths)} experience</p>}{candidate.location&&<p>{candidate.location}</p>}{preferred&&!sameLocation&&<p>Prefers {preferred}</p>}{candidate.noticeDays!=null&&<p>{candidate.noticeDays===0?"Available immediately":`${candidate.noticeDays} days notice`}</p>}</div>
  </div>
  <div className="swx-candidate-history min-w-0"><h4 className="text-xs font-semibold text-ink-muted">Career & education</h4>{candidate.currentCompany&&<p className="mt-2 break-words text-sm font-medium text-ink">{candidate.currentCompany}</p>}{candidate.previousCompany&&candidate.previousCompany!==candidate.currentCompany&&<p className="mt-1 break-words text-[13px] leading-5 text-ink-muted">Previously {candidate.previousCompany}</p>}{candidate.education?.slice(0,2).map((entry,i)=><p key={i} className="mt-2 break-words text-[13px] leading-5 text-ink-muted">{entry}</p>)}{!candidate.currentCompany&&!candidate.previousCompany&&!candidate.education?.length&&<p className="mt-2 text-[13px] text-ink-muted">{candidate.profileWithheld?"Career details shared after consent":"Career details not provided"}</p>}</div>
  <div className="swx-candidate-skills min-w-0"><h4 className="text-xs font-semibold text-ink-muted">Key skills</h4><div className="mt-2 flex flex-wrap gap-1.5">{skills.slice(0,7).map(skill=><span key={skill} className="swx-skill-chip max-w-full break-words rounded-md bg-mint/35 px-2 py-1 text-[13px] leading-5 text-emerald-900">{skill}</span>)}{skills.length>7&&<ProfileLink href={candidate.href} className="min-h-9 content-center rounded-md border border-line px-2 text-xs font-semibold text-indigo" aria-label={`View ${skills.length-7} more skills`}>+{skills.length-7}</ProfileLink>}{!skills.length&&<p className="text-[13px] text-ink-muted">{candidate.profileWithheld?"Skills shared after consent":"Skills not provided"}</p>}</div>{score!=null&&Number.isFinite(score)&&score>=0&&score<=100&&<p className="mt-3 text-sm font-semibold text-indigo">{Math.round(score)}% match</p>}</div>
  {context&&<div className="swx-candidate-context min-w-0 text-sm">{context}</div>}
  {(actions||utilities)&&<div className="swx-candidate-footer flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-line pt-3">{utilities&&<div className="flex min-w-0 flex-wrap items-center gap-2">{utilities}</div>}{actions&&<div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}</div>}
 </article>;
}
