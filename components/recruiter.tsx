"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge, Button, SectionTitle, StatCard, WorkspaceShell } from "./ui";
import { SocialJobCard } from "./recruiter-tools";

type Candidate = { name: string; initials: string; role: string; stage: "Screening" | "Interviewing" | "Final stage" | "Offer" | "Onboarded"; score: number; updated: string };

const startingCandidates: Candidate[] = [
  { name: "Amara Mensah", initials: "AM", role: "Senior Product Designer", stage: "Screening", score: 94, updated: "Today" },
  { name: "Nia Okafor", initials: "NO", role: "Senior Product Designer", stage: "Screening", score: 89, updated: "Today" },
  { name: "Eleanor Chen", initials: "EC", role: "Senior Product Designer", stage: "Interviewing", score: 91, updated: "Yesterday" },
  { name: "Lina Patel", initials: "LP", role: "Senior Product Designer", stage: "Offer", score: 96, updated: "2d ago" },
];

const internalJobs = [
  { title: "Senior Product Designer", department: "Product · London · Hybrid", status: "Active", tone: "green" as const, applications: "48", newApplications: "12 new", screening: "8 screening", recruiter: "Jordan Reyes", closing: "Closes 30 Aug" },
  { title: "Frontend Engineer", department: "Engineering · Remote · UK", status: "Active", tone: "green" as const, applications: "72", newApplications: "18 new", screening: "14 screening", recruiter: "Jordan Reyes", closing: "Closes 05 Sep" },
  { title: "Growth Marketing Lead", department: "Marketing · London · Hybrid", status: "Draft", tone: "amber" as const, applications: "—", newApplications: "Not published", screening: "—", recruiter: "Jordan Reyes", closing: "No closing date" },
];

type AnalyticsPeriod = "1" | "7" | "15" | "30" | "60" | "90" | "180" | "365" | "all";
type AnalyticsSnapshot = { label: string; newApplicants: number; openPositions: number; activeApplications: number; screening: number; interviewing: number; finalStage: number; offers: number; onboarded: number; responseRate: number; pipelineHealth: number; timeToHire: string };

const analyticsByPeriod: Record<AnalyticsPeriod, AnalyticsSnapshot> = {
  "1": { label: "Last 1 day", newApplicants: 12, openPositions: 4, activeApplications: 48, screening: 19, interviewing: 8, finalStage: 3, offers: 2, onboarded: 1, responseRate: 46, pipelineHealth: 82, timeToHire: "24d" },
  "7": { label: "Last 7 days", newApplicants: 31, openPositions: 4, activeApplications: 86, screening: 32, interviewing: 14, finalStage: 5, offers: 3, onboarded: 2, responseRate: 49, pipelineHealth: 84, timeToHire: "23d" },
  "15": { label: "Last 15 days", newApplicants: 58, openPositions: 5, activeApplications: 124, screening: 47, interviewing: 19, finalStage: 7, offers: 4, onboarded: 3, responseRate: 51, pipelineHealth: 86, timeToHire: "23d" },
  "30": { label: "Last 30 days", newApplicants: 112, openPositions: 5, activeApplications: 203, screening: 78, interviewing: 29, finalStage: 11, offers: 6, onboarded: 4, responseRate: 52, pipelineHealth: 87, timeToHire: "22d" },
  "60": { label: "Last 60 days", newApplicants: 218, openPositions: 6, activeApplications: 386, screening: 141, interviewing: 54, finalStage: 20, offers: 11, onboarded: 8, responseRate: 53, pipelineHealth: 88, timeToHire: "22d" },
  "90": { label: "Last 90 days", newApplicants: 327, openPositions: 7, activeApplications: 562, screening: 206, interviewing: 79, finalStage: 30, offers: 17, onboarded: 13, responseRate: 54, pipelineHealth: 89, timeToHire: "21d" },
  "180": { label: "Last 180 days", newApplicants: 644, openPositions: 8, activeApplications: 1084, screening: 402, interviewing: 158, finalStage: 62, offers: 34, onboarded: 26, responseRate: 55, pipelineHealth: 90, timeToHire: "21d" },
  "365": { label: "Last 1 year", newApplicants: 1268, openPositions: 9, activeApplications: 2124, screening: 786, interviewing: 306, finalStage: 118, offers: 69, onboarded: 52, responseRate: 56, pipelineHealth: 91, timeToHire: "20d" },
  all: { label: "All time", newApplicants: 2648, openPositions: 9, activeApplications: 4462, screening: 1663, interviewing: 647, finalStage: 249, offers: 142, onboarded: 106, responseRate: 55, pipelineHealth: 90, timeToHire: "21d" },
};

