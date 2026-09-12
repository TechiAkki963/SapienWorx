"use client";

import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { Badge, Button, Meter, WorkspaceShell } from "./ui";
import styles from "./candidate-dashboard-snapshot.module.css";

type Range=7|30|90;
export type CandidateDashboardSnapshotData={
  profile:{fullName:string;headline:string|null;domainCategory:string;profileSearchable:boolean;profileLastUpdatedAt:string|null;lastActiveAt:string|null};
  performance:{rangeDays:number;profileAppearances:number;recruiterActions:number;profileViews:number;resumeDownloads:number;profileAppearancesInRange:number;recruiterActionsInRange:number;appearanceChangePercent:number;actionChangePercent:number;profileCompleteness:number;activityLevel:"HIGH"|"MEDIUM"|"BUILDING"};
  recruiterActivity:Array<{recruiterName:string;recruiterTitle:string|null;organisationName:string;action:"PROFILE_VIEWED"|"RESUME_DOWNLOADED";occurredAt:string}>;
  applications:Array<{applicationId:string;title:string;companyName:string;stage:string;updatedAt:string}>;
};
function relative(value:string){const diff=Math.max(0,Date.now()-new Date(value).getTime());const hours=Math.floor(diff/3600000);if(hours<1)return"Just now";if(hours<24)return`${hours}h ago`;return`${Math.floor(hours/24)}d ago`}
function firstName(value:string){return value.split(" ").filter(Boolean)[0]||"there"}

