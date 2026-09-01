"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge, Button, Logo, SectionTitle, StatCard, WorkspaceShell } from "./ui";
import { publicJobPath } from "../lib/jobs/routes";
import { apiClient } from "../lib/api-client";
import { PublicJobSave } from "./public-job-save";
import { PublicJobShare } from "./public-job-share";

type Candidate = { id: number; candidateId?: string; applicationId?: string; jobId?: string; name: string; initials: string; role: string; stage: "Screening" | "Interviewing" | "Final stage" | "Offer" | "Onboarded"; score: number; email: string; phone: string; profileUpdated: string; lastActive: string; note: string; liveSkills?: string[] };
type LivePipelineCandidate = { applicationId: string; candidateId: string; fullName: string; headline: string | null; jobId: string; jobTitle: string; skills: string[]; maskedEmail: string; maskedMobile: string; pipelineStage: string; recentNotes: string[]; profileLastUpdatedAt: string | null; lastActiveAt: string | null };
type LivePipelinePage = { content: LivePipelineCandidate[] };

function pipelineJobIdForCandidate(candidate: Candidate) {
  return candidate.role.includes("Engineer") ? "SWX_NT_004" : "SWX_NT_003";
}

const startingCandidates: Candidate[] = [
  { id: 1, name: "Amara Mensah", initials: "AM", role: "Senior Product Designer", stage: "Screening", score: 94, email: "amara.mensah@email.com", phone: "+91 98765 40123", profileUpdated: "Today, 10:42", lastActive: "18 min ago", note: "Strong design-systems background. Confirm stakeholder management experience." },
  { id: 2, name: "Nia Okafor", initials: "NO", role: "Senior Product Designer", stage: "Screening", score: 89, email: "nia.okafor@email.com", phone: "+91 98124 55621", profileUpdated: "Today, 09:18", lastActive: "1 hr ago", note: "Portfolio is a strong match for B2B product work." },
  { id: 3, name: "Eleanor Chen", initials: "EC", role: "Senior Product Designer", stage: "Interviewing", score: 91, email: "eleanor.chen@email.com", phone: "+91 99670 14283", profileUpdated: "Yesterday, 17:25", lastActive: "2 days ago", note: "Portfolio interview booked for Thursday at 10:30 AM." },
  { id: 4, name: "Lina Patel", initials: "LP", role: "Senior Product Designer", stage: "Offer", score: 96, email: "lina.patel@email.com", phone: "+91 99220 63945", profileUpdated: "Yesterday, 14:10", lastActive: "2 days ago", note: "Offer shared. Awaiting response by Friday." },
  { id: 5, name: "Aarav Mehta", initials: "AM", role: "Frontend Engineer", stage: "Screening", score: 92, email: "aarav.mehta@email.com", phone: "+91 98980 12467", profileUpdated: "2 days ago", lastActive: "5 days ago", note: "React and TypeScript experience should be validated in screening." },
  { id: 6, name: "Sofia Martin", initials: "SM", role: "Frontend Engineer", stage: "Interviewing", score: 88, email: "sofia.martin@email.com", phone: "+91 97645 33219", profileUpdated: "2 days ago", lastActive: "6 days ago", note: "Technical interview feedback pending." },
  { id: 7, name: "David Okoro", initials: "DO", role: "Design Lead", stage: "Final stage", score: 95, email: "david.okoro@email.com", phone: "+91 97861 90045", profileUpdated: "3 days ago", lastActive: "12 days ago", note: "Final panel scorecard is due from the product lead." },
  { id: 8, name: "Ivy Williams", initials: "IW", role: "Product Designer", stage: "Screening", score: 84, email: "ivy.williams@email.com", phone: "+91 98712 72531", profileUpdated: "4 days ago", lastActive: "13 days ago", note: "Review domain experience before scheduling." },
  { id: 9, name: "Maya Singh", initials: "MS", role: "UX Researcher", stage: "Onboarded", score: 93, email: "maya.singh@email.com", phone: "+91 98940 21678", profileUpdated: "1 week ago", lastActive: "24 days ago", note: "Offer accepted. Start-date documentation is in progress." },
  { id: 10, name: "Jon Bell", initials: "JB", role: "Product Designer", stage: "Screening", score: 82, email: "jon.bell@email.com", phone: "+91 99832 41092", profileUpdated: "1 week ago", lastActive: "28 days ago", note: "Good visual design; assess research depth in first call." },
  { id: 11, name: "Priya Shah", initials: "PS", role: "Senior Product Designer", stage: "Final stage", score: 97, email: "priya.shah@email.com", phone: "+91 97543 66820", profileUpdated: "9 days ago", lastActive: "45 days ago", note: "Reference check is the final outstanding item." },
  { id: 12, name: "Tom Russell", initials: "TR", role: "Interaction Designer", stage: "Interviewing", score: 86, email: "tom.russell@email.com", phone: "+91 98452 73106", profileUpdated: "10 days ago", lastActive: "56 days ago", note: "Invite the design manager to the next interview." },
];

type CandidateAttributes = { experience: number; salary: number; qualification: "Bachelors" | "Masters"; notice: "Immediate" | "15 days" | "30 days" | "60 days" | "90 days"; activeDays: number; skills: string[] };
const candidateAttributes: Record<number, CandidateAttributes> = {
  1: { experience: 6, salary: 72000, qualification: "Masters", notice: "30 days", activeDays: 1, skills: ["Figma", "Design systems", "Research"] },
  2: { experience: 5, salary: 64000, qualification: "Bachelors", notice: "15 days", activeDays: 1, skills: ["Figma", "Prototyping", "B2B SaaS"] },
  3: { experience: 7, salary: 76000, qualification: "Masters", notice: "30 days", activeDays: 3, skills: ["Design systems", "Accessibility", "Figma"] },
  4: { experience: 4, salary: 58000, qualification: "Bachelors", notice: "Immediate", activeDays: 3, skills: ["User research", "Figma", "Workshops"] },
  5: { experience: 6, salary: 70000, qualification: "Masters", notice: "60 days", activeDays: 7, skills: ["React", "Node.js", "TypeScript"] },
  6: { experience: 8, salary: 78000, qualification: "Bachelors", notice: "30 days", activeDays: 7, skills: ["React", "Accessibility", "TypeScript"] },
  7: { experience: 9, salary: 88000, qualification: "Masters", notice: "90 days", activeDays: 15, skills: ["Leadership", "Design systems", "Figma"] },
  8: { experience: 5, salary: 63000, qualification: "Bachelors", notice: "30 days", activeDays: 15, skills: ["Figma", "Research", "Mobile"] },
  9: { experience: 5, salary: 66000, qualification: "Masters", notice: "15 days", activeDays: 30, skills: ["Research", "Analytics", "Figma"] },
  10: { experience: 3, salary: 50000, qualification: "Bachelors", notice: "Immediate", activeDays: 30, skills: ["Figma", "UI design", "HTML"] },
  11: { experience: 7, salary: 77000, qualification: "Masters", notice: "30 days", activeDays: 60, skills: ["Figma", "Research", "Leadership"] },
  12: { experience: 4, salary: 56000, qualification: "Bachelors", notice: "60 days", activeDays: 60, skills: ["Prototyping", "Figma", "Motion"] },
};

type PipelineCandidateCardDetails = { currentCompany: string; previousRole: string; previousCompany: string; education: string; preferredLocations: string; summary: string; mayKnow: string; views: number; downloads: number };
const pipelineCandidateCardDetails: Record<number, PipelineCandidateCardDetails> = {
  1: { currentCompany: "Cobalt Studio", previousRole: "Product Designer", previousCompany: "Northstar Labs", education: "M.Des, National Institute of Design 2020", preferredLocations: "Bengaluru, Pune, Remote", summary: "Product designer specialising in design systems and B2B product experiences.", mayKnow: "Workshops | Accessibility | Product strategy", views: 147, downloads: 31 },
  2: { currentCompany: "Lattice Health", previousRole: "UX Designer", previousCompany: "Brightside", education: "B.Des, Srishti Institute 2021", preferredLocations: "Bengaluru, Hyderabad, Remote", summary: "Product designer with strong prototyping and enterprise SaaS experience.", mayKnow: "User research | Design systems | Analytics", views: 112, downloads: 22 },
  3: { currentCompany: "Meridian Cloud", previousRole: "Product Designer", previousCompany: "Orbit Systems", education: "M.Des, IIT Bombay 2018", preferredLocations: "Pune, Bengaluru, Remote", summary: "Accessible interface specialist with a record of scaling product platforms.", mayKnow: "Interaction design | Workshops | Leadership", views: 188, downloads: 39 },
  4: { currentCompany: "Fieldnote", previousRole: "UX Researcher", previousCompany: "Pivotal Works", education: "B.Des, MIT Institute of Design 2022", preferredLocations: "Pune, Mumbai, Remote", summary: "Collaborative product designer who connects research insights to clear experiences.", mayKnow: "Service design | Research synthesis | Prototyping", views: 136, downloads: 28 },
  5: { currentCompany: "Aperture Commerce", previousRole: "Software Engineer", previousCompany: "Vector Labs", education: "M.Tech, BITS Pilani 2019", preferredLocations: "Bengaluru, Pune, Remote", summary: "Frontend engineer building reliable React and TypeScript product surfaces.", mayKnow: "Node.js | Design systems | AWS", views: 204, downloads: 42 },
  6: { currentCompany: "Nexora Digital", previousRole: "Frontend Developer", previousCompany: "Mode Studio", education: "B.Tech, VIT Vellore 2017", preferredLocations: "Chennai, Bengaluru, Remote", summary: "Accessibility-minded engineer with deep modern frontend delivery experience.", mayKnow: "Performance | Testing | UI architecture", views: 163, downloads: 34 },
  7: { currentCompany: "Juniper Design", previousRole: "Senior Product Designer", previousCompany: "Harbour Tech", education: "M.Des, IIT Delhi 2016", preferredLocations: "Delhi NCR, Bengaluru, Remote", summary: "Design leader experienced in shaping product practice and mentoring teams.", mayKnow: "Product strategy | Research | Team leadership", views: 219, downloads: 48 },
  8: { currentCompany: "Civic Loop", previousRole: "UX Designer", previousCompany: "Atlas Studio", education: "B.Des, Pearl Academy 2020", preferredLocations: "Bengaluru, Mumbai, Remote", summary: "Thoughtful product designer balancing discovery, interaction and visual craft.", mayKnow: "Mobile design | Workshops | Research", views: 109, downloads: 19 },
  9: { currentCompany: "Signal Research", previousRole: "Research Associate", previousCompany: "Insight Collective", education: "M.A., Tata Institute of Social Sciences 2020", preferredLocations: "Pune, Bengaluru, Remote", summary: "UX researcher translating behavioural evidence into product decisions.", mayKnow: "Analytics | Service design | Facilitation", views: 131, downloads: 26 },
  10: { currentCompany: "Kindred Studio", previousRole: "Visual Designer", previousCompany: "Pattern Works", education: "B.Des, Symbiosis Institute of Design 2022", preferredLocations: "Pune, Mumbai, Remote", summary: "Visual product designer with a strong foundation in UI craft and research.", mayKnow: "Design systems | Prototyping | HTML", views: 88, downloads: 14 },
  11: { currentCompany: "Tangent Products", previousRole: "Product Designer", previousCompany: "Willow Labs", education: "M.Des, National Institute of Design 2017", preferredLocations: "Bengaluru, Delhi NCR, Remote", summary: "Senior designer combining product research, systems thinking and leadership.", mayKnow: "Strategy | Mentoring | Accessibility", views: 231, downloads: 51 },
  12: { currentCompany: "Arc Motion", previousRole: "Interaction Designer", previousCompany: "Framehouse", education: "B.Des, Srishti Institute 2021", preferredLocations: "Bengaluru, Hyderabad, Remote", summary: "Interaction designer with motion, prototyping and product storytelling strengths.", mayKnow: "UI design | Research | Design systems", views: 97, downloads: 16 },
};

const internalJobs = [
  { id: "senior-product-designer", title: "Senior Product Designer", department: "Product · London · Hybrid", status: "Active", tone: "green" as const, applications: "48", newApplications: "12 new", screening: "8 screening", recruiter: "Jordan Reyes", closing: "Closes 30 Aug" },
  { id: "frontend-engineer", title: "Frontend Engineer", department: "Engineering · Remote · UK", status: "Active", tone: "green" as const, applications: "72", newApplications: "18 new", screening: "14 screening", recruiter: "Jordan Reyes", closing: "Closes 05 Sep" },
  { id: "growth-marketing-lead", title: "Growth Marketing Lead", department: "Marketing · London · Hybrid", status: "Draft", tone: "amber" as const, applications: "—", newApplications: "Not published", screening: "—", recruiter: "Jordan Reyes", closing: "No closing date" },
];

type ManagedJobStatus = "Draft" | "Published" | "Closed" | "Archived";
type ManagedJob = { id: string; jobId: string; title: string; status: ManagedJobStatus; location: string; createdAt: string; applicants: number; skills: string[]; minimumExperience: string; maximumExperience: string; minimumSalary: string; maximumSalary: string; description: string; organisationName?: string; newApplicants?: number; screening?: number; interviewing?: number; finalStage?: number; offers?: number; onboarded?: number; rejected?: number; latestApplicationAt?: string | null };
type ShareableJob = { jobId: string; title: string; company: string; location: string; skills: string[]; experience: string };

