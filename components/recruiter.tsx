"use client";

import { useState } from "react";
import { Badge, Button, SectionTitle, StatCard, WorkspaceShell } from "./ui";
import { MiniRecruiterAnalytics, RecruiterAnalyticsControls, SocialJobCard } from "./recruiter-tools";

type Candidate = { name: string; initials: string; role: string; stage: "Screening" | "Interview" | "Offer" | "Hired"; score: number; updated: string };

const startingCandidates: Candidate[] = [
  { name: "Amara Mensah", initials: "AM", role: "Senior Product Designer", stage: "Screening", score: 94, updated: "Today" },
  { name: "Nia Okafor", initials: "NO", role: "Senior Product Designer", stage: "Screening", score: 89, updated: "Today" },
  { name: "Eleanor Chen", initials: "EC", role: "Senior Product Designer", stage: "Interview", score: 91, updated: "Yesterday" },
  { name: "Lina Patel", initials: "LP", role: "Senior Product Designer", stage: "Offer", score: 96, updated: "2d ago" },
];

const internalJobs = [
  { title: "Senior Product Designer", department: "Product · London · Hybrid", status: "Active", tone: "green" as const, applications: "48", newApplications: "12 new", screening: "8 screening", recruiter: "Jordan Reyes", closing: "Closes 30 Aug" },
  { title: "Frontend Engineer", department: "Engineering · Remote · UK", status: "Active", tone: "green" as const, applications: "72", newApplications: "18 new", screening: "14 screening", recruiter: "Jordan Reyes", closing: "Closes 05 Sep" },
  { title: "Growth Marketing Lead", department: "Marketing · London · Hybrid", status: "Draft", tone: "amber" as const, applications: "—", newApplications: "Not published", screening: "—", recruiter: "Jordan Reyes", closing: "No closing date" },
];

export function RecruiterDashboard() {
  return <WorkspaceShell workspace="recruiter" active="dashboard" title="Recruitment overview" description="Thursday, 20 August · Nexora Technologies" actions={<><RecruiterAnalyticsControls/><Button href="/recruiter/pipeline" variant="secondary">View pipeline</Button><Button href="/recruiter/jobs">+ Create job</Button></>}>
    <section className="recruiter-hero"><div><h2>12 new applicants need your attention.</h2><p>Senior Product Designer has the most new activity. Review applicants while they are still engaged.</p></div><Button href="/recruiter/pipeline">Review applicants →</Button></section>
    <section className="stat-grid"><StatCard label="Active jobs" value="4" change="1 closing soon" tone="blue" icon="▤"/><StatCard label="New applications" value="31" change="+18% this week" tone="green" icon="↓"/><StatCard label="In interviews" value="8" change="3 scheduled today" tone="purple" icon="◷"/><StatCard label="Time to hire" value="24d" change="4 days faster" tone="amber" icon="◔"/></section>
    <div className="page-grid" style={{ marginTop: 20 }}><div className="stack"><section className="panel"><SectionTitle eyebrow="Hiring funnel" title="Senior Product Designer" action={<Button href="/recruiter/pipeline" variant="quiet">Open pipeline →</Button>}/><div className="funnel"><div className="funnel-stage"><strong>48</strong>Applied</div><div className="funnel-stage"><strong>19</strong>Screened</div><div className="funnel-stage interview"><strong>8</strong>Interview</div><div className="funnel-stage offer"><strong>2</strong>Offer</div><div className="funnel-stage hired"><strong>1</strong>Hired</div></div></section><section className="panel"><SectionTitle eyebrow="Active roles" title="Job performance" action={<Button href="/recruiter/jobs" variant="quiet">Manage jobs →</Button>}/><div className="job-mini-list">{internalJobs.slice(0, 3).map((job) => <div className="job-mini" key={job.title}><span className="stripe"/><div><strong>{job.title}</strong><small>{job.department}</small></div><b>{job.applications} <small>applicants</small></b></div>)}</div></section></div><aside className="stack"><section className="panel"><SectionTitle eyebrow="Analytics" title="Recruitment momentum"/><MiniRecruiterAnalytics/></section><section className="panel"><SectionTitle eyebrow="Your day" title="Upcoming interviews" action={<Button variant="quiet">Calendar →</Button>}/><div className="activity-list"><Activity icon="◷" title="Eleanor Chen" copy="Portfolio conversation · 10:30 AM"/><Activity icon="◷" title="Lina Patel" copy="Final interview · 2:00 PM"/><Activity icon="□" title="Team debrief" copy="Senior Product Designer · 4:30 PM"/></div></section><section className="panel"><SectionTitle eyebrow="Latest activity" title="Team updates"/><div className="activity-list"><Activity icon="+" title="Amara Mensah applied" copy="Senior Product Designer · 12 min ago"/><Activity icon="✓" title="Nia Okafor screened" copy="Moved to initial interview · 1 hr ago"/><Activity icon="✦" title="Feedback added" copy="by Jordan Reyes · 2 hrs ago"/></div></section></aside></div>
  </WorkspaceShell>;
}