export function CandidateDashboardSnapshot({initialData}:{initialData:CandidateDashboardSnapshotData}){
  const [data,setData]=useState(initialData);const [range,setRange]=useState<Range>((initialData.performance.rangeDays as Range)||90);const [refreshing,setRefreshing]=useState(false);const [error,setError]=useState("");
  useEffect(()=>setData(initialData),[initialData]);
  async function changeRange(next:Range){setRange(next);setRefreshing(true);setError("");try{setData(await apiClient<CandidateDashboardSnapshotData>(`/api/candidate/dashboard?rangeDays=${next}`))}catch(reason){setError(reason instanceof Error?reason.message:"Performance data is unavailable right now.")}finally{setRefreshing(false)}}
  const p=data.performance;
  return <WorkspaceShell workspace="candidate" active="dashboard" title={`Welcome back, ${firstName(data.profile.fullName)}`} description="Keep your profile current, follow recruiter activity, and stay on top of every application." actions={<Button href="/candidate/profile">Complete profile</Button>}>
    <main className={styles.page}>
      <section className={styles.hero}><div><span className="eyebrow">Career workspace</span><h2>{data.profile.headline||data.profile.domainCategory||"Your SapienWorx profile"}</h2><p>{data.profile.profileSearchable?"Your profile is searchable by recruiters. Contact details remain protected until an audited reveal is allowed.":"Your profile is private. Turn on sourcing visibility when you are ready to be discovered."}</p></div><div className={styles.completeness}><span>Profile completeness</span><strong>{p.profileCompleteness}%</strong><Meter value={p.profileCompleteness}/><Button href="/candidate/profile" variant="quiet">Review profile →</Button></div></section>

      <section className={styles.metrics} aria-label="Candidate activity metrics">
        <article><span>Profile appearances</span><strong>{p.profileAppearances.toLocaleString("en-IN")}</strong><small>{p.profileAppearancesInRange} in last {range} days</small></article>
        <article><span>Recruiter actions</span><strong>{p.recruiterActions.toLocaleString("en-IN")}</strong><small>{p.recruiterActionsInRange} in selected period</small></article>
        <article><span>Profile views</span><strong>{p.profileViews.toLocaleString("en-IN")}</strong><small>Recruiters who opened your profile</small></article>
        <article><span>CV downloads</span><strong>{p.resumeDownloads.toLocaleString("en-IN")}</strong><small>Audited recruiter downloads</small></article>
      </section>

      {error?<p className={styles.error} role="alert">{error}</p>:null}
      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.panel}><header><div><span className="eyebrow">Applications</span><h2>Your active job search</h2></div><Button href="/candidate/applications" variant="quiet">View all →</Button></header>{data.applications.length?<div className={styles.applications}>{data.applications.slice(0,5).map(item=><a href={`/candidate/applications#${item.applicationId}`} key={item.applicationId}><span className={styles.companyMark}>{item.companyName.slice(0,1).toUpperCase()}</span><div><strong>{item.title}</strong><small>{item.companyName} · Updated {relative(item.updatedAt)}</small></div><Badge tone={item.stage.includes("INTERVIEW")?"green":item.stage.includes("OFFER")?"purple":"blue"}>{item.stage.replaceAll("_"," ")}</Badge></a>)}</div>:<div className={styles.empty}><strong>No active applications yet.</strong><p>Explore live roles and your applications will be tracked here.</p><Button href="/candidate/jobs">Explore jobs</Button></div>}</section>

          <section className={styles.panel}><header><div><span className="eyebrow">Recruiter activity</span><h2>Who is engaging with your profile</h2></div><Button href="/candidate/notifications" variant="quiet">Notifications →</Button></header>{data.recruiterActivity.length?<div className={styles.activity}>{data.recruiterActivity.slice(0,6).map((item,index)=><article key={`${item.recruiterName}-${item.occurredAt}-${index}`}><span className={styles.avatar}>{item.recruiterName.split(" ").map(part=>part[0]).join("").slice(0,2)}</span><div><strong>{item.recruiterName}</strong><small>{item.recruiterTitle||"Recruitment team"} · {item.organisationName}</small></div><div><Badge tone={item.action==="RESUME_DOWNLOADED"?"purple":"blue"}>{item.action==="RESUME_DOWNLOADED"?"CV downloaded":"Profile viewed"}</Badge><small>{relative(item.occurredAt)}</small></div></article>)}</div>:<div className={styles.empty}><strong>No recruiter activity yet.</strong><p>Keep your profile searchable and current to improve discovery.</p></div>}</section>
        </div>

        <aside className={styles.aside}>
          <section className={styles.panel}><header><div><span className="eyebrow">Visibility</span><h2>Activity level</h2></div><Badge tone={p.activityLevel==="HIGH"?"green":p.activityLevel==="MEDIUM"?"amber":"neutral"}>{p.activityLevel}</Badge></header><div className={styles.activityLevel}><strong>{p.activityLevel==="HIGH"?"Strong recent activity":p.activityLevel==="MEDIUM"?"Profile gaining attention":"Building visibility"}</strong><p>{p.activityLevel==="HIGH"?"Recruiters are actively engaging with your profile.":p.activityLevel==="MEDIUM"?"A few profile updates can help improve discovery.":"Complete your profile and stay active to build recruiter visibility."}</p></div></section>
          <section className={styles.panel}><header><div><span className="eyebrow">Performance period</span><h2>Recruiter visibility</h2></div></header><label className={styles.range}><span>Period</span><select value={range} onChange={event=>void changeRange(Number(event.target.value) as Range)} disabled={refreshing}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label><div className={styles.change}><strong>{p.appearanceChangePercent>=0?"↑":"↓"} {Math.abs(p.appearanceChangePercent)}%</strong><span>profile appearance change</span></div><div className={styles.change}><strong>{p.actionChangePercent>=0?"↑":"↓"} {Math.abs(p.actionChangePercent)}%</strong><span>recruiter action change</span></div>{refreshing?<small>Refreshing performance data…</small>:null}</section>
          <section className={styles.quick}><a href="/candidate/jobs"><strong>Find jobs</strong><span>Search current opportunities →</span></a><a href="/candidate/interviews"><strong>Interviews</strong><span>Review upcoming schedules →</span></a><a href="/candidate/messages"><strong>Messages</strong><span>Open recruiter conversations →</span></a></section>
        </aside>
      </div>
    </main>
  </WorkspaceShell>
}