const managedJobs: ManagedJob[] = [
  { id: "growth-marketing-lead", jobId: "SWX_NT_001", title: "Growth Marketing Lead", status: "Draft", location: "London, UK · Hybrid", createdAt: "2026-08-18", applicants: 0, skills: ["Growth strategy", "Lifecycle", "Analytics"], minimumExperience: "5", maximumExperience: "8", minimumSalary: "20", maximumSalary: "28", description: "<p>Lead the growth strategy for a product people love.</p><ul><li>Own lifecycle experiments</li><li>Partner with product and sales</li></ul>" },
  { id: "product-marketing-manager", jobId: "SWX_NT_002", title: "Product Marketing Manager", status: "Draft", location: "Bengaluru, India · Hybrid", createdAt: "2026-08-12", applicants: 0, skills: ["Positioning", "Go-to-market", "B2B SaaS"], minimumExperience: "4", maximumExperience: "7", minimumSalary: "16", maximumSalary: "24", description: "<p>Shape product narratives and go-to-market launches for our next chapter.</p>" },
  { id: "senior-product-designer", jobId: "SWX_NT_003", title: "Senior Product Designer", status: "Published", location: "London, UK · Hybrid", createdAt: "2026-08-05", applicants: 48, skills: ["Figma", "Design systems", "Research"], minimumExperience: "5", maximumExperience: "8", minimumSalary: "18", maximumSalary: "26", description: "<p>Design exceptional experiences for growing teams.</p>" },
  { id: "frontend-engineer", jobId: "SWX_NT_004", title: "Frontend Engineer", status: "Published", location: "Remote · India", createdAt: "2026-07-30", applicants: 72, skills: ["React", "TypeScript", "Accessibility"], minimumExperience: "3", maximumExperience: "6", minimumSalary: "18", maximumSalary: "26", description: "<p>Build fast, accessible web experiences with a collaborative engineering team.</p>" },
  { id: "talent-operations-specialist", jobId: "SWX_NT_005", title: "Talent Operations Specialist", status: "Closed", location: "Pune, India · Hybrid", createdAt: "2026-07-12", applicants: 91, skills: ["ATS", "Coordination", "Analytics"], minimumExperience: "3", maximumExperience: "5", minimumSalary: "10", maximumSalary: "14", description: "<p>Improve the systems behind a thoughtful hiring experience.</p>" },
  { id: "brand-designer", jobId: "SWX_NT_006", title: "Brand Designer", status: "Archived", location: "Remote · India", createdAt: "2026-06-26", applicants: 34, skills: ["Brand systems", "Illustration", "Figma"], minimumExperience: "4", maximumExperience: "7", minimumSalary: "15", maximumSalary: "22", description: "<p>Bring a distinct, trusted visual voice to Sapienworx.</p>" },
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

export type RecruiterDashboardData = { openPositions: number; activeApplications: number; draftJobs: number; funnel: Record<string, number> };

export function RecruiterDashboard({ initialData }: { initialData?: RecruiterDashboardData | null }) {
  const [period, setPeriod] = useState<AnalyticsPeriod>("30");
  const [exportStatus, setExportStatus] = useState("");
  const [funnelId, setFunnelId] = useState(roleFunnels[0].id);
  const [jobView, setJobView] = useState<"active" | "draft">("active");
  const [activityOpen, setActivityOpen] = useState(true);
  const baseAnalytics = analyticsByPeriod[period];
  const analytics = initialData ? { ...baseAnalytics, openPositions: initialData.openPositions, activeApplications: initialData.activeApplications,
    screening: initialData.funnel.SCREENING ?? 0, interviewing: initialData.funnel.INTERVIEWING ?? 0,
    finalStage: initialData.funnel.FINAL_STAGE ?? 0, offers: initialData.funnel.OFFER ?? 0,
    onboarded: initialData.funnel.ONBOARDED ?? 0 } : baseAnalytics;
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
      <div className="page-grid dashboard-main-grid"><div className="stack dashboard-primary"><section className="panel dashboard-funnel"><header className="funnel-card-header"><div><span className="eyebrow">Role-specific hiring funnel</span><div className="funnel-title-row"><h2>{selectedFunnel.title}</h2><label className="sr-only" htmlFor="role-funnel">Choose an active role</label><select id="role-funnel" value={funnelId} onChange={(event) => setFunnelId(event.target.value)}>{roleFunnels.map((role) => <option value={role.id} key={role.id}>{role.title}</option>)}</select></div><p>{selectedFunnel.context}</p></div><Button href={`/recruiter/pipeline?role=${selectedFunnel.id}`} variant="quiet">Open pipeline →</Button></header><div className="funnel"><div className="funnel-stage"><strong>{selectedFunnel.applied}</strong>Applied</div><div className="funnel-stage"><strong>{selectedFunnel.screening}</strong>Screening</div><div className="funnel-stage interview"><strong>{selectedFunnel.interviewing}</strong>Interviewing</div><div className="funnel-stage final"><strong>{selectedFunnel.finalStage}</strong>Final stage</div><div className="funnel-stage offer"><strong>{selectedFunnel.offers}</strong>Offer</div><div className="funnel-stage hired"><strong>{selectedFunnel.onboarded}</strong>Onboarded</div></div><div className="funnel-summary"><span><b>{Math.round((selectedFunnel.interviewing / selectedFunnel.applied) * 100)}%</b> reach interview</span><span><b>{Math.round((selectedFunnel.onboarded / selectedFunnel.applied) * 100)}%</b> convert to hire</span><span><b>{selectedFunnel.finalStage}</b> waiting for final decision</span></div></section><section className="panel dashboard-jobs"><header className="job-performance-header"><div><span className="eyebrow">Job performance</span><h2>{jobView === "active" ? "Active roles" : "Draft roles"}</h2></div><Button href="/recruiter/jobs/manage" variant="quiet">Manage jobs →</Button></header><div className="job-role-tabs" role="tablist" aria-label="Job performance view"><button className={jobView === "active" ? "active" : ""} onClick={() => setJobView("active")} role="tab" aria-selected={jobView === "active"}>Active roles <span>{internalJobs.filter((job) => job.status === "Active").length}</span></button><button className={jobView === "draft" ? "active" : ""} onClick={() => setJobView("draft")} role="tab" aria-selected={jobView === "draft"}>Draft roles <span>{internalJobs.filter((job) => job.status === "Draft").length}</span></button></div><div className="job-mini-list">{visibleJobs.map((job) => <a className="job-mini job-mini-link" href={job.status === "Draft" ? `/recruiter/jobs?draft=${job.id}` : "/recruiter/jobs/manage"} key={job.id}><span className="stripe"/><div><strong>{job.title}</strong><small>{job.status === "Draft" ? "Resume editing draft →" : job.department}</small></div><b>{job.applications} <small>{jobView === "active" ? "applicants" : "draft"}</small></b></a>)}</div></section></div><aside className="stack dashboard-aside"><section className="panel dashboard-analytics"><SectionTitle eyebrow="Analytics" title="Recruitment momentum"/><div className="analytics-mini"><div><span>Pipeline health</span><strong>{analytics.pipelineHealth}%</strong><span className="meter"><span className="meter-fill meter-green" style={{ width: `${analytics.pipelineHealth}%` }}/></span></div><div><span>Candidate response rate</span><strong>{analytics.responseRate}%</strong><span className="meter"><span className="meter-fill meter-blue" style={{ width: `${analytics.responseRate}%` }}/></span></div><div><span>Average time to hire</span><strong>{analytics.timeToHire}</strong><small className="positive">4 days faster than target</small></div></div></section><section className="panel dashboard-interviews"><SectionTitle eyebrow="Your day" title="Upcoming interviews" action={<Button variant="quiet">Calendar →</Button>}/><div className="interview-list"><Interview time="10:30 AM" name="Eleanor Chen" copy="Portfolio conversation" platform="Google Meet"/><Interview time="2:00 PM" name="Lina Patel" copy="Final interview" platform="Microsoft Teams"/><Interview time="4:30 PM" name="Team debrief" copy="Senior Product Designer" platform="In person"/></div></section><section className="panel dashboard-activity"><button className="activity-collapse-trigger" onClick={() => setActivityOpen((current) => !current)} aria-expanded={activityOpen}><span><i>Recent activity</i><strong>Live system events</strong></span><b>{activityOpen ? "−" : "+"}</b></button>{activityOpen && <div className="activity-list activity-list-expanded"><Activity icon="✓" title="Maya Singh accepted an offer" copy="Frontend Engineer · 8 min ago" lastActive="Last active 4 min ago"/><Activity icon="+" title="Amara Mensah applied" copy="Senior Product Designer · 12 min ago" lastActive="Last active 18 min ago"/><Activity icon="✦" title="Team debrief note added" copy="by Jordan Reyes · 2 hrs ago"/></div>}</section></aside></div>
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

export function RecruiterJobs() { return <Suspense fallback={<WorkspaceShell workspace="recruiter" active="jobs" title="Create a job" description="Loading job workspace…"><section className="panel">Loading job workspace…</section></WorkspaceShell>}><RecruiterJobsContent/></Suspense>; }

type RecruiterJobApiResponse = {
  jobId: string;
  title: string;
  organisationName: string;
  verifiedEmployer: boolean;
  location: string;
  department: string;
  employmentType: string;
  workplaceModel: string;
  minimumExperienceYears: number;
  maximumExperienceYears: number;
  minimumSalaryLakhs: number | null;
  maximumSalaryLakhs: number | null;
  salaryVisible: boolean;
  descriptionHtml: string;
  companyOverview: string;
  whyJoin: string;
  responsibilitiesHtml: string;
  hiringProcess: string;
  skills: string[];
  status: string;
  domainCategory: string;
  publicPath: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  publishedAt?: string | null;
};

type RecruiterManagedJobApiResponse = {
  job: RecruiterJobApiResponse;
  applicants: number;
  newApplicants: number;
  screening: number;
  interviewing: number;
  finalStage: number;
  offers: number;
  onboarded: number;
  rejected: number;
  latestApplicationAt: string | null;
};

type RecruiterManagedJobsPage = { content: RecruiterManagedJobApiResponse[] };

type RecruiterJobApplicantApiResponse = {
  applicationId: string;
  candidateId: string;
  fullName: string;
  headline: string | null;
  skills: string[];
  pipelineStage: string;
  appliedAt: string | null;
  updatedAt: string | null;
  lastActiveAt: string | null;
  applicationSource: string;
};

type RecruiterJobWorkspaceApiResponse = {
  summary: RecruiterManagedJobApiResponse;
  applications: { content: RecruiterJobApplicantApiResponse[]; totalElements: number; totalPages: number; number: number };
};

const defaultHiringProcess = "Application review\nRecruiter conversation\nRole-focused conversation\nFinal team conversation and decision";

function RecruiterJobsContent() {
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft");
  const duplicateId = searchParams.get("duplicate");
  const editId = searchParams.get("edit");
  const requestedJobId = searchParams.get("jobId");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [employmentType, setEmploymentType] = useState("FULL_TIME");
  const [workplaceModel, setWorkplaceModel] = useState("HYBRID");
  const [domainCategory, setDomainCategory] = useState("TECH");
  const [location, setLocation] = useState("");
  const [minimumExperience, setMinimumExperience] = useState("");
  const [maximumExperience, setMaximumExperience] = useState("");
  const [minimumSalary, setMinimumSalary] = useState("");
  const [maximumSalary, setMaximumSalary] = useState("");
  const [description, setDescription] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [companyOverview, setCompanyOverview] = useState("");
  const [whyJoin, setWhyJoin] = useState("");
  const [hiringProcess, setHiringProcess] = useState(defaultHiringProcess);
  const [skills, setSkills] = useState<string[]>(["Product design", "Figma"]);
  const [removingSkills, setRemovingSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [status, setStatus] = useState<"editing" | "draft" | "published">("editing");
  const [jobId, setJobId] = useState("");
  const [organisationName, setOrganisationName] = useState("Nexora Technologies");
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [jobIdNotice, setJobIdNotice] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [shareJob, setShareJob] = useState<ShareableJob | null>(null);

  useEffect(() => {
    const source = managedJobs.find((job) => job.id === draftId || job.id === duplicateId || job.id === editId);
    if (source) {
      setTitle(source.title);
      setLocation(source.location);
      setMinimumExperience(source.minimumExperience);
      setMaximumExperience(source.maximumExperience);
      setMinimumSalary(source.minimumSalary);
      setMaximumSalary(source.maximumSalary);
      setDescription(source.description);
      setSkills(source.skills);
      setDepartment(source.title.toLowerCase().includes("engineer") ? "Engineering" : "Product");
      setJobId(duplicateId ? "" : source.jobId);
      setStatus(source.status === "Published" && !duplicateId ? "editing" : "draft");
    }

    const lookupJobId = requestedJobId ?? source?.jobId;
    if (!lookupJobId) return;
    let cancelled = false;
    apiClient<RecruiterJobApiResponse>(`/api/recruiter/jobs/${encodeURIComponent(lookupJobId)}`)
      .then((job) => {
        if (cancelled) return;
        setTitle(duplicateId ? `${job.title} (copy)` : job.title);
        setDepartment(job.department ?? "");
        setEmploymentType(job.employmentType ?? "FULL_TIME");
        setWorkplaceModel(job.workplaceModel ?? "HYBRID");
        setDomainCategory(job.domainCategory ?? "UNASSIGNED");
        setLocation(job.location ?? "");
        setMinimumExperience(String(job.minimumExperienceYears ?? ""));
        setMaximumExperience(String(job.maximumExperienceYears ?? ""));
        setMinimumSalary(job.minimumSalaryLakhs == null ? "" : String(job.minimumSalaryLakhs));
        setMaximumSalary(job.maximumSalaryLakhs == null ? "" : String(job.maximumSalaryLakhs));
        setDescription(job.descriptionHtml ?? "");
        setResponsibilities(job.responsibilitiesHtml ?? "");
        setCompanyOverview(job.companyOverview ?? "");
        setWhyJoin(job.whyJoin ?? "");
        setHiringProcess(job.hiringProcess || defaultHiringProcess);
        setSkills(job.skills ?? []);
        setOrganisationName(job.organisationName || "Nexora Technologies");
        setJobId(duplicateId ? "" : job.jobId);
        setStatus(job.status === "ACTIVE" && !duplicateId ? "editing" : "draft");
      })
      .catch((error: unknown) => {
        if (!cancelled) setSubmissionError(error instanceof Error ? error.message : "The job draft could not be loaded.");
      });
    return () => { cancelled = true; };
  }, [draftId, duplicateId, editId, requestedJobId]);

  const addSkill = () => { const skill = skillInput.trim().replace(/,$/, ""); if (skill && !skills.some((item) => item.toLowerCase() === skill.toLowerCase())) setSkills((current) => [...current, skill]); setSkillInput(""); };
  const removeSkill = (skill: string) => { setRemovingSkills((current) => [...current, skill]); window.setTimeout(() => { setSkills((current) => current.filter((item) => item !== skill)); setRemovingSkills((current) => current.filter((item) => item !== skill)); }, 160); };
  const experienceLabel = minimumExperience || maximumExperience ? `${minimumExperience || "0"}–${maximumExperience || "…"} years` : "Experience not set";
  const hiringSteps = hiringProcess.split("\n").map((step) => step.trim()).filter(Boolean);
  const storyReady = Boolean(richTextToPlainText(description) && richTextToPlainText(responsibilities) && companyOverview.trim() && whyJoin.trim() && hiringSteps.length >= 3);
  const readyToPublish = Boolean(title.trim() && department.trim() && location.trim() && minimumExperience && maximumExperience && skills.length && storyReady);
  const markEditing = () => { setStatus("editing"); setSubmissionError(""); setJobIdNotice(""); };

  const jobPayload = () => ({
    title,
    department,
    employmentType,
    workplaceModel,
    location,
    minimumExperienceYears: minimumExperience ? Number(minimumExperience) : null,
    maximumExperienceYears: maximumExperience ? Number(maximumExperience) : null,
    minimumSalaryLakhs: minimumSalary ? Number(minimumSalary) : null,
    maximumSalaryLakhs: maximumSalary ? Number(maximumSalary) : null,
    salaryVisible: false,
    descriptionHtml: description,
    companyOverview,
    whyJoin,
    responsibilitiesHtml: responsibilities,
    hiringProcess,
    skills,
    domainCategory,
  });

  const persistDraft = async () => {
    const draft = await apiClient<RecruiterJobApiResponse>(jobId ? `/api/recruiter/jobs/${encodeURIComponent(jobId)}` : "/api/recruiter/jobs", {
      method: jobId ? "PATCH" : "POST",
      body: JSON.stringify(jobPayload()),
    });
    setJobId(draft.jobId);
    setOrganisationName(draft.organisationName || organisationName);
    return draft;
  };

  const saveDraft = async () => {
    setIsSaving(true);
    setSubmissionError("");
    setJobIdNotice("Saving this draft…");
    try {
      const saved = await persistDraft();
      setStatus("draft");
      setJobIdNotice(`Draft saved as ${saved.jobId}.`);
    } catch (error) {
      setJobIdNotice("");
      setSubmissionError(error instanceof Error ? error.message : "The draft could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  const publish = async () => {
    if (!readyToPublish) {
      setSubmissionError("Complete the role basics, requirements, company story, responsibilities and at least three hiring stages before publishing.");
      return;
    }
    setIsPublishing(true);
    setSubmissionError("");
    setJobIdNotice("Saving and publishing this role…");
    try {
      const saved = await persistDraft();
      const published = await apiClient<RecruiterJobApiResponse>(`/api/recruiter/jobs/${encodeURIComponent(saved.jobId)}/publish`, { method: "POST" });
      setStatus("published");
      setJobId(published.jobId);
      setJobIdNotice(`Published as ${published.jobId}.`);
      setShareJob({ jobId: published.jobId, title: published.title, company: published.organisationName, location: published.location, skills: published.skills, experience: `${published.minimumExperienceYears}–${published.maximumExperienceYears} years` });
    } catch (error) {
      setJobIdNotice("");
      setSubmissionError(error instanceof Error ? error.message : "The job could not be published.");
    } finally {
      setIsPublishing(false);
    }
  };

  return <WorkspaceShell workspace="recruiter" active="jobs" title="Post a job" description="Build the role, review its candidate-facing card, then publish and share it.">
    {status === "draft" && <div className="creation-success" role="status">Draft saved{jobId ? ` as ${jobId}` : ""}. Continue refining the role or publish it when ready.</div>}
    {status === "published" && <div className="creation-success" role="status"><strong>{title}</strong> is published as <strong>{jobId}</strong> and ready to share.</div>}
    <ol className="job-publishing-roadmap" aria-label="Job publishing progress"><li className={title && location && department ? "complete" : "current"}><span>{title && location && department ? "✓" : "1"}</span><div><strong>Role basics</strong><small>Title, team and working model</small></div></li><li className={minimumExperience && maximumExperience && skills.length ? "complete" : ""}><span>2</span><div><strong>Requirements</strong><small>Experience and skills</small></div></li><li className={storyReady ? "complete" : ""}><span>3</span><div><strong>Candidate story</strong><small>Role, company and process</small></div></li><li className={status === "published" ? "complete" : ""}><span>4</span><div><strong>Publish & share</strong><small>Final review and distribution</small></div></li></ol>
    <section className="job-creation-layout">
      <form className="panel job-creation-form" onSubmit={(event) => { event.preventDefault(); void publish(); }}>
        <SectionTitle eyebrow="Job details" title={draftId ? "Resume your draft" : "Create your job"}/>
        <p className="form-hint">Save an incomplete draft at any time. Only a complete, published role is visible to candidates. The employer identity comes from your verified organisation profile.</p>
        {submissionError && <div className="job-publish-error" role="alert">{submissionError}</div>}
        {jobIdNotice && <div className="job-save-notice" role="status">{jobIdNotice}</div>}
        <div className="form-grid job-form-grid">
          <label className="form-field full"><span>Job title</span><input aria-label="Job title" value={title} onChange={(event) => { setTitle(event.target.value); markEditing(); }} placeholder="e.g. Senior Product Designer"/></label>
          <label className="form-field full"><span>Department or team</span><input aria-label="Department or team" value={department} onChange={(event) => { setDepartment(event.target.value); markEditing(); }} placeholder="e.g. Product design"/></label>
          <label className="form-field"><span>Employment type</span><select aria-label="Employment type" value={employmentType} onChange={(event) => { setEmploymentType(event.target.value); markEditing(); }}><option value="FULL_TIME">Full time</option><option value="PART_TIME">Part time</option><option value="CONTRACT">Contract</option><option value="INTERNSHIP">Internship</option><option value="TEMPORARY">Temporary</option><option value="FREELANCE">Freelance</option></select></label>
          <label className="form-field"><span>Workplace model</span><select aria-label="Workplace model" value={workplaceModel} onChange={(event) => { setWorkplaceModel(event.target.value); markEditing(); }}><option value="ON_SITE">On site</option><option value="HYBRID">Hybrid</option><option value="REMOTE">Remote</option></select></label>
          <label className="form-field full"><span>Role category</span><select aria-label="Role category" value={domainCategory} onChange={(event) => { setDomainCategory(event.target.value); markEditing(); }}><option value="TECH">Technology</option><option value="NON_TECH">Non-technology</option><option value="MIXED_AMBIGUOUS">Cross-functional</option><option value="UNASSIGNED">Unassigned</option></select></label>
          <label className="form-field full"><span>Location</span><input aria-label="Location" value={location} onChange={(event) => { setLocation(event.target.value); markEditing(); }} placeholder="e.g. Bengaluru, India"/></label>
          <div className="job-range-group full"><span>Experience</span><div><label className="form-field"><span>Minimum years</span><input aria-label="Minimum experience" type="number" min="0" value={minimumExperience} onChange={(event) => { setMinimumExperience(event.target.value); markEditing(); }} placeholder="e.g. 3"/></label><label className="form-field"><span>Maximum years</span><input aria-label="Maximum experience" type="number" min="0" value={maximumExperience} onChange={(event) => { setMaximumExperience(event.target.value); markEditing(); }} placeholder="e.g. 6"/></label></div></div>
          <div className="job-range-group full"><span>Internal compensation range <em>Optional</em></span><div><label className="form-field"><span>Minimum salary in lakhs</span><input aria-label="Minimum salary in lakhs" type="number" min="0" value={minimumSalary} onChange={(event) => { setMinimumSalary(event.target.value); markEditing(); }} placeholder="e.g. 12"/></label><label className="form-field"><span>Maximum salary in lakhs</span><input aria-label="Maximum salary in lakhs" type="number" min="0" value={maximumSalary} onChange={(event) => { setMaximumSalary(event.target.value); markEditing(); }} placeholder="e.g. 18"/></label></div><small className="job-internal-note">Used for matching and internal reporting. Sapienworx does not display this range to candidates.</small></div>
          <label className="form-field full"><span>Skills</span><div className="job-skills-input"><div>{skills.map((skill) => <span className={`job-skill-tag ${removingSkills.includes(skill) ? "removing" : ""}`} key={skill}>{skill}<button type="button" aria-label={`Remove ${skill}`} onClick={() => { removeSkill(skill); markEditing(); }}>×</button></span>)}</div><input aria-label="Add a skill" value={skillInput} onChange={(event) => setSkillInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addSkill(); markEditing(); } }} onBlur={() => { addSkill(); markEditing(); }} placeholder="Add a skill and press Enter"/></div></label>
          <div className="form-field full"><span>Role summary</span><RichJobEditor label="Role summary" placeholder="Describe the role, its purpose and what success looks like…" value={description} onChange={(value) => { setDescription(value); markEditing(); }}/></div>
          <div className="form-field full"><span>Responsibilities</span><RichJobEditor label="Responsibilities" placeholder="Add the outcomes and responsibilities candidates should understand before applying…" value={responsibilities} onChange={(value) => { setResponsibilities(value); markEditing(); }}/></div>
          <label className="form-field full"><span>Company overview</span><textarea aria-label="Company overview" value={companyOverview} onChange={(event) => { setCompanyOverview(event.target.value); markEditing(); }} rows={4} maxLength={5000} placeholder="Introduce the company, its mission and the team this person will join."/></label>
          <label className="form-field full"><span>Why join</span><textarea aria-label="Why join" value={whyJoin} onChange={(event) => { setWhyJoin(event.target.value); markEditing(); }} rows={4} maxLength={5000} placeholder="Give candidates honest reasons to consider this opportunity."/></label>
          <label className="form-field full"><span>Hiring process</span><textarea aria-label="Hiring process" value={hiringProcess} onChange={(event) => { setHiringProcess(event.target.value); markEditing(); }} rows={6} maxLength={2000}/><small className="job-internal-note">Enter one stage per line. Add between three and six stages so candidates know what to expect.</small></label>
        </div>
        <footer className="form-actions job-creation-actions"><Button variant="secondary" onClick={() => void saveDraft()} disabled={isSaving || isPublishing}>{isSaving ? "Saving draft…" : "Save as draft"}</Button><Button type="submit" disabled={!readyToPublish || isSaving || isPublishing}>{isPublishing ? "Publishing…" : "Publish job"}</Button></footer>
      </form>
      <aside className="panel job-live-preview" aria-label="Live job preview"><header><div><span className="eyebrow">Candidate-facing preview</span><h2>Published story</h2></div><Badge tone={status === "published" ? "green" : status === "draft" ? "amber" : "neutral"}>{status === "published" ? "Published" : status === "draft" ? "Draft" : "Preview"}</Badge></header><article className="job-public-preview"><div className="job-preview-company-mark">{organisationName.charAt(0).toUpperCase() || "S"}</div><div><small>{organisationName} · Verified employer</small><h3>{title || "Your job title"}</h3><p className="job-preview-department">{department || "Department or team"}</p></div><div className="job-preview-meta"><span>{experienceLabel}</span><span>{readableJobLabel(workplaceModel)}</span><span>{readableJobLabel(employmentType)}</span><span>{location || "Location"}</span></div><div className="job-preview-skills">{skills.length ? skills.map((skill) => <span key={skill}>{skill}</span>) : <span>Add skills</span>}</div>{description ? <div className="job-preview-description" dangerouslySetInnerHTML={{ __html: description }}/> : <p>Your role summary will appear here as you write it.</p>}{responsibilities && <section className="job-preview-story"><strong>What you will own</strong><div className="job-preview-description" dangerouslySetInnerHTML={{ __html: responsibilities }}/></section>}{companyOverview && <section className="job-preview-story"><strong>About {organisationName}</strong><p>{companyOverview}</p></section>}{whyJoin && <section className="job-preview-story"><strong>Why join</strong><p>{whyJoin}</p></section>}{hiringSteps.length > 0 && <section className="job-preview-story"><strong>Hiring process</strong><ol className="job-preview-process">{hiringSteps.slice(0, 6).map((step, index) => <li key={`${step}-${index}`}><span>{index + 1}</span>{step}</li>)}</ol></section>}<footer><span>Sapienworx verified role</span><b>View job →</b></footer></article><p className="job-preview-help">This preview reflects the public job story. Internal salary information stays private.</p></aside>
    </section>
    {shareJob && <JobShareModal job={shareJob} onClose={() => setShareJob(null)}/>}
  </WorkspaceShell>;
}

function RichJobEditor({ value, onChange, label = "Job description", placeholder = "Describe the role, key responsibilities, and what success looks like…" }: { value: string; onChange: (value: string) => void; label?: string; placeholder?: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value; }, [value]);
  const applyFormat = (command: "bold" | "italic" | "underline" | "insertUnorderedList" | "insertOrderedList" | "createLink") => { const editor = editorRef.current; if (!editor) return; if (document.activeElement !== editor) editor.focus(); if (command === "createLink") { const url = window.prompt("Paste the external link"); if (!url) return; document.execCommand("createLink", false, url); } else document.execCommand(command, false); onChange(sanitizeRichText(editor.innerHTML)); };
  return <div className="rich-text-editor"><div className="rich-text-toolbar" role="toolbar" aria-label={`${label} formatting`} onMouseDown={(event) => event.preventDefault()}><button type="button" onClick={() => applyFormat("bold")} aria-label="Bold"><b>B</b></button><button type="button" onClick={() => applyFormat("italic")} aria-label="Italic"><i>I</i></button><button type="button" onClick={() => applyFormat("underline")} aria-label="Underline"><u>U</u></button><span/><button type="button" onClick={() => applyFormat("insertUnorderedList")} aria-label="Bullet list">• List</button><button type="button" onClick={() => applyFormat("insertOrderedList")} aria-label="Numbered list">1. List</button><button type="button" onClick={() => applyFormat("createLink")} aria-label="Insert link">⌁ Link</button></div><div ref={editorRef} className="rich-text-surface" role="textbox" aria-label={label} aria-multiline="true" contentEditable suppressContentEditableWarning onInput={(event) => onChange(sanitizeRichText(event.currentTarget.innerHTML))} data-placeholder={placeholder}/></div>;
}

function sanitizeRichText(value: string) { return value.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/\son\w+=("[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/(href|src)=("|')?\s*javascript:[^\s>"']*("|')?/gi, ""); }
function richTextToPlainText(value: string) { return value.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim(); }

type RecruiterJobDetailTab = "Overview" | "Applicants" | "Job Description" | "Settings";

function isManagedJobStatus(value: string | undefined): value is ManagedJobStatus {
  return value === "Draft" || value === "Published" || value === "Closed" || value === "Archived";
}

function managementPath({ query, status, location, order }: JobManagementInitialFilters) {
  const parameters = new URLSearchParams();
  if (query) parameters.set("q", query);
  if (status && status !== "All") parameters.set("status", status);
  if (location && location !== "All") parameters.set("location", location);
  if (order && order !== "newest") parameters.set("order", order);
  const search = parameters.toString();
  return `/recruiter/jobs/manage${search ? `?${search}` : ""}`;
}

export function RecruiterJobDetail({ jobId }: { jobId: string }) {
  const [activeTab, setActiveTab] = useState<RecruiterJobDetailTab>("Overview");
  const [backTo, setBackTo] = useState("/recruiter/jobs/manage");
  const [workspace, setWorkspace] = useState<RecruiterJobWorkspaceApiResponse | null>(null);
  const [dataSource, setDataSource] = useState<"loading" | "live" | "preview" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [actionPending, setActionPending] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [shareJob, setShareJob] = useState<ShareableJob | null>(null);
  const previewJob = managedJobs.find((item) => item.jobId.toLowerCase() === jobId.toLowerCase());

  useEffect(() => {
    const requestedBackPath = new URLSearchParams(window.location.search).get("back");
    if (requestedBackPath?.startsWith("/recruiter/jobs/manage")) setBackTo(requestedBackPath);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDataSource("loading");
    setLoadError("");
    void apiClient<RecruiterJobWorkspaceApiResponse>(`/api/recruiter/jobs/${encodeURIComponent(jobId)}/workspace?page=0&size=20`)
      .then((response) => {
        if (cancelled) return;
        setWorkspace(response);
        setDataSource("live");
      })
      .catch((error) => {
        if (cancelled) return;
        setWorkspace(null);
        setLoadError(error instanceof Error ? error.message : "The job workspace could not be loaded.");
        setDataSource(managedJobs.some((item) => item.jobId.toLowerCase() === jobId.toLowerCase()) ? "preview" : "error");
      });
    return () => { cancelled = true; };
  }, [jobId, reloadToken]);

  if (dataSource === "loading") return <WorkspaceShell workspace="recruiter" active="my-jobs" title="Loading job workspace" description="Retrieving the vacancy and its applicant pipeline…"><section className="panel job-detail-loading" aria-live="polite"><span/><span/><span/></section></WorkspaceShell>;
  if (!workspace && !previewJob) return <WorkspaceShell workspace="recruiter" active="my-jobs" title="Job unavailable" description="This vacancy could not be opened for the current recruiter."><section className="panel job-detail-empty"><div className="job-publish-error" role="alert">{loadError || `We could not find a job with ID ${jobId}.`}</div><p>Check that the Job ID belongs to your organisation and that your recruiter session is still active.</p><div className="job-detail-empty-actions"><Button onClick={() => setReloadToken((value) => value + 1)}>Retry</Button><Button href="/recruiter/jobs/manage" variant="secondary">Back to My Jobs</Button></div></section></WorkspaceShell>;

  const job = workspace ? managedJobFromApi(workspace.summary) : previewJob!;
  const apiJob = workspace?.summary.job ?? previewApiJob(job);
  const applicants = workspace?.applications.content ?? previewApplicants(job);
  const applicationLabel = job.applicants === 1 ? "1 applicant" : `${job.applicants} applicants`;
  const tabs: RecruiterJobDetailTab[] = ["Overview", "Applicants", "Job Description", "Settings"];
  const pipelinePath = `/recruiter/pipeline?role=${job.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
  const interviewActivity = (job.interviewing ?? 0) + (job.finalStage ?? 0);
  const shareableJob: ShareableJob = { jobId: job.jobId, title: job.title, company: apiJob.organisationName, location: job.location, skills: job.skills, experience: `${job.minimumExperience}–${job.maximumExperience} Yrs Exp` };
  const changeStatus = async (status: "ACTIVE" | "CLOSED" | "ARCHIVED" | "DRAFT", notice: string) => {
    if (dataSource !== "live") return;
    setActionPending(status);
    setActionError("");
    setActionNotice(`Updating ${job.title}…`);
    try {
      const updated = await apiClient<RecruiterJobApiResponse>(`/api/recruiter/jobs/${encodeURIComponent(job.jobId)}/status/${status}`, { method: "POST" });
      setWorkspace((current) => current ? { ...current, summary: { ...current.summary, job: updated } } : current);
      setActionNotice(notice);
    } catch (error) {
      setActionNotice("");
      setActionError(error instanceof Error ? error.message : "The job status could not be updated.");
    } finally {
      setActionPending("");
    }
  };
  return <WorkspaceShell workspace="recruiter" active="my-jobs">
    <a className="job-detail-back" href={backTo}>‹ Back to My Jobs</a>
    {dataSource === "preview" && <div className="job-publish-error" role="alert">{loadError} Showing a read-only preview; sign in again to use live applicant and lifecycle controls. <button type="button" onClick={() => setReloadToken((value) => value + 1)}>Retry live connection</button></div>}
    {actionNotice && <div className="creation-success" role="status">{actionNotice}</div>}
    {actionError && <div className="job-publish-error" role="alert">{actionError}</div>}
    <section className="job-detail-header panel"><div className="job-detail-header-main"><div className="job-detail-company-mark">{apiJob.organisationName.charAt(0).toUpperCase()}</div><div><span className="eyebrow">{apiJob.organisationName} · {dataSource === "live" ? "Live workspace" : "Preview workspace"}</span><h1>{job.title}</h1><p>{displayJobLocation(job.location, apiJob.workplaceModel)} <span>·</span> {job.minimumExperience}–{job.maximumExperience} years <span>·</span> {readableJobLabel(apiJob.workplaceModel)} <span>·</span> {readableJobLabel(apiJob.employmentType)}</p></div></div><div className="job-detail-header-actions"><Badge tone={jobStatusTone(job.status)}>{job.status}</Badge>{job.status === "Published" && <Button variant="secondary" onClick={() => setShareJob(shareableJob)}>Share</Button>}<a className="button button-primary" href={`/recruiter/jobs?jobId=${encodeURIComponent(job.jobId)}`}>Edit job</a></div></section>
    <nav className="job-detail-tabs" aria-label="Job detail sections">{tabs.map((tab) => <button className={activeTab === tab ? "active" : ""} aria-current={activeTab === tab ? "page" : undefined} onClick={() => setActiveTab(tab)} key={tab} type="button">{tab}{tab === "Applicants" && <span>{job.applicants}</span>}</button>)}</nav>
    {activeTab === "Overview" && <section className="job-detail-overview"><article className="panel job-detail-health"><span className="eyebrow">Vacancy health</span><h2>Recruitment overview</h2><div className="job-detail-metric-grid"><div><strong>{job.applicants}</strong><span>Total applicants</span><small>{job.newApplicants ?? 0} awaiting review</small></div><div><strong>{interviewActivity}</strong><span>Interview activity</span><small>{job.finalStage ?? 0} in final stage</small></div><div><strong>{(job.offers ?? 0) + (job.onboarded ?? 0)}</strong><span>Offers and hires</span><small>{job.onboarded ?? 0} onboarded</small></div><div><strong>{job.status === "Published" ? "Live" : job.status}</strong><span>Publishing status</span><small>Updated {formatJobTimestamp(apiJob.updatedAt)}</small></div></div><a className="job-detail-pipeline-link" href={pipelinePath}>Open the complete candidate pipeline <span>→</span></a></article><article className="panel job-detail-role-brief"><span className="eyebrow">Role brief</span><h2>What the role needs</h2><dl><div><dt>Team</dt><dd>{apiJob.department}</dd></div><div><dt>Experience</dt><dd>{job.minimumExperience}–{job.maximumExperience} years</dd></div><div><dt>Work model</dt><dd>{readableJobLabel(apiJob.workplaceModel)}</dd></div><div><dt>Employment</dt><dd>{readableJobLabel(apiJob.employmentType)}</dd></div></dl><div className="job-detail-skills">{job.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></article><article className="panel job-detail-funnel"><span className="eyebrow">Pipeline distribution</span><h2>Where candidates stand</h2><div className="job-detail-funnel-list">{[["New", job.newApplicants ?? 0], ["Screening", job.screening ?? 0], ["Interviewing", job.interviewing ?? 0], ["Final stage", job.finalStage ?? 0], ["Offer", job.offers ?? 0], ["Onboarded", job.onboarded ?? 0], ["Rejected", job.rejected ?? 0]].map(([label, count]) => <div key={String(label)}><span>{label}</span><b>{count}</b><i><span style={{ width: `${job.applicants ? Math.max(4, (Number(count) / job.applicants) * 100) : 0}%` }}/></i></div>)}</div></article></section>}
    {activeTab === "Applicants" && <section className="panel job-detail-applicants"><header><div><span className="eyebrow">Candidate flow · latest first</span><h2>{applicationLabel}</h2><p>Applications shown here are attached to this exact Job ID.</p></div><Button href={pipelinePath} variant="secondary">Open full pipeline</Button></header>{applicants.length ? <div className="job-detail-applicant-list">{applicants.map((candidate) => <a href={`/recruiter/jobs/${encodeURIComponent(job.jobId)}/applications/${candidate.applicationId}`} key={candidate.applicationId}><span className="result-avatar">{candidateInitials(candidate.fullName)}</span><div><strong>{candidate.fullName}</strong><small>{candidate.headline || "Candidate profile"}</small><span>{candidate.skills.slice(0, 4).join(" · ") || "Profile skills pending"}</span></div><div className="job-detail-applicant-stage"><Badge tone={pipelineStageTone(candidate.pipelineStage)}>{readablePipelineStage(candidate.pipelineStage)}</Badge><small>Applied {formatJobTimestamp(candidate.appliedAt)}</small></div></a>)}</div> : <div className="job-detail-zero-state"><strong>No applications for this role yet</strong><p>{job.status === "Draft" ? "Publish the role when the candidate story is ready." : job.status === "Published" ? "Share the public role or review its search visibility to reach relevant candidates." : "Applications remain available after a job is closed or archived."}</p>{job.status === "Published" && <Button onClick={() => setShareJob(shareableJob)}>Share this role</Button>}</div>}</section>}
    {activeTab === "Job Description" && <section className="job-detail-description-grid"><article className="panel job-detail-description"><header><div><span className="eyebrow">Candidate-facing specification</span><h2>Role story</h2></div><Button href={`/recruiter/jobs?jobId=${encodeURIComponent(job.jobId)}`}>Edit job</Button></header><div className="job-detail-skills">{job.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><section><h3>About the role</h3><div className="rich-job-render" dangerouslySetInnerHTML={{ __html: apiJob.descriptionHtml }}/></section><section><h3>What the person will own</h3><div className="rich-job-render" dangerouslySetInnerHTML={{ __html: apiJob.responsibilitiesHtml }}/></section></article><aside className="stack"><section className="panel job-detail-story-card"><span className="eyebrow">About the employer</span><h3>{apiJob.organisationName}</h3><p>{apiJob.companyOverview || "Company overview has not been added yet."}</p></section><section className="panel job-detail-story-card"><span className="eyebrow">Candidate proposition</span><h3>Why join</h3><p>{apiJob.whyJoin || "Why-join copy has not been added yet."}</p></section><section className="panel job-detail-process"><span className="eyebrow">Hiring process</span><h3>What candidates can expect</h3><ol>{apiJob.hiringProcess.split(/\r?\n/).filter(Boolean).map((step, index) => <li key={`${step}-${index}`}><span>{index + 1}</span><p>{step}</p></li>)}</ol></section></aside></section>}
    {activeTab === "Settings" && <section className="panel job-detail-settings"><header><div><span className="eyebrow">Job settings</span><h2>Publishing and lifecycle</h2></div><Badge tone={jobStatusTone(job.status)}>{job.status}</Badge></header><dl><div><dt>Job ID</dt><dd><code>{job.jobId}</code></dd></div><div><dt>Job visibility</dt><dd>{job.status === "Published" ? "Visible on Sapienworx and ready to share" : "Not visible to candidates"}</dd></div><div><dt>Created</dt><dd>{formatJobTimestamp(apiJob.createdAt)}</dd></div><div><dt>Last updated</dt><dd>{formatJobTimestamp(apiJob.updatedAt)}</dd></div><div><dt>Published</dt><dd>{apiJob.publishedAt ? formatJobTimestamp(apiJob.publishedAt) : "Not published yet"}</dd></div><div><dt>Internal compensation</dt><dd>{job.minimumSalary && job.maximumSalary ? `₹${job.minimumSalary}L–₹${job.maximumSalary}L · recruiter-only` : "Not specified"}</dd></div><div><dt>Public application link</dt><dd>{job.status === "Published" ? <a href={apiJob.publicPath}>{apiJob.publicPath}</a> : "Available after publishing"}</dd></div></dl><section className="job-detail-lifecycle"><div><strong>Lifecycle controls</strong><p>Every status change is recorded and guarded by the publishing rules.</p></div><div>{job.status === "Draft" && <Button href={`/recruiter/jobs?jobId=${encodeURIComponent(job.jobId)}`}>Finish and publish</Button>}{job.status === "Published" && <Button variant="secondary" disabled={Boolean(actionPending) || dataSource !== "live"} onClick={() => void changeStatus("CLOSED", `${job.title} is now closed.`)}>Close job</Button>}{job.status === "Closed" && <Button disabled={Boolean(actionPending) || dataSource !== "live"} onClick={() => void changeStatus("ACTIVE", `${job.title} has been reopened.`)}>Reopen job</Button>}{job.status !== "Archived" && <Button variant="quiet" disabled={Boolean(actionPending) || dataSource !== "live"} onClick={() => void changeStatus("ARCHIVED", `${job.title} has been archived.`)}>Archive job</Button>}{job.status === "Archived" && <Button disabled={Boolean(actionPending) || dataSource !== "live"} onClick={() => void changeStatus("DRAFT", `${job.title} has been restored as a draft.`)}>Restore as draft</Button>}</div></section></section>}
    {shareJob && <JobShareModal job={shareJob} onClose={() => setShareJob(null)}/>}
  </WorkspaceShell>;
}

function previewApiJob(job: ManagedJob): RecruiterJobApiResponse {
  return { jobId: job.jobId, title: job.title, organisationName: job.organisationName || "Nexora Technologies", verifiedEmployer: true, location: job.location, department: "General", employmentType: "FULL_TIME", workplaceModel: job.location.toLowerCase().includes("remote") ? "REMOTE" : job.location.toLowerCase().includes("hybrid") ? "HYBRID" : "ON_SITE", minimumExperienceYears: Number(job.minimumExperience), maximumExperienceYears: Number(job.maximumExperience), minimumSalaryLakhs: job.minimumSalary ? Number(job.minimumSalary) : null, maximumSalaryLakhs: job.maximumSalary ? Number(job.maximumSalary) : null, salaryVisible: false, descriptionHtml: job.description, companyOverview: "Nexora Technologies builds practical products with thoughtful, cross-functional teams.", whyJoin: "Do meaningful work with room to shape both the product and how the team delivers it.", responsibilitiesHtml: job.description, hiringProcess: "Application review\nRecruiter conversation\nRole-focused conversation\nFinal decision", skills: job.skills, status: job.status === "Published" ? "ACTIVE" : job.status.toUpperCase(), domainCategory: "TECH", publicPath: publicJobPath(job.jobId, job.title), createdAt: job.createdAt, updatedAt: job.createdAt, publishedAt: job.status === "Published" ? job.createdAt : null };
}

function previewApplicants(job: ManagedJob): RecruiterJobApplicantApiResponse[] {
  return startingCandidates.filter((candidate) => candidate.role === job.title).map((candidate) => ({ applicationId: `preview-${candidate.id}`, candidateId: String(candidate.id), fullName: candidate.name, headline: candidate.role, skills: candidateAttributes[candidate.id]?.skills ?? [], pipelineStage: candidate.stage.toUpperCase().replaceAll(" ", "_"), appliedAt: null, updatedAt: null, lastActiveAt: null, applicationSource: "PREVIEW" }));
}

function candidateInitials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "CA"; }
function readablePipelineStage(stage: string) { return stage.toLowerCase().replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase()); }
function pipelineStageTone(stage: string): "amber" | "green" | "blue" | "neutral" { return stage === "ONBOARDED" || stage === "OFFER" ? "green" : stage === "INTERVIEWING" || stage === "FINAL_STAGE" ? "blue" : stage === "REJECTED" ? "neutral" : "amber"; }
function formatJobTimestamp(value: string | null | undefined) { if (!value) return "Not available"; const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`); if (Number.isNaN(parsed.getTime())) return "Not available"; return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(parsed); }

export type PublicJobDetailData = {
  jobId: string; title: string; organisationName: string; verifiedEmployer: boolean; location: string; department: string;
  employmentType: string; workplaceModel: string; skills: string[]; minimumExperienceYears: number; maximumExperienceYears: number;
  minimumSalaryLakhs: number | null; maximumSalaryLakhs: number | null; salaryVisible: boolean; descriptionHtml: string;
  companyOverview: string; whyJoin: string; responsibilitiesHtml: string; hiringProcess: string; publicPath: string; publishedAt: string | null;
};

function readableJobLabel(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase()); }
function displayJobLocation(location: string, workplaceModel: string) { const model = readableJobLabel(workplaceModel); const candidates = [` · ${model}`, `, ${model}`, ` (${model})`]; const suffix = candidates.find((value) => location.toLowerCase().endsWith(value.toLowerCase())); return suffix ? location.slice(0, -suffix.length).trim() : location; }
function publicJobAge(value: string | null) { if (!value) return "Recently published"; const days = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 86_400_000)); return days === 0 ? "Posted today" : `Posted ${days}d ago`; }