type RoleFunnel = { id: string; title: string; context: string; applied: number; screening: number; interviewing: number; finalStage: number; offers: number; onboarded: number };
const roleFunnels: RoleFunnel[] = [
  { id: "senior-product-designer", title: "Senior Product Designer", context: "Product · London · Hybrid", applied: 48, screening: 19, interviewing: 8, finalStage: 3, offers: 2, onboarded: 1 },
  { id: "frontend-engineer", title: "Frontend Engineer", context: "Engineering · Remote · UK", applied: 72, screening: 28, interviewing: 11, finalStage: 4, offers: 2, onboarded: 1 },
  { id: "growth-marketing-lead", title: "Growth Marketing Lead", context: "Marketing · London · Hybrid", applied: 31, screening: 12, interviewing: 4, finalStage: 1, offers: 0, onboarded: 0 },
];

export function RecruiterDashboard() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("30");
  const [exportStatus, setExportStatus] = useState("");
  const [funnelId, setFunnelId] = useState(roleFunnels[0].id);
  const [jobView, setJobView] = useState<"active" | "draft">("active");
  const [activityOpen, setActivityOpen] = useState(true);
  const analytics = analyticsByPeriod[period];
  const selectedFunnel = roleFunnels.find((role) => role.id === funnelId) ?? roleFunnels[0];
  const visibleJobs = internalJobs.filter((job) => jobView === "active" ? job.status === "Active" : job.status === "Draft");
  const metrics = [
    { label: "Open positions", value: analytics.openPositions, change: "Across 4 teams", tone: "blue" as const, icon: "▤", stage: "all" },
    { label: "Active applications", value: analytics.activeApplications, change: `${analytics.newApplicants} added in range`, tone: "green" as const, icon: "↓", stage: "all" },
    { label: "Screening", value: analytics.screening, change: "Awaiting review", tone: "blue" as const, icon: "⌕", stage: "screening" },
    { label: "Interviewing", value: analytics.interviewing, change: "3 scheduled today", tone: "purple" as const, icon: "◷", stage: "interviewing" },
    { label: "Final stage", value: analytics.finalStage, change: "Team decisions due", tone: "amber" as const, icon: "◆", stage: "final-stage" },
    { label: "Offer stage", value: analytics.offers, change: "2 pending response", tone: "rose" as const, icon: "✦", stage: "offer" },
    { label: "Onboarded", value: analytics.onboarded, change: "Successful hires", tone: "green" as const, icon: "✓", stage: "onboarded" },
  ];

  return <WorkspaceShell workspace="recruiter" active="dashboard" title="Recruitment overview" description={`Nexora Technologies · ${analytics.label}`} actions={<><div className="analytics-control"><label className="sr-only" htmlFor="analytics-period">Analytics period</label><select id="analytics-period" value={period} onChange={(event) => { setPeriod(event.target.value as AnalyticsPeriod); setExportStatus(""); }}><option value="1">1 day</option><option value="7">7 days</option><option value="15">15 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option><option value="180">180 days</option><option value="365">1 year</option><option value="all">All</option></select><Button variant="secondary" onClick={() => { downloadAnalyticsExcel(analytics); setExportStatus(`Excel export for ${analytics.label} downloaded.`); }}>⇩ Download Excel</Button>{exportStatus && <small className="positive" role="status">{exportStatus}</small>}</div><Button href="/recruiter/pipeline" variant="secondary">View pipeline</Button><Button href="/recruiter/jobs">+ Create job</Button></>}>
    <div className="dashboard-flow"><section className="recruiter-hero dashboard-alert"><div><span className="eyebrow">Organisation analytics · {analytics.label}</span><h2>{analytics.newApplicants} new applicants need your attention.</h2><p>Across all active roles, Senior Product Designer has the most new activity. <span className="candidate-last-active" tabIndex={0}>Amara Mensah <b>Last active 18 min ago</b></span></p></div><Button href="/recruiter/pipeline?stage=all">Review applicants →</Button></section>
      <section className="recruiter-metric-grid" aria-label="Organisation-wide recruitment pipeline metrics">{metrics.map((metric) => <a className="metric-link" href={`/recruiter/pipeline?stage=${metric.stage}`} key={metric.label} aria-label={`View ${metric.label.toLowerCase()} candidates in pipeline`}><StatCard label={metric.label} value={String(metric.value)} change={metric.change} tone={metric.tone} icon={metric.icon}/><span>View pipeline →</span></a>)}</section>
      <p className="analytics-data-note">These are aggregate organisation metrics across all active jobs. Illustrative reporting data is shown while live analytics are connected in the backend phase.</p>
      <div className="page-grid dashboard-main-grid"><div className="stack dashboard-primary"><section className="panel dashboard-funnel"><header className="funnel-card-header"><div><span className="eyebrow">Role-specific hiring funnel</span><div className="funnel-title-row"><h2>{selectedFunnel.title}</h2><label className="sr-only" htmlFor="role-funnel">Choose an active role</label><select id="role-funnel" value={funnelId} onChange={(event) => setFunnelId(event.target.value)}>{roleFunnels.map((role) => <option value={role.id} key={role.id}>{role.title}</option>)}</select></div><p>{selectedFunnel.context}</p></div><Button href={`/recruiter/pipeline?role=${selectedFunnel.id}`} variant="quiet">Open pipeline →</Button></header><div className="funnel"><div className="funnel-stage"><strong>{selectedFunnel.applied}</strong>Applied</div><div className="funnel-stage"><strong>{selectedFunnel.screening}</strong>Screening</div><div className="funnel-stage interview"><strong>{selectedFunnel.interviewing}</strong>Interviewing</div><div className="funnel-stage final"><strong>{selectedFunnel.finalStage}</strong>Final stage</div><div className="funnel-stage offer"><strong>{selectedFunnel.offers}</strong>Offer</div><div className="funnel-stage hired"><strong>{selectedFunnel.onboarded}</strong>Onboarded</div></div><div className="funnel-summary"><span><b>{Math.round((selectedFunnel.interviewing / selectedFunnel.applied) * 100)}%</b> reach interview</span><span><b>{Math.round((selectedFunnel.onboarded / selectedFunnel.applied) * 100)}%</b> convert to hire</span><span><b>{selectedFunnel.finalStage}</b> waiting for final decision</span></div></section><section className="panel dashboard-jobs"><header className="job-performance-header"><div><span className="eyebrow">Job performance</span><h2>{jobView === "active" ? "Active roles" : "Draft roles"}</h2></div><Button href="/recruiter/jobs" variant="quiet">Manage jobs →</Button></header><div className="job-role-tabs" role="tablist" aria-label="Job performance view"><button className={jobView === "active" ? "active" : ""} onClick={() => setJobView("active")} role="tab" aria-selected={jobView === "active"}>Active roles <span>{internalJobs.filter((job) => job.status === "Active").length}</span></button><button className={jobView === "draft" ? "active" : ""} onClick={() => setJobView("draft")} role="tab" aria-selected={jobView === "draft"}>Draft roles <span>{internalJobs.filter((job) => job.status === "Draft").length}</span></button></div><div className="job-mini-list">{visibleJobs.map((job) => <div className="job-mini" key={job.title}><span className="stripe"/><div><strong>{job.title}</strong><small>{job.department}</small></div><b>{job.applications} <small>{jobView === "active" ? "applicants" : "draft"}</small></b></div>)}</div></section></div><aside className="stack dashboard-aside"><section className="panel dashboard-analytics"><SectionTitle eyebrow="Analytics" title="Recruitment momentum"/><div className="analytics-mini"><div><span>Pipeline health</span><strong>{analytics.pipelineHealth}%</strong><span className="meter"><span className="meter-fill meter-green" style={{ width: `${analytics.pipelineHealth}%` }}/></span></div><div><span>Candidate response rate</span><strong>{analytics.responseRate}%</strong><span className="meter"><span className="meter-fill meter-blue" style={{ width: `${analytics.responseRate}%` }}/></span></div><div><span>Average time to hire</span><strong>{analytics.timeToHire}</strong><small className="positive">4 days faster than target</small></div></div></section><section className="panel dashboard-interviews"><SectionTitle eyebrow="Your day" title="Upcoming interviews" action={<Button variant="quiet">Calendar →</Button>}/><div className="interview-list"><Interview time="10:30 AM" name="Eleanor Chen" copy="Portfolio conversation" platform="Google Meet"/><Interview time="2:00 PM" name="Lina Patel" copy="Final interview" platform="Microsoft Teams"/><Interview time="4:30 PM" name="Team debrief" copy="Senior Product Designer" platform="In person"/></div></section><section className="panel dashboard-activity"><button className="activity-collapse-trigger" onClick={() => setActivityOpen((current) => !current)} aria-expanded={activityOpen}><span><i>Recent activity</i><strong>Live system events</strong></span><b>{activityOpen ? "−" : "+"}</b></button>{activityOpen && <div className="activity-list activity-list-expanded"><Activity icon="✓" title="Maya Singh accepted an offer" copy="Frontend Engineer · 8 min ago" lastActive="Last active 4 min ago"/><Activity icon="+" title="Amara Mensah applied" copy="Senior Product Designer · 12 min ago" lastActive="Last active 18 min ago"/><Activity icon="✦" title="Team debrief note added" copy="by Jordan Reyes · 2 hrs ago"/></div>}</section></aside></div>
    </div>
  </WorkspaceShell>;
}

