"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";
import { Badge, Button, WorkspaceShell } from "./ui";
import styles from "./recruiter-dashboard-command.module.css";

type Dashboard = { openPositions:number; activeApplications:number; draftJobs:number; funnel:Record<string,number>; upcomingInterviews:Array<{candidateName:string;jobTitle:string;platformName:string;meetingLink:string;scheduledAt:string;durationMinutes:number}> };
type Report = { metrics?: Record<string, number>; insights?: string[]; jobPerformance?: Array<{jobId:string;title:string;status:string;applicants:number;offers:number;hires:number}> };

function metric(report: Report | null, key: string, fallback = 0) { const value = report?.metrics?.[key]; return typeof value === "number" ? value : fallback; }
function when(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?"Time pending":new Intl.DateTimeFormat("en-IN",{weekday:"short",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}).format(date)}

export function RecruiterDashboardCommand({initialData}:{initialData?:Dashboard|null}){
  const [report,setReport]=useState<Report|null>(null);
  useEffect(()=>{void apiClient<Report>("/api/recruiter/reports?rangeDays=30").then(setReport).catch(()=>undefined)},[]);
  const funnel=initialData?.funnel??{};
  const applied=funnel.APPLIED??0, screening=funnel.SCREENING??0, interviewing=funnel.INTERVIEWING??0, finalStage=funnel.FINAL_STAGE??0, offers=funnel.OFFER??0, hired=funnel.ONBOARDED??0;
  const attention=useMemo(()=>[
    {label:"New applications",value:applied,copy:"Candidates waiting for a first review",href:"/recruiter/pipeline?stage=APPLIED",tone:"blue" as const},
    {label:"Screening queue",value:screening,copy:"Profiles that need a screening decision",href:"/recruiter/pipeline?stage=SCREENING",tone:"amber" as const},
    {label:"Interview decisions",value:interviewing+finalStage,copy:"Interviews and final-stage decisions in progress",href:"/recruiter/pipeline?stage=INTERVIEWING",tone:"purple" as const},
    {label:"Offer decisions",value:offers,copy:"Offers awaiting internal or candidate action",href:"/recruiter/pipeline?stage=OFFER",tone:"green" as const},
  ].filter(item=>item.value>0),[applied,screening,interviewing,finalStage,offers]);
  const avgUpdate=metric(report,"averagePipelineUpdateHours");
  const offerRate=metric(report,"applicationToOfferRate");
  const replyRate=metric(report,"outreachReplyRate");
  return <WorkspaceShell workspace="recruiter" active="dashboard" title="Recruitment command centre" description="Priority work, hiring throughput and live pipeline signals in one dense operating view." actions={<><Button href="/recruiter/reports" variant="secondary">Reports</Button><Button href="/recruiter/pipeline">Open pipeline</Button></>}>
    <div className={styles.page}>
      <section className={styles.attention}><header><div><span className="eyebrow">Needs attention</span><h2>{attention.length?`${attention.reduce((sum,item)=>sum+item.value,0)} active decisions need review`:"No urgent pipeline queues"}</h2></div><Badge tone={attention.length?"amber":"green"}>{attention.length?`${attention.length} queues`:"Clear"}</Badge></header><div className={styles.attentionGrid}>{attention.length?attention.map(item=><a href={item.href} key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.copy}</small><em>Review →</em></a>):<p>Your active queues are currently clear. Continue sourcing or review job performance.</p>}</div></section>
      <section className={styles.kpis} aria-label="Recruitment KPIs">
        <a href="/recruiter/jobs/manage"><span>Active vacancies</span><strong>{initialData?.openPositions??0}</strong><small>{initialData?.draftJobs??0} drafts</small></a>
        <a href="/recruiter/pipeline"><span>Active pipeline</span><strong>{initialData?.activeApplications??0}</strong><small>{hired} onboarded</small></a>
        <a href="/recruiter/interviews"><span>Upcoming interviews</span><strong>{initialData?.upcomingInterviews?.length??0}</strong><small>Next scheduled conversations</small></a>
        <a href="/recruiter/reports"><span>Application → offer</span><strong>{offerRate}%</strong><small>30-day report signal</small></a>
        <a href="/recruiter/reports"><span>Avg pipeline update</span><strong>{avgUpdate?`${avgUpdate}h`:"—"}</strong><small>Application to latest update</small></a>
        <a href="/recruiter/reports"><span>Outreach reply rate</span><strong>{replyRate}%</strong><small>30-day campaign response</small></a>
      </section>
      <div className={styles.grid}>
        <section className={styles.panel}><header><div><span className="eyebrow">Pipeline distribution</span><h2>Hiring funnel</h2></div><a href="/recruiter/pipeline">Full pipeline →</a></header><div className={styles.funnel}>{[["Applied",applied],["Screening",screening],["Interview",interviewing],["Final",finalStage],["Offer",offers],["Hired",hired]].map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{value}</strong><i style={{width:`${Math.max(4,Math.round((Number(value)/Math.max(1,initialData?.activeApplications??1))*100))}%`}}/></div>)}</div></section>
        <section className={styles.panel}><header><div><span className="eyebrow">Calendar</span><h2>Upcoming interviews</h2></div><a href="/recruiter/interviews">All interviews →</a></header><div className={styles.interviews}>{initialData?.upcomingInterviews?.length?initialData.upcomingInterviews.map(item=><article key={`${item.candidateName}-${item.scheduledAt}`}><time>{when(item.scheduledAt)}</time><div><strong>{item.candidateName}</strong><small>{item.jobTitle} · {item.platformName}</small></div>{item.meetingLink?.startsWith("https://")?<a href={item.meetingLink} target="_blank" rel="noreferrer">Join</a>:<span>Link pending</span>}</article>):<p>No upcoming interviews.</p>}</div></section>
      </div>
      {report?.insights?.length?<section className={styles.insights}><span className="eyebrow">Operational insights</span>{report.insights.map(item=><p key={item}>→ {item}</p>)}</section>:null}
    </div>
  </WorkspaceShell>;
}