export function PublicJobDetail({ jobId, slug: _slug, fromSearch = false, initialJob, similarJobs = [], referralCode, shareSource }: { jobId: string; slug: string; fromSearch?: boolean; initialJob?: PublicJobDetailData | null; similarJobs?: PublicJobDetailData[]; referralCode?: string; shareSource?: string }) {
  const managed = managedJobs.find((item) => item.jobId.toLowerCase() === jobId.toLowerCase());
  const job = initialJob ? {
    jobId: initialJob.jobId, title: initialJob.title, location: initialJob.location, skills: initialJob.skills,
    minimumExperience: String(initialJob.minimumExperienceYears), maximumExperience: String(initialJob.maximumExperienceYears),
    description: initialJob.descriptionHtml, company: initialJob.organisationName, verifiedEmployer: initialJob.verifiedEmployer,
    department: initialJob.department, employmentType: initialJob.employmentType, workplaceModel: initialJob.workplaceModel,
    companyOverview: initialJob.companyOverview, whyJoin: initialJob.whyJoin, responsibilitiesHtml: initialJob.responsibilitiesHtml,
    hiringProcess: initialJob.hiringProcess, publicPath: initialJob.publicPath, publishedAt: initialJob.publishedAt,
  } : managed ? {
    jobId: managed.jobId, title: managed.title, location: managed.location, skills: managed.skills,
    minimumExperience: managed.minimumExperience, maximumExperience: managed.maximumExperience, description: managed.description,
    company: "Nexora Technologies", verifiedEmployer: true, department: "General", employmentType: "FULL_TIME",
    workplaceModel: managed.location.toLowerCase().includes("remote") ? "REMOTE" : managed.location.toLowerCase().includes("hybrid") ? "HYBRID" : "ON_SITE",
    companyOverview: "Nexora Technologies builds practical digital products with thoughtful, cross-functional teams.",
    whyJoin: "Work on meaningful problems with room to influence both the product and how the team delivers it.",
    responsibilitiesHtml: managed.description, hiringProcess: "Application review\nRecruiter conversation\nRole-focused conversation\nFinal decision",
    publicPath: publicJobPath(managed.jobId, managed.title), publishedAt: `${managed.createdAt}T00:00:00Z`,
  } : null;
  if (!job) return <main className="public-page public-job-detail-page"><header className="public-nav"><Logo /><a className="recruiter-entry" href="/jobs">Find jobs <span>→</span></a></header><section className="public-job-unavailable"><span className="eyebrow">Job unavailable</span><h1>This role is no longer available.</h1><p>The vacancy may have been closed, archived, or the link may be incomplete.</p><Button href="/jobs">Browse all jobs</Button></section></main>;
  const canonicalPath = job.publicPath || publicJobPath(job.jobId, job.title);
  const authPath = (path: "/login" | "/register") => { const query = new URLSearchParams({ job: job.jobId }); if (referralCode) query.set("ref", referralCode); if (shareSource) query.set("source", shareSource); return `${path}?${query.toString()}`; };
  const registerPath = authPath("/register");
  const signInPath = authPath("/login");
  const hiringSteps = job.hiringProcess.split(/\r?\n/).map((step) => step.trim()).filter(Boolean);
  const processSteps = hiringSteps.length ? hiringSteps : ["Application review", "Recruiter conversation", "Role-focused conversation", "Final decision"];
  return <main className="public-page public-job-detail-page">
    <header className="public-nav"><Logo /><nav aria-label="Public navigation"><a href="/jobs">Find jobs</a><a href="/companies">Companies</a><a href="/knowledge">Knowledge hub</a></nav><div className="public-nav-actions"><a className="text-action" href={signInPath}>Sign in to apply</a><a className="button button-primary" href={registerPath}>Create profile</a></div></header>
    <nav className="public-job-breadcrumb public-container" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/jobs">Jobs</a><span>/</span><strong>{job.title}</strong></nav>
    {fromSearch && <div className="public-container"><a className="public-job-search-back" href="/jobs">‹ Back to search results</a></div>}
    <section className="public-job-detail-hero"><div className="public-container public-job-hero-grid"><div className="public-job-detail-brand"><span>{job.company.slice(0, 1)}</span><div><p>{job.company}</p>{job.verifiedEmployer && <small>✓ Verified employer</small>}</div></div><div className="public-job-detail-heading"><span className="eyebrow">Career opportunity · {publicJobAge(job.publishedAt)}</span><h1>{job.title}</h1><div className="public-job-detail-meta"><span>{job.minimumExperience}–{job.maximumExperience} years</span><span>{readableJobLabel(job.workplaceModel)}</span><span>{readableJobLabel(job.employmentType)}</span><span>{job.location}</span></div><div className="public-job-hero-actions"><a className="button button-primary public-job-hero-apply" href={registerPath}>Apply now <span>→</span></a><PublicJobSave jobId={job.jobId} jobTitle={job.title} signInHref={signInPath}/><PublicJobShare publicPath={canonicalPath} title={job.title} company={job.company}/></div></div></div></section>
    <section className="public-job-detail-shell public-section"><div className="public-job-story-column">
      <article className="public-job-story-panel"><span className="eyebrow">About the role</span><h2>Build your next chapter with {job.company}.</h2><div className="public-job-skill-list">{job.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><div className="rich-job-render" dangerouslySetInnerHTML={{ __html: job.description }}/></article>
      <article className="public-job-story-panel"><span className="eyebrow">The work</span><h2>What you&apos;ll take ownership of</h2><div className="rich-job-render" dangerouslySetInnerHTML={{ __html: job.responsibilitiesHtml || job.description }}/></article>
      <article className="public-job-story-panel public-job-process"><span className="eyebrow">What to expect</span><h2>A clear hiring process</h2><ol>{processSteps.map((step, index) => <li key={step}><span>{index + 1}</span><div><strong>{step}</strong><small>{index === 0 ? "Your verified Sapienworx profile is shared with the posting recruiter." : index === processSteps.length - 1 ? "You receive a clear outcome from the hiring team." : "The team shares the format before the conversation."}</small></div></li>)}</ol></article>
    </div><aside className="public-job-detail-aside"><section className="public-job-apply-panel"><span className="eyebrow">Interested in this role?</span><strong>{job.title}</strong><p>{job.location}</p><a className="button button-primary" href={registerPath}>Apply now <span>→</span></a><PublicJobSave jobId={job.jobId} jobTitle={job.title} signInHref={signInPath}/><PublicJobShare publicPath={canonicalPath} title={job.title} company={job.company}/><small>New to Sapienworx? We will create and verify your account before submitting your application.</small><small>Applications are delivered only to the recruiter who posted this role, including applications from shared links.</small><a className="public-job-copy-link" href={signInPath}>Already a member? Sign in to apply</a></section><section className="public-job-company-panel"><div className="public-job-company-heading"><span>{job.company.slice(0, 1)}</span><div><strong>{job.company}</strong>{job.verifiedEmployer && <small>✓ Verified employer</small>}</div></div><p>{job.companyOverview || `${job.company} is actively hiring through Sapienworx.`}</p><h3>Why join</h3><p>{job.whyJoin || "Join a team where the role, expectations, and hiring process are communicated clearly."}</p><dl><div><dt>Team</dt><dd>{job.department}</dd></div><div><dt>Work model</dt><dd>{readableJobLabel(job.workplaceModel)}</dd></div><div><dt>Employment</dt><dd>{readableJobLabel(job.employmentType)}</dd></div></dl></section></aside></section>
    {similarJobs.length > 0 && <section className="public-job-similar public-section"><header><div><span className="eyebrow">Keep exploring</span><h2>Similar roles worth a look</h2></div><a href="/jobs">Browse all jobs →</a></header><div>{similarJobs.map((similar) => <article key={similar.jobId}><p>{similar.organisationName}{similar.verifiedEmployer && <span>✓ Verified</span>}</p><h3>{similar.title}</h3><div className="public-job-detail-meta"><span>{similar.minimumExperienceYears}–{similar.maximumExperienceYears} years</span><span>{readableJobLabel(similar.workplaceModel)}</span><span>{similar.location}</span></div><div className="public-job-skill-list">{similar.skills.slice(0, 3).map((skill) => <span key={skill}>{skill}</span>)}</div><a href={similar.publicPath}>View role <span>→</span></a></article>)}</div></section>}
    <div className="public-job-mobile-apply"><a className="button button-primary" href={registerPath}>Apply now <span>→</span></a></div>
  </main>;
}

export type JobManagementInitialFilters = { query?: string; status?: string; location?: string; order?: string };

function managedJobStatusFromApi(status: string): ManagedJobStatus {
  if (status === "ACTIVE") return "Published";
  if (status === "CLOSED") return "Closed";
  if (status === "ARCHIVED") return "Archived";
  return "Draft";
}

function managedJobFromApi(item: RecruiterManagedJobApiResponse): ManagedJob {
  const job = item.job;
  return {
    id: job.jobId.toLowerCase(),
    jobId: job.jobId,
    title: job.title,
    status: managedJobStatusFromApi(job.status),
    location: job.location,
    createdAt: job.createdAt ?? new Date().toISOString(),
    applicants: item.applicants,
    skills: job.skills,
    minimumExperience: String(job.minimumExperienceYears),
    maximumExperience: String(job.maximumExperienceYears),
    minimumSalary: job.minimumSalaryLakhs == null ? "" : String(job.minimumSalaryLakhs),
    maximumSalary: job.maximumSalaryLakhs == null ? "" : String(job.maximumSalaryLakhs),
    description: job.descriptionHtml,
    organisationName: job.organisationName,
    newApplicants: item.newApplicants,
    screening: item.screening,
    interviewing: item.interviewing,
    finalStage: item.finalStage,
    offers: item.offers,
    onboarded: item.onboarded,
    rejected: item.rejected,
    latestApplicationAt: item.latestApplicationAt,
  };
}

function closeJobRowMenu(target: HTMLElement) {
  target.closest("details")?.removeAttribute("open");
}

export function RecruiterJobList({ initialFilters = {} }: { initialFilters?: JobManagementInitialFilters }) {
  const [jobs, setJobs] = useState(managedJobs);
  const [dataSource, setDataSource] = useState<"loading" | "live" | "preview">("loading");
  const [query, setQuery] = useState(initialFilters.query ?? "");
  const [statusFilter, setStatusFilter] = useState<"All" | ManagedJobStatus>(isManagedJobStatus(initialFilters.status) ? initialFilters.status : "All");
  const [locationFilter, setLocationFilter] = useState(initialFilters.location ?? "All");
  const [dateOrder, setDateOrder] = useState<"newest" | "oldest">(initialFilters.order === "oldest" ? "oldest" : "newest");
  const [shareJob, setShareJob] = useState<ShareableJob | null>(null);
  const [actionNotice, setActionNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionPending, setActionPending] = useState("");

  const loadLiveJobs = async () => {
    try {
      const response = await apiClient<RecruiterManagedJobsPage>("/api/recruiter/jobs?page=0&size=100");
      setJobs(response.content.map(managedJobFromApi));
      setDataSource("live");
      setActionError("");
    } catch {
      setDataSource("preview");
      setActionError("Live job data is temporarily unavailable. Showing the recruiter preview dataset; lifecycle changes are disabled until the connection returns.");
    }
  };

  useEffect(() => { void loadLiveJobs(); }, []);

  const locations = Array.from(new Set(jobs.map((job) => job.location)));
  const filteredJobs = jobs.filter((job) => (statusFilter === "All" || job.status === statusFilter) && (locationFilter === "All" || job.location === locationFilter) && `${job.jobId} ${job.title}`.toLowerCase().includes(query.toLowerCase())).sort((first, second) => dateOrder === "newest" ? second.createdAt.localeCompare(first.createdAt) : first.createdAt.localeCompare(second.createdAt));
  const portfolioTotals = filteredJobs.reduce((totals, job) => ({ applicants: totals.applicants + job.applicants, newApplicants: totals.newApplicants + (job.newApplicants ?? 0), interviews: totals.interviews + (job.interviewing ?? 0) + (job.finalStage ?? 0), offers: totals.offers + (job.offers ?? 0) + (job.onboarded ?? 0) }), { applicants: 0, newApplicants: 0, interviews: 0, offers: 0 });
  const toShareableJob = (job: ManagedJob): ShareableJob => ({ jobId: job.jobId, title: job.title, company: job.organisationName || "Nexora Technologies", location: job.location, skills: job.skills, experience: `${job.minimumExperience}–${job.maximumExperience} Yrs Exp` });
  const currentManagementPath = managementPath({ query, status: statusFilter, location: locationFilter, order: dateOrder });
  const duplicateJob = async (job: ManagedJob) => {
    if (dataSource !== "live") return;
    setActionPending(job.jobId);
    setActionError("");
    setActionNotice("Creating a fresh draft from this role…");
    try {
      const response = await apiClient<RecruiterJobApiResponse>(`/api/recruiter/jobs/${encodeURIComponent(job.jobId)}/duplicate`, { method: "POST" });
      setActionNotice(`Draft ${response.jobId} created. Opening it now…`);
      window.location.assign(`/recruiter/jobs?jobId=${encodeURIComponent(response.jobId)}`);
    } catch (error) {
      setActionNotice("");
      setActionError(error instanceof Error ? error.message : "The job could not be duplicated.");
    } finally {
      setActionPending("");
    }
  };

  const updateJobStatus = async (job: ManagedJob, apiStatus: "ACTIVE" | "CLOSED" | "ARCHIVED" | "DRAFT", label: string) => {
    if (dataSource !== "live") return;
    setActionPending(job.jobId);
    setActionError("");
    setActionNotice(`Updating ${job.title}…`);
    try {
      const response = await apiClient<RecruiterJobApiResponse>(`/api/recruiter/jobs/${encodeURIComponent(job.jobId)}/status/${apiStatus}`, { method: "POST" });
      setJobs((current) => current.map((item) => item.jobId === job.jobId ? { ...item, status: managedJobStatusFromApi(response.status) } : item));
      setActionNotice(`${job.title} ${label}.`);
    } catch (error) {
      setActionNotice("");
      setActionError(error instanceof Error ? error.message : "The job status could not be updated.");
    } finally {
      setActionPending("");
    }
  };

  return <WorkspaceShell workspace="recruiter" active="my-jobs" title="My Jobs" description="Search, distribute, and manage every vacancy in your organisation." actions={<Button href="/recruiter/jobs">+ Post a job</Button>}>
    {actionNotice && <div className="creation-success" role="status">{actionNotice}</div>}
    {actionError && <div className="job-publish-error" role="alert">{actionError} {dataSource === "preview" && <button type="button" onClick={() => { setDataSource("loading"); void loadLiveJobs(); }}>Retry live connection</button>}</div>}
    <section className="job-portfolio-metrics" aria-label="Filtered job portfolio analytics"><article><span>Applicants</span><strong>{portfolioTotals.applicants}</strong><small>Across visible roles</small></article><article><span>New applications</span><strong>{portfolioTotals.newApplicants}</strong><small>Awaiting first review</small></article><article><span>Interview activity</span><strong>{portfolioTotals.interviews}</strong><small>Interviewing or final stage</small></article><article><span>Offers and hires</span><strong>{portfolioTotals.offers}</strong><small>Offer or onboarded</small></article></section>
    <section className="panel job-management"><header className="job-management-header"><div><span className="eyebrow">Job portfolio · {dataSource === "live" ? "Live organisation data" : dataSource === "loading" ? "Connecting…" : "Preview data"}</span><h2>{filteredJobs.length} roles</h2></div><p>Search by exact Job ID or any part of a job title. Pipeline totals update from submitted applications.</p></header><div className="job-management-controls"><label className="job-management-search"><span>⌕</span><input aria-label="Search vacancies" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Job ID or job title"/></label><label>Status<select aria-label="Filter jobs by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "All" | ManagedJobStatus)}><option>All</option><option>Draft</option><option>Published</option><option>Closed</option><option>Archived</option></select></label><label>Location<select aria-label="Filter jobs by location" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}><option>All</option>{locations.map((location) => <option key={location}>{location}</option>)}</select></label><label>Created<select aria-label="Sort jobs by creation date" value={dateOrder} onChange={(event) => setDateOrder(event.target.value as "newest" | "oldest")}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label></div><div className="job-management-table-wrap"><table className="job-management-table"><thead><tr><th>Job ID</th><th>Vacancy</th><th>Status</th><th>Created</th><th>Pipeline</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filteredJobs.map((job) => <tr key={job.id}><td><a className="job-detail-link" href={`/recruiter/jobs/${encodeURIComponent(job.jobId)}?back=${encodeURIComponent(currentManagementPath)}`}><code>{job.jobId}</code></a></td><td><a className="job-detail-title" href={`/recruiter/jobs/${encodeURIComponent(job.jobId)}?back=${encodeURIComponent(currentManagementPath)}`}><strong>{job.title}</strong><small>{job.location} · {job.skills.slice(0, 2).join(", ")}</small></a></td><td><Badge tone={jobStatusTone(job.status)}>{job.status}</Badge></td><td>{formatJobDate(job.createdAt)}</td><td><a className="job-pipeline-cell" href={`/recruiter/pipeline?role=${job.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`}><strong>{job.applicants || "—"}</strong><small>{job.applicants ? `${job.newApplicants ?? 0} new · ${(job.interviewing ?? 0) + (job.finalStage ?? 0)} interviews` : "No applications yet"}</small></a></td><td><details className="job-row-menu"><summary aria-label={`Actions for ${job.title}`}>•••</summary><div><a href={`/recruiter/jobs?jobId=${encodeURIComponent(job.jobId)}`}>Edit job</a><button disabled={actionPending === job.jobId || dataSource !== "live"} onClick={(event) => { closeJobRowMenu(event.currentTarget); void duplicateJob(job); }}>Duplicate job</button>{job.status === "Published" && <button onClick={(event) => { closeJobRowMenu(event.currentTarget); setShareJob(toShareableJob(job)); }}>Share job</button>}{job.status === "Published" && <button disabled={actionPending === job.jobId || dataSource !== "live"} onClick={(event) => { closeJobRowMenu(event.currentTarget); void updateJobStatus(job, "CLOSED", "is now closed"); }}>Close job</button>}{job.status === "Closed" && <button disabled={actionPending === job.jobId || dataSource !== "live"} onClick={(event) => { closeJobRowMenu(event.currentTarget); void updateJobStatus(job, "ACTIVE", "has been reopened"); }}>Reopen job</button>}{job.status === "Archived" && <button disabled={actionPending === job.jobId || dataSource !== "live"} onClick={(event) => { closeJobRowMenu(event.currentTarget); void updateJobStatus(job, "DRAFT", "has been restored as a draft"); }}>Restore as draft</button>}{job.status !== "Archived" && <button disabled={actionPending === job.jobId || dataSource !== "live"} onClick={(event) => { closeJobRowMenu(event.currentTarget); void updateJobStatus(job, "ARCHIVED", "has been archived"); }}>Archive job</button>}</div></details></td></tr>)}</tbody></table>{filteredJobs.length === 0 && <div className="empty-state"><span>⌕</span><h3>No jobs match these filters</h3><p>{jobs.length === 0 && dataSource === "live" ? "Your organisation has no jobs yet. Publish the first role to start building a pipeline." : "Adjust the status, location, date, or search term to find a role."}</p>{jobs.length === 0 && dataSource === "live" && <Button href="/recruiter/jobs">Post your first job</Button>}</div>}</div></section>
    {shareJob && <JobShareModal job={shareJob} onClose={() => setShareJob(null)}/>}
  </WorkspaceShell>;
}

