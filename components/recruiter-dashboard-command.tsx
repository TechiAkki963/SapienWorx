"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";
import { Badge, Button, WorkspaceShell } from "./ui";
import styles from "./recruiter-dashboard-command.module.css";

type Dashboard = { openPositions:number; activeApplications:number; draftJobs:number; funnel:Record<string,number>; upcomingInterviews:Array<{candidateName:string;jobTitle:string;platformName:string;meetingLink:string;scheduledAt:string;durationMinutes:number}> };
type JobPerformance = { jobId:string; title:string; status:string; applicants:number; offers:number; hires:number };
type Report = { metrics?: Record<string, number>; insights?: string[]; jobPerformance?: JobPerformance[] };

function metric(report: Report | null, key: string, fallback = 0) { const value = report?.metrics?.[key]; return typeof value === "number" ? value : fallback; }
function when(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?"Time pending":new Intl.DateTimeFormat("en-IN",{weekday:"short",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}).format(date)}
function conversion(part:number,total:number){return total>0?Math.round((part/total)*100):0}

export function RecruiterDashboardCommand({initialData}:{initialData?:Dashboard|null}){
  const [report,setReport]=useState<Report|null>(null);
  useEffect(()=>{void apiClient<Report>("/api/recruiter/reports?rangeDays=30").then(setReport).catch(()=>undefined)},[]);
  const funnel=initialData?.funnel??{};
  const applied=funnel.APPLIED??0, screening=funnel.SCREENING??0, interviewing=funnel.INTERVIEWING??0, finalStage=funnel.FINAL_STAGE??0, offers=funnel.OFFER??0, hired=funnel.ONBOARDED??0;
  const attention=useMemo(()=>[
    {label:"New applications",value:applied,copy:"Candidates waiting for a first review",href:"/recruiter/pipeline?stage=APPLIED"},
    {label:"Screening queue",value:screening,copy:"Profiles that need a screening decision",href:"/recruiter/pipeline?stage=SCREENING"},
    {label:"Interview decisions",value:interviewing+finalStage,copy:"Interview and final-stage decisions in progress",href:"/recruiter/pipeline?stage=INTERVIEWING"},
    {label:"Offer decisions",value:offers,copy:"Offers awaiting internal or candidate action",href:"/recruiter/pipeline?stage=OFFER"},
  ].filter(item=>item.value>0),[applied,screening,interviewing,finalStage,offers]);
  const offerRate=metric(report,"applicationToOfferRate",conversion(offers,Math.max(1,initialData?.activeApplications??0)));
  const jobs=(report?.jobPerformance??[]).slice(0,5);
  const funnelRows:[[string,number,string],...Array<[string,number,string]>]=[["Applied",applied,"/recruiter/pipeline?stage=APPLIED"],["Screening",screening,"/recruiter/pipeline?stage=SCREENING"],["Interview",interviewing,"/recruiter/pipeline?stage=INTERVIEWING"],["Final",finalStage,"/recruiter/pipeline?stage=FINAL_STAGE"],["Offer",offers,"/recruiter/pipeline?stage=OFFER"],["Hired",hired,"/recruiter/pipeline?stage=ONBOARDED"]];
  const maxFunnel=Math.max(1,...funnelRows.map(([,value])=>value));

  return <WorkspaceShell workspace="recruiter" active="dashboard" title="Dashboard overview" description="Track priority work, live hiring throughput and recruitment performance." actions={<><Button href="/recruiter/reports" variant="secondary">Download report</Button><Button href="/recruiter/jobs/new">Post new job</Button></>}>
    <div className={styles.page}>
      <section className={styles.attention}><header><div><span className="eyebrow">Needs attention</span><h2>{attention.length?`${attention.reduce((sum,item)=>sum+item.value,0)} active decisions need review`:"No urgent pipeline queues"}</h2></div><Badge tone={attention.length?"amber":"green"}>{attention.length?`${attention.length} queues`:"Clear"}</Badge></header><div className={styles.attentionGrid}>{attention.length?attention.map(item=><a href={item.href} key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.copy}</small><em>Review →</em></a>):<p>Your active queues are clear. Continue sourcing or review job performance.</p>}</div></section>

      <section className={styles.kpis} aria-label="Recruitment KPIs">
        <a href="/recruiter/jobs/manage"><span>Active jobs</span><strong>{initialData?.openPositions??0}</strong><small>{initialData?.draftJobs??0} drafts ready for review</small></a>
        <a href="/recruiter/pipeline"><span>Active candidates</span><strong>{initialData?.activeApplications??0}</strong><small>{hired} hires / onboarded</small></a>
        <a href="/recruiter/interviews"><span>Interviews scheduled</span><strong>{initialData?.upcomingInterviews?.length??0}</strong><small>Upcoming confirmed records</small></a>
        <a href="/recruiter/reports"><span>Application → offer</span><strong>{offerRate}%</strong><small>30-day conversion signal</small></a>
      </section>

      <div className={styles.bento}>
        <section className={`${styles.panel} ${styles.funnelPanel}`}><header><div><span className="eyebrow">Recruitment funnel</span><h2>Pipeline distribution</h2></div><a href="/recruiter/pipeline">View pipeline →</a></header><div className={styles.funnel}>{funnelRows.map(([label,value,href])=><a href={href} key={label}><span>{label}</span><strong>{value}</strong><i><b style={{width:`${Math.max(4,Math.round((value/maxFunnel)*100))}%`}}/></i><em>{conversion(value,Math.max(1,applied))}%</em></a>)}</div></section>

        <section className={`${styles.panel} ${styles.jobsPanel}`}><header><div><span className="eyebrow">Active jobs</span><h2>Job performance</h2></div><a href="/recruiter/jobs/manage">View all →</a></header>{jobs.length?<div className={styles.jobTable}><div className={styles.jobHeader}><span>Role</span><span>Applicants</span><span>Offers</span><span>Hires</span></div>{jobs.map(job=><a href={`/recruiter/jobs/${job.jobId}`} key={job.jobId}><div><strong>{job.title}</strong><small>{job.status.replaceAll("_"," ")}</small></div><span>{job.applicants}</span><span>{job.offers}</span><span>{job.hires}</span></a>)}</div>:<div className={styles.empty}><strong>Job performance will appear here.</strong><p>The report service has not returned active-job rows yet.</p></div>}</section>

        <section className={`${styles.panel} ${styles.interviewPanel}`}><header><div><span className="eyebrow">Calendar</span><h2>Upcoming interviews</h2></div><a href="/recruiter/interviews">All interviews →</a></header><div className={styles.interviews}>{initialData?.upcomingInterviews?.length?initialData.upcomingInterviews.slice(0,5).map(item=><article key={`${item.candidateName}-${item.scheduledAt}`}><time>{when(item.scheduledAt)}</time><div><strong>{item.candidateName}</strong><small>{item.jobTitle} · {item.platformName} · {item.durationMinutes} min</small></div>{item.meetingLink?.startsWith("https://")?<a href={item.meetingLink} target="_blank" rel="noreferrer">Join</a>:<span>Link pending</span>}</article>):<div className={styles.empty}><strong>No upcoming interviews.</strong><p>Scheduled interview records will appear here.</p></div>}</div></section>

        <section className={`${styles.panel} ${styles.signalPanel}`}><header><div><span className="eyebrow">30-day signals</span><h2>Operating pulse</h2></div><a href="/recruiter/reports">Open reports →</a></header><div className={styles.signals}><div><span>Avg pipeline update</span><strong>{metric(report,"averagePipelineUpdateHours")?`${metric(report,"averagePipelineUpdateHours")}h`:"—"}</strong></div><div><span>Outreach reply rate</span><strong>{metric(report,"outreachReplyRate")}%</strong></div><div><span>Offer → hire</span><strong>{metric(report,"offerToHireRate")}%</strong></div></div>{report?.insights?.length?<div className={styles.insightList}>{report.insights.slice(0,3).map(item=><p key={item}>→ {item}</p>)}</div>:<p className={styles.muted}>Operational insights will appear when the report service has enough data.</p>}</section>
      </div>
    </div>
  </WorkspaceShell>;
}