function Activity({ icon, title, copy, lastActive }: { icon: string; title: string; copy: string; lastActive?: string }) { return <div className="activity"><span className="activity-icon">{icon}</span><div><p><strong>{title}</strong></p><small>{copy}</small>{lastActive && <span className="candidate-last-active" tabIndex={0}>Candidate activity <b>{lastActive}</b></span>}</div></div>; }
function Interview({ time, name, copy, platform }: { time: string; name: string; copy: string; platform: string }) { const [notice, setNotice] = useState(""); return <article className="interview-row"><time>{time}</time><div><strong>{name}</strong><span>{copy}</span>{notice && <em role="status">{notice}</em>}</div><small>{platform}</small><div className="interview-quick-actions"><button aria-label={`Actions for ${name}`}>•••</button><div><button onClick={() => setNotice("Meeting link is ready to open.")}>Join meeting</button><a href={`/recruiter/pipeline?candidate=${encodeURIComponent(name)}`}>View profile</a><button onClick={() => setNotice("Reschedule options are ready.")}>Reschedule</button></div></div></article>; }

function downloadAnalyticsExcel(analytics: AnalyticsSnapshot) {
  const metrics = [["Open positions", analytics.openPositions], ["Active applications", analytics.activeApplications], ["Screening", analytics.screening], ["Interviewing", analytics.interviewing], ["Final stage", analytics.finalStage], ["Offer stage", analytics.offers], ["Onboarded", analytics.onboarded], ["Candidate response rate", `${analytics.responseRate}%`], ["Pipeline health", `${analytics.pipelineHealth}%`], ["Average time to hire", analytics.timeToHire]];
  const escapeCell = (value: string | number) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
  const rows = metrics.map(([metric, value]) => `<tr><td>${escapeCell(metric)}</td><td>${escapeCell(value)}</td></tr>`).join("");
  const workbook = `<!doctype html><html><head><meta charset="utf-8"></head><body><table><tr><th colspan="2">Sapienworx recruitment analytics</th></tr><tr><td>Reporting window</td><td>${escapeCell(analytics.label)}</td></tr><tr><td></td><td></td></tr><tr><th>Metric</th><th>Value</th></tr>${rows}</table></body></html>`;
  const objectUrl = URL.createObjectURL(new Blob([`\ufeff${workbook}`], { type: "application/vnd.ms-excel" }));
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `sapienworx-recruitment-analytics-${analytics.label.toLowerCase().replace(/\s+/g, "-")}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export function RecruiterJobs() {
  const [created, setCreated] = useState(false);
  const [shared, setShared] = useState<string | null>(null);
  return <WorkspaceShell workspace="recruiter" active="jobs" title="Jobs" description="Create, publish and monitor every role in your hiring plan." actions={<Button href="#create-job">+ Create job</Button>}>
    {shared && <div className="creation-success">Public job link ready for <strong>{shared}</strong>. It is ready to share with candidates.</div>}
    <section className="recruiter-job-grid">{internalJobs.map((job) => <article className="panel recruiter-job-card" key={job.title}><Badge tone={job.tone}>{job.status}</Badge><h2>{job.title}</h2><p>{job.department}</p><div className="job-performance"><div><strong>{job.applications}</strong><span>Applications</span></div><div><strong>{job.newApplications}</strong><span>New this week</span></div><div><strong>{job.screening}</strong><span>Screening</span></div></div><footer className="job-card-footer"><span>{job.recruiter} · {job.closing}</span><button className="button button-quiet" onClick={() => setShared(job.title)}>Share ↗</button></footer></article>)}</section>
    <SocialJobCard/>
    <section className="panel recruiter-form" id="create-job" style={{ marginTop: 22 }}><SectionTitle eyebrow="New role" title="Create a job"/><p className="form-hint" style={{ marginBottom: 16 }}>Save as a draft, then publish when your description is ready. Only published roles are public.</p>{created && <div className="creation-success">Job draft saved. You can now add it to your hiring workflow.</div>}<form onSubmit={(event) => { event.preventDefault(); setCreated(true); }}><div className="form-grid"><FormField label="Job title" placeholder="e.g. Senior Product Designer"/><FormField label="Department" placeholder="e.g. Product"/><FormField label="Location" placeholder="e.g. London, United Kingdom"/><div className="form-field"><label>Workplace</label><select defaultValue="Hybrid"><option>Hybrid</option><option>Remote</option><option>On-site</option></select></div><div className="form-field"><label>Employment type</label><select defaultValue="Full-time"><option>Full-time</option><option>Contract</option><option>Part-time</option></select></div><FormField label="Closing date" type="date"/><FormField label="Role description" placeholder="Describe the role, responsibilities and the experience you need…" textarea full/></div><div className="form-actions"><Button variant="secondary" type="button">Preview</Button><Button variant="secondary" type="button">Save draft</Button><Button type="submit">Publish job</Button></div></form></section>
  </WorkspaceShell>;
}

function FormField({ label, placeholder, type = "text", textarea = false, full = false }: { label: string; placeholder?: string; type?: string; textarea?: boolean; full?: boolean }) { return <label className={`form-field ${full ? "full" : ""}`}><span>{label}</span>{textarea ? <textarea placeholder={placeholder} required/> : <input type={type} placeholder={placeholder} required/>}</label>; }

const stages: Candidate["stage"][] = ["Screening", "Interviewing", "Final stage", "Offer", "Onboarded"];

export function RecruiterPipeline() { return <Suspense fallback={<WorkspaceShell workspace="recruiter" active="pipeline" title="Candidate pipeline" description="Loading candidate stages…"><section className="panel">Loading candidate stages…</section></WorkspaceShell>}><RecruiterPipelineContent/></Suspense>; }

function RecruiterPipelineContent() {
  const [candidates, setCandidates] = useState(startingCandidates);
  const searchParams = useSearchParams();
  const requestedStage = searchParams.get("stage") ?? "all";
  const visibleStages = requestedStage === "all" ? stages : stages.filter((stage) => stage.toLowerCase().replace(/\s+/g, "-") === requestedStage);
  const stageLabel = visibleStages.length === 1 ? visibleStages[0] : "All pipeline stages";
  const moveCandidate = (name: string, stage: Candidate["stage"]) => setCandidates((current) => current.map((candidate) => candidate.name === name ? { ...candidate, stage, updated: "Just now" } : candidate));
  return <WorkspaceShell workspace="recruiter" active="pipeline" title="Candidate pipeline" description={`Senior Product Designer · ${stageLabel}`} actions={<><Button variant="secondary">Filter candidates</Button><Button href="/recruiter/jobs">Open job</Button></>}>
    {requestedStage !== "all" && <div className="pipeline-filter-hint"><span>Showing candidates in <b>{stageLabel}</b>. Clear the filter to return to every stage.</span><Button href="/recruiter/pipeline" variant="quiet">Clear filter</Button></div>}
    <section className="panel" style={{ marginBottom: 17 }}><div className="funnel"><div className="funnel-stage"><strong>48</strong>Applied</div><div className="funnel-stage"><strong>19</strong>Screened</div><div className="funnel-stage interview"><strong>8</strong>Interviewing</div><div className="funnel-stage final"><strong>3</strong>Final stage</div><div className="funnel-stage offer"><strong>2</strong>Offer</div><div className="funnel-stage hired"><strong>1</strong>Onboarded</div></div></section>
    <section className="pipeline-layout" aria-label="Candidate application stages">{visibleStages.map((stage) => { const grouped = candidates.filter((candidate) => candidate.stage === stage); return <article className={`pipeline-column ${grouped.length === 0 ? "empty-column" : ""}`} key={stage}><header className="pipeline-column-header"><h2>{stage}</h2><span className="pipeline-count">{grouped.length}</span></header><div className="pipeline-cards">{grouped.length ? grouped.map((candidate) => <CandidateCard candidate={candidate} key={candidate.name} moveCandidate={moveCandidate}/>) : <span>Move a candidate here when they are ready.</span>}</div></article>; })}</section>
  </WorkspaceShell>;
}

function CandidateCard({ candidate, moveCandidate }: { candidate: Candidate; moveCandidate: (name: string, stage: Candidate["stage"]) => void }) {
  const tone = candidate.stage === "Interviewing" ? "interview" : candidate.stage === "Final stage" ? "final" : candidate.stage === "Offer" ? "offer" : candidate.stage === "Onboarded" ? "hired" : "";
  return <article className={`pipeline-card ${tone}`}><div className="pipeline-card-head"><strong>{candidate.name}</strong><Badge tone={candidate.score > 92 ? "green" : "blue"}>{candidate.score}%</Badge></div><p>{candidate.role}</p><footer className="pipeline-card-footer"><small>Updated {candidate.updated}</small><select aria-label={`Move ${candidate.name} to`} value={candidate.stage} onChange={(event) => moveCandidate(candidate.name, event.target.value as Candidate["stage"])}>{stages.map((stage) => <option value={stage} key={stage}>{stage}</option>)}</select></footer></article>;
}