function jobStatusTone(status: ManagedJobStatus): "amber" | "green" | "blue" | "neutral" { return status === "Draft" ? "amber" : status === "Published" ? "green" : status === "Closed" ? "blue" : "neutral"; }
function formatJobDate(value: string) { return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value.includes("T") ? value : `${value}T00:00:00`)); }

function JobShareModal({ job, onClose }: { job: ShareableJob; onClose: () => void }) {
  const [sharedWith, setSharedWith] = useState("");
  const [siteOrigin, setSiteOrigin] = useState((process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, ""));
  const publicUrl = publicJobPath(job.jobId, job.title);
  const sourceUrl = (source: string) => { const url = new URL(publicUrl, siteOrigin || "http://localhost:3001"); url.searchParams.set("source", source); return url.toString(); };
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(sourceUrl("linkedin"))}`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${job.title} at ${job.company}`)}&url=${encodeURIComponent(sourceUrl("x"))}`;
  const whatsAppUrl = `https://wa.me/?text=${encodeURIComponent(`${job.title} at ${job.company} — ${sourceUrl("whatsapp")}`)}`;
  useEffect(() => { setSiteOrigin(window.location.origin); const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", closeOnEscape); return () => window.removeEventListener("keydown", closeOnEscape); }, [onClose]);
  const copyPublicUrl = async () => { try { const url = new URL(publicUrl, window.location.origin); url.searchParams.set("source", "copy_link"); await navigator.clipboard.writeText(url.toString()); setSharedWith("Public job link copied"); } catch { setSharedWith("Copy is unavailable in this browser. Open the public job and copy its address."); } };
  return <div className="job-share-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="job-share-modal" role="dialog" aria-modal="true" aria-labelledby="job-share-title"><button className="job-share-close" onClick={onClose} aria-label="Close share dialog">×</button><span className="eyebrow">Job published</span><h2 id="job-share-title">Share {job.title}</h2><p>Social networks will use this role-specific branded preview. Every application is delivered to the recruiter who posted the vacancy.</p><article className="job-share-card" aria-label="Social media card preview"><div className="job-share-brand"><span className="job-share-mark">S</span><b>Sapienworx</b><small>ENTERPRISE RECRUITMENT</small></div><div className="job-share-role"><h3>{job.title}</h3><div className="job-share-company"><span>S</span><p><b>{job.company}</b><small>Actively hiring</small></p></div><div className="job-share-meta"><span>▣ {job.experience}</span><span>⌖ {job.location}</span></div><div className="job-share-skills">{job.skills.slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}</div></div></article><label className="job-share-url"><span>Public job URL</span><div><code>{publicUrl}</code><button type="button" onClick={() => { void copyPublicUrl(); }}>Copy</button></div></label><div className="job-share-actions"><a href={linkedInUrl} target="_blank" rel="noopener noreferrer" onClick={() => setSharedWith("Opening LinkedIn share")}>in LinkedIn</a><a href={xUrl} target="_blank" rel="noopener noreferrer" onClick={() => setSharedWith("Opening X share")}>𝕏 X</a><a href={whatsAppUrl} target="_blank" rel="noopener noreferrer" onClick={() => setSharedWith("Opening WhatsApp share")}>◉ WhatsApp</a></div><small className="job-share-routing-note">✓ Applications from every valid shared link stay attached to {job.company}&apos;s posting recruiter.</small>{sharedWith && <small className="positive" role="status">{sharedWith}</small>}</section></div>;
}

const stages: Candidate["stage"][] = ["Screening", "Interviewing", "Final stage", "Offer", "Onboarded"];

export function RecruiterPipeline() { return <Suspense fallback={<WorkspaceShell workspace="recruiter" active="pipeline" title="Candidate pipeline" description="Loading candidate stages…"><section className="panel">Loading candidate stages…</section></WorkspaceShell>}><RecruiterPipelineContent/></Suspense>; }

function RecruiterPipelineContent() {
  const [candidates, setCandidates] = useState(startingCandidates);
  const [pipelineSource, setPipelineSource] = useState<"live" | "preview">("preview");
  const [pipelineLoadNote, setPipelineLoadNote] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "card">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [experienceMin, setExperienceMin] = useState("");
  const [experienceMax, setExperienceMax] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [qualifications, setQualifications] = useState({ Bachelors: true, Masters: true });
  const [noticePeriod, setNoticePeriod] = useState("All");
  const [activeRange, setActiveRange] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [revealedContacts, setRevealedContacts] = useState<Record<number, { email?: boolean; phone?: boolean }>>({});
  const [revealingContacts, setRevealingContacts] = useState<Record<number, { email?: boolean; phone?: boolean }>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});
  const [actionNotice, setActionNotice] = useState<Record<number, string>>({});
  const searchParams = useSearchParams();
  const requestedStage = searchParams.get("stage") ?? "all";
  const requestedRole = searchParams.get("role") ?? "all";
  const stageLabel = stages.find((stage) => stage.toLowerCase().replace(/\s+/g, "-") === requestedStage) ?? "All pipeline stages";
  const activeOptions = [{ label: "1 day", value: "1" }, { label: "3 days", value: "3" }, { label: "7 days", value: "7" }, { label: "15 days", value: "15" }, { label: "30 days", value: "30" }, { label: "60 days", value: "60" }, { label: "90 days", value: "90" }, { label: "1 year", value: "365" }, { label: "All", value: "all" }];
  useEffect(() => {
    void apiClient<LivePipelinePage>("/api/recruiter/pipeline?page=0").then((page) => {
      if (!page.content.length) { setCandidates([]); setPipelineSource("live"); return; }
      setCandidates(page.content.map((item, index) => ({ id: 10_000 + index, candidateId: item.candidateId, applicationId: item.applicationId, jobId: item.jobId, name: item.fullName, initials: item.fullName.split(" ").map((part) => part[0]).join("").slice(0, 2), role: item.jobTitle, stage: pipelineStageFromApi(item.pipelineStage), score: 82 + (index % 16), email: item.maskedEmail, phone: item.maskedMobile, profileUpdated: relativeDate(item.profileLastUpdatedAt), lastActive: relativeDate(item.lastActiveAt), note: item.recentNotes[0] || "No recruiter note yet.", liveSkills: item.skills })));
      setPipelineSource("live");
    }).catch(() => setPipelineLoadNote("Live pipeline is temporarily unavailable. Showing the recruiter preview dataset."));
  }, []);
  const matchingCandidates = candidates.filter((candidate) => {
    const attributes = pipelineAttributesFor(candidate);
    return (requestedStage === "all" || candidate.stage.toLowerCase().replace(/\s+/g, "-") === requestedStage) && (requestedRole === "all" || candidate.role.toLowerCase().replace(/\s+/g, "-") === requestedRole) && matchesPipelineBooleanSearch(searchQuery, candidate, attributes) && (!experienceMin || attributes.experience >= Number(experienceMin)) && (!experienceMax || attributes.experience <= Number(experienceMax)) && (!salaryMin || attributes.salary >= Number(salaryMin)) && (!salaryMax || attributes.salary <= Number(salaryMax)) && qualifications[attributes.qualification] && (noticePeriod === "All" || attributes.notice === noticePeriod) && (activeRange === "all" || attributes.activeDays <= Number(activeRange));
  });
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(matchingCandidates.length / pageSize));
  const activePage = Math.min(page, pageCount);
  const pageCandidates = matchingCandidates.slice((activePage - 1) * pageSize, activePage * pageSize);
  const moveCandidate = (id: number, stage: Candidate["stage"]) => {
    const candidate = candidates.find((item) => item.id === id);
    setCandidates((current) => current.map((item) => item.id === id ? { ...item, stage, profileUpdated: "Just now" } : item));
    if (candidate?.applicationId) void apiClient(`/api/recruiter/pipeline/${candidate.applicationId}/stage`, { method: "PATCH", body: JSON.stringify({ stage: stage.toUpperCase().replaceAll(" ", "_") }) }).catch(() => setPipelineLoadNote(`Could not persist ${candidate.name}'s stage. Refresh before continuing.`));
  };
  const updateNote = (id: number, note: string) => setCandidates((current) => current.map((item) => item.id === id ? { ...item, note } : item));
  const saveNote = (candidate: Candidate) => { if (candidate.applicationId && candidate.note.trim()) void apiClient(`/api/recruiter/pipeline/${candidate.applicationId}/notes`, { method: "POST", body: JSON.stringify({ note: candidate.note.trim() }) }).catch(() => setPipelineLoadNote(`Could not save the note for ${candidate.name}.`)); };
  const clearFilters = () => { setSearchQuery(""); setExperienceMin(""); setExperienceMax(""); setSalaryMin(""); setSalaryMax(""); setQualifications({ Bachelors: true, Masters: true }); setNoticePeriod("All"); setActiveRange("all"); setPage(1); if (requestedStage !== "all" || requestedRole !== "all") window.location.assign("/recruiter/pipeline"); };
  const accessContact = async (candidate: Candidate, method: "email" | "phone") => {
    const alreadyRevealed = Boolean(revealedContacts[candidate.id]?.[method]);
    if (alreadyRevealed) {
      try { await navigator.clipboard?.writeText(candidate[method]); setActionNotice((current) => ({ ...current, [candidate.id]: `${method === "email" ? "Email" : "Phone number"} copied to clipboard.` })); } catch { setActionNotice((current) => ({ ...current, [candidate.id]: `${method === "email" ? "Email" : "Phone number"} is ready to copy.` })); }
      return;
    }
    setRevealingContacts((current) => ({ ...current, [candidate.id]: { ...current[candidate.id], [method]: true } }));
    setActionNotice((current) => ({ ...current, [candidate.id]: `Recording ${method === "email" ? "email" : "phone number"} access…` }));
    try {
      const jobId = candidate.jobId || pipelineJobIdForCandidate(candidate);
      if (candidate.candidateId) {
        const contact = await apiClient<{ value: string }>(`/api/recruiter/candidates/${candidate.candidateId}/contact?channel=${method === "email" ? "EMAIL" : "MOBILE"}&jobId=${encodeURIComponent(jobId)}`);
        setCandidates((current) => current.map((item) => item.id === candidate.id ? { ...item, [method]: contact.value } : item));
      } else {
        const response = await fetch("/api/audit-logs/contact-reveal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: candidate.id, jobId, contactMethod: method, purpose: "recruitment_pipeline" }) });
        if (!response.ok) throw new Error("Audit request was rejected");
      }
      setRevealedContacts((current) => ({ ...current, [candidate.id]: { ...current[candidate.id], [method]: true } }));
      setActionNotice((current) => ({ ...current, [candidate.id]: `${method === "email" ? "Email" : "Phone number"} reveal recorded for ${jobId} in the privacy audit trail.` }));
    } catch {
      setActionNotice((current) => ({ ...current, [candidate.id]: "We could not record this access. Contact details remain masked." }));
    } finally {
      setRevealingContacts((current) => ({ ...current, [candidate.id]: { ...current[candidate.id], [method]: false } }));
    }
  };
  const filterDescription = [requestedRole !== "all" ? requestedRole.split("-").map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(" ") : "All active roles", requestedStage !== "all" ? stageLabel : "All stages"].join(" · ");
  return <WorkspaceShell workspace="recruiter" active="pipeline" title="Candidate pipeline" description={filterDescription} actions={<><Button variant="secondary" onClick={() => setFiltersOpen(true)}>Filters</Button><Button href="/recruiter/jobs">Open job</Button></>}>
    <div className={`pipeline-filter-hint ${pipelineSource === "live" ? "positive" : ""}`}><span><b>{pipelineSource === "live" ? "Live pipeline" : "Preview pipeline"}</b> · {pipelineLoadNote || "Candidate stages, notes and contact audit context are synced with the backend."}</span></div>
    {(requestedStage !== "all" || requestedRole !== "all") && <div className="pipeline-filter-hint"><span>Showing <b>{filterDescription}</b>. Clear the filter to return to the full pipeline.</span><Button onClick={clearFilters} variant="quiet">Clear filter</Button></div>}
    <section className="panel pipeline-list-intro"><div><span className="eyebrow">Recruitment pipeline</span><h2>{matchingCandidates.length} candidates</h2><p>High-density list view · {pageSize} candidates per page</p></div><div className="pipeline-privacy-notice"><span>⌑</span><p><b>Contact details are masked by default.</b> Reveal only when needed for an authorised recruitment action.</p></div></section>
    <section className="pipeline-workspace-grid">
      {filtersOpen && <button className="pipeline-filter-backdrop" aria-label="Close filters" onClick={() => setFiltersOpen(false)}/>}
      <aside className={`pipeline-filter-sidebar ${filtersOpen ? "open" : ""}`} aria-label="Advanced candidate filters">
        <header><div><span className="eyebrow">Advanced sourcing</span><h2>Filters</h2></div><button className="pipeline-filter-close" aria-label="Close filters" onClick={() => setFiltersOpen(false)}>×</button></header>
        <div className="filter-side-group"><strong>Experience</strong><div className="filter-side-range"><label>Min<input aria-label="Minimum experience" type="number" min="0" value={experienceMin} onChange={(event) => { setExperienceMin(event.target.value); setPage(1); }}/></label><label>Max<input aria-label="Maximum experience" type="number" min="0" value={experienceMax} onChange={(event) => { setExperienceMax(event.target.value); setPage(1); }}/></label></div></div>
        <div className="filter-side-group"><strong>Salary range</strong><div className="filter-side-range"><label>Min<input aria-label="Minimum salary" type="number" min="0" value={salaryMin} onChange={(event) => { setSalaryMin(event.target.value); setPage(1); }}/></label><label>Max<input aria-label="Maximum salary" type="number" min="0" value={salaryMax} onChange={(event) => { setSalaryMax(event.target.value); setPage(1); }}/></label></div></div>
        <fieldset className="filter-side-group"><legend>Qualification</legend><label><input type="checkbox" checked={qualifications.Bachelors} onChange={(event) => { setQualifications((current) => ({ ...current, Bachelors: event.target.checked })); setPage(1); }}/> Bachelors</label><label><input type="checkbox" checked={qualifications.Masters} onChange={(event) => { setQualifications((current) => ({ ...current, Masters: event.target.checked })); setPage(1); }}/> Masters</label></fieldset>
        <label className="filter-side-group">Notice period<select aria-label="Notice period" value={noticePeriod} onChange={(event) => { setNoticePeriod(event.target.value); setPage(1); }}><option>All</option><option>Immediate</option><option>15 days</option><option>30 days</option><option>60 days</option><option>90 days</option></select></label>
        <label className="filter-side-group">Active status<select aria-label="Active status" value={activeRange} onChange={(event) => { setActiveRange(event.target.value); setPage(1); }}>{activeOptions.map((option) => <option value={option.value} key={option.value}>{option.label === "All" ? "All" : `Last ${option.label}`}</option>)}</select></label>
        <button className="pipeline-clear-sourcing" onClick={clearFilters}>Clear all filters</button>
      </aside>
      <div className="pipeline-results-column"><section className="pipeline-sourcing-toolbar" aria-label="Candidate sourcing toolbar"><div className="pipeline-toolbar-main"><label className="pipeline-search"><span>⌕</span><input aria-label="Search candidates with Boolean keywords" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setPage(1); }} placeholder={'Search skills, names, or Boolean queries e.g. React AND "Node.js"'}/></label><button className="pipeline-mobile-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>☷ Filters</button><div className="pipeline-view-toggle" role="group" aria-label="Candidate view format"><button className={view === "list" ? "active" : ""} aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}>☰</button><button className={view === "card" ? "active" : ""} aria-label="Card view" aria-pressed={view === "card"} onClick={() => setView("card")}>▦</button></div></div></section>
    <section className={`pipeline-list ${view === "card" ? "pipeline-card-view" : "pipeline-grid-view"}`} aria-label={`Candidate pipeline ${view} view`}>{pageCandidates.map((candidate) => <PipelineListRow candidate={candidate} key={candidate.id} emailRevealed={Boolean(revealedContacts[candidate.id]?.email)} phoneRevealed={Boolean(revealedContacts[candidate.id]?.phone)} emailPending={Boolean(revealingContacts[candidate.id]?.email)} phonePending={Boolean(revealingContacts[candidate.id]?.phone)} noteExpanded={Boolean(expandedNotes[candidate.id])} actionNotice={actionNotice[candidate.id]} onEmailAccess={() => { void accessContact(candidate, "email"); }} onPhoneAccess={() => { void accessContact(candidate, "phone"); }} onToggleNote={() => setExpandedNotes((current) => ({ ...current, [candidate.id]: !current[candidate.id] }))} onStageChange={(stage) => moveCandidate(candidate.id, stage)} onNoteChange={(note) => updateNote(candidate.id, note)} onNoteSave={() => saveNote(candidate)} onInMail={() => setActionNotice((current) => ({ ...current, [candidate.id]: "InMail workflow opened. Delivery will use your linked integration." }))}/>)}</section>
    {matchingCandidates.length === 0 && <section className="empty-state"><span>⌕</span><h3>No candidates match this pipeline view</h3><p>Clear the selected stage or role to return to the full candidate list.</p><Button onClick={clearFilters}>Clear filters</Button></section>}
    <PipelinePagination current={activePage} pages={pageCount} visibleCount={pageCandidates.length} total={matchingCandidates.length} onChange={setPage}/></div>
    </section>
  </WorkspaceShell>;
}