function Activity({ icon, title, copy }: { icon: string; title: string; copy: string }) { return <div className="activity"><span className="activity-icon">{icon}</span><div><p><strong>{title}</strong></p><small>{copy}</small></div></div>; }

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

const stages: Candidate["stage"][] = ["Screening", "Interview", "Offer", "Hired"];

export function RecruiterPipeline() {
  const [candidates, setCandidates] = useState(startingCandidates);
  const moveCandidate = (name: string, stage: Candidate["stage"]) => setCandidates((current) => current.map((candidate) => candidate.name === name ? { ...candidate, stage, updated: "Just now" } : candidate));
  return <WorkspaceShell workspace="recruiter" active="pipeline" title="Candidate pipeline" description="Senior Product Designer · 48 applications" actions={<><Button variant="secondary">Filter candidates</Button><Button href="/recruiter/jobs">Open job</Button></>}>
    <section className="panel" style={{ marginBottom: 17 }}><div className="funnel"><div className="funnel-stage"><strong>48</strong>Applied</div><div className="funnel-stage"><strong>19</strong>Screened</div><div className="funnel-stage interview"><strong>8</strong>Interview</div><div className="funnel-stage offer"><strong>2</strong>Offer</div><div className="funnel-stage hired"><strong>1</strong>Hired</div></div></section>
    <section className="pipeline-layout" aria-label="Candidate application stages">{stages.map((stage) => { const grouped = candidates.filter((candidate) => candidate.stage === stage); return <article className={`pipeline-column ${grouped.length === 0 ? "empty-column" : ""}`} key={stage}><header className="pipeline-column-header"><h2>{stage}</h2><span className="pipeline-count">{grouped.length}</span></header><div className="pipeline-cards">{grouped.length ? grouped.map((candidate) => <CandidateCard candidate={candidate} key={candidate.name} moveCandidate={moveCandidate}/>) : <span>Move a candidate here when they are ready.</span>}</div></article>; })}</section>
  </WorkspaceShell>;
}

function CandidateCard({ candidate, moveCandidate }: { candidate: Candidate; moveCandidate: (name: string, stage: Candidate["stage"]) => void }) {
  const tone = candidate.stage === "Interview" ? "interview" : candidate.stage === "Offer" ? "offer" : candidate.stage === "Hired" ? "hired" : "";
  return <article className={`pipeline-card ${tone}`}><div className="pipeline-card-head"><strong>{candidate.name}</strong><Badge tone={candidate.score > 92 ? "green" : "blue"}>{candidate.score}%</Badge></div><p>{candidate.role}</p><footer className="pipeline-card-footer"><small>Updated {candidate.updated}</small><select aria-label={`Move ${candidate.name} to`} value={candidate.stage} onChange={(event) => moveCandidate(candidate.name, event.target.value as Candidate["stage"])}>{stages.map((stage) => <option value={stage} key={stage}>{stage}</option>)}</select></footer></article>;
}