function PipelineListRow({ candidate, emailRevealed, phoneRevealed, emailPending, phonePending, noteExpanded, actionNotice, onEmailAccess, onPhoneAccess, onToggleNote, onStageChange, onNoteChange, onNoteSave, onInMail }: { candidate: Candidate; emailRevealed: boolean; phoneRevealed: boolean; emailPending: boolean; phonePending: boolean; noteExpanded: boolean; actionNotice?: string; onEmailAccess: () => void; onPhoneAccess: () => void; onToggleNote: () => void; onStageChange: (stage: Candidate["stage"]) => void; onNoteChange: (note: string) => void; onNoteSave: () => void; onInMail: () => void }) {
  const attributes = pipelineAttributesFor(candidate); const details = pipelineDetailsFor(candidate);
  return <article className="pipeline-list-row"><div className="pipeline-profile-main"><header><div><h2>{candidate.name}</h2><Badge tone={candidate.score > 92 ? "green" : "blue"}>{candidate.score}% match</Badge></div><span>{candidate.stage}</span></header><div className="pipeline-profile-meta"><span>▰ {attributes.experience}y</span><span>▣ {formatPipelineSalary(attributes.salary)}</span><span>● {details.preferredLocations.split(",")[0]}</span></div><dl><div><dt>Current</dt><dd>{candidate.role} at {details.currentCompany}</dd></div><div><dt>Previous</dt><dd>{details.previousRole} at {details.previousCompany}</dd></div><div><dt>Education</dt><dd>{details.education}</dd></div><div><dt>Pref. locations</dt><dd>{details.preferredLocations}</dd></div><div><dt>Key skills</dt><dd>{attributes.skills.map((skill, index) => <span key={skill}>{skill}{index < attributes.skills.length - 1 && " | "}</span>)}</dd></div><div><dt>May also know</dt><dd>{details.mayKnow}</dd></div></dl><footer><span>{Math.max(42, details.views * 3)} similar profiles</span><span aria-label={`${details.views} recruiters viewed this profile`}>◉ {details.views}</span><span aria-label={`${details.downloads} recruiters downloaded this profile`}>⇩ {details.downloads}</span></footer></div><aside className="pipeline-profile-contact"><span className="pipeline-list-avatar">{candidate.initials}</span><p>{details.summary}</p><ContactPill type="phone" value={candidate.phone} revealed={phoneRevealed} pending={phonePending} onClick={onPhoneAccess}/><ContactPill type="email" value={candidate.email} revealed={emailRevealed} pending={emailPending} onClick={onEmailAccess}/><small>Verified phone &amp; email</small></aside><div className="pipeline-card-workflow"><label className="pipeline-stage-select"><span>Pipeline stage</span><select aria-label={`Move ${candidate.name} to`} value={candidate.stage} onChange={(event) => onStageChange(event.target.value as Candidate["stage"])}>{stages.map((stage) => <option value={stage} key={stage}>{stage}</option>)}</select></label><div className="pipeline-row-actions"><a href={`/recruiter/communications?candidate=${encodeURIComponent(candidate.name)}`}>Message</a><button onClick={onInMail}>InMail</button>{actionNotice && <small role="status">{actionNotice}</small>}</div><div className="pipeline-inline-note"><button onClick={onToggleNote} aria-expanded={noteExpanded}><span>▤</span>{noteExpanded ? "Close recruiter note" : "View / add recruiter note"}</button>{noteExpanded && <label><span>Recruiter note for {candidate.name}</span><textarea value={candidate.note} onChange={(event) => onNoteChange(event.target.value)} onBlur={onNoteSave} placeholder="Add a screening note…"/></label>}</div></div><footer className="pipeline-row-micro-details"><span>Profile last updated {candidate.profileUpdated}</span><span>Last active {candidate.lastActive}</span></footer></article>;
}

function ContactPill({ type, value, revealed, pending, onClick }: { type: "email" | "phone"; value: string; revealed: boolean; pending: boolean; onClick: () => void }) { const contactNoun = type === "email" ? "email address" : "phone number"; const displayed = revealed ? value : type === "email" ? maskCandidateEmail(value) : maskCandidatePhone(value); return <button className={`contact-pill ${revealed ? "revealed" : ""}`} disabled={pending} onClick={onClick} aria-busy={pending} aria-label={revealed ? `Copy ${contactNoun}` : `Reveal ${contactNoun}`}><span>{type === "email" ? "✉" : "⌕"}</span><b>{displayed}</b>{pending ? <i>Logging…</i> : revealed && <i>Copy</i>}</button>; }

function PipelinePagination({ current, pages, visibleCount, total, onChange }: { current: number; pages: number; visibleCount: number; total: number; onChange: (page: number) => void }) { if (total === 0) return null; return <footer className="pipeline-pagination"><span>Showing {visibleCount} of {total} · 10 per page</span><nav aria-label="Candidate pipeline pages"><button disabled={current === 1} onClick={() => onChange(current - 1)}>← Previous</button>{Array.from({ length: pages }, (_, index) => <button className={current === index + 1 ? "active" : ""} onClick={() => onChange(index + 1)} key={index}>{index + 1}</button>)}<button disabled={current === pages} onClick={() => onChange(current + 1)}>Next →</button></nav></footer>; }
function maskCandidateEmail(email: string) { const [local, domain] = email.split("@"); return `${local.slice(0, 1)}***@${domain}`; }
function maskCandidatePhone(phone: string) { return `+91 **** ***${phone.replace(/\D/g, "").slice(-3)}`; }
function formatPipelineSalary(value: number) { const lakhs = Math.round((value / 3000) * 10) / 10; return `₹ ${Number.isInteger(lakhs) ? lakhs : lakhs.toFixed(1)} Lacs`; }
function matchesPipelineBooleanSearch(query: string, candidate: Candidate, attributes: CandidateAttributes) { if (!query.trim()) return true; const haystack = `${candidate.name} ${candidate.role} ${attributes.skills.join(" ")}`.toLowerCase(); const includesTerm = (term: string) => haystack.includes(term.replace(/^[\s"()]+|[\s"()]+$/g, "").toLowerCase()); return query.split(/\s+AND\s+/i).filter(Boolean).every((group) => group.split(/\s+OR\s+/i).filter(Boolean).some((term) => /^NOT\s+/i.test(term) ? !includesTerm(term.replace(/^NOT\s+/i, "")) : includesTerm(term))); }
function pipelineStageFromApi(stage: string): Candidate["stage"] { if (stage === "INTERVIEWING") return "Interviewing"; if (stage === "FINAL_STAGE") return "Final stage"; if (stage === "OFFER") return "Offer"; if (stage === "ONBOARDED") return "Onboarded"; return "Screening"; }
function relativeDate(value: string | null) { if (!value) return "Not available"; const days = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 86_400_000)); return days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"} ago`; }
function pipelineAttributesFor(candidate: Candidate): CandidateAttributes { return candidateAttributes[candidate.id] ?? { experience: 0, salary: 0, qualification: "Bachelors", notice: "30 days", activeDays: 0, skills: candidate.liveSkills?.length ? candidate.liveSkills : ["Profile evidence pending"] }; }
function pipelineDetailsFor(candidate: Candidate): PipelineCandidateCardDetails { return pipelineCandidateCardDetails[candidate.id] ?? { currentCompany: "Company available in candidate profile", previousRole: "Previous role not shared", previousCompany: "Previous company not shared", education: "Education available in candidate profile", preferredLocations: "Location preferences available in profile", summary: candidate.role, mayKnow: candidate.liveSkills?.join(" | ") || "Additional skills not shared", views: 0, downloads: 0 }; }
