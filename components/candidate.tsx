"use client";

import { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";
import { Badge, Button, Meter, SectionTitle, WorkspaceShell } from "./ui";

type ActivityKind = "ALL" | "PROFILE_VIEWED" | "RESUME_DOWNLOADED";
type DashboardRange = 7 | 30 | 90;

export type CandidateDashboardData = {
  profile: { fullName: string; headline: string | null; domainCategory: string; profileSearchable: boolean; profileLastUpdatedAt: string | null; lastActiveAt: string | null };
  performance: { rangeDays: number; profileAppearances: number; recruiterActions: number; profileViews: number; resumeDownloads: number; profileAppearancesInRange: number; recruiterActionsInRange: number; appearanceChangePercent: number; actionChangePercent: number; profileCompleteness: number; activityLevel: "HIGH" | "MEDIUM" | "BUILDING" };
  recruiterActivity: Array<{ recruiterName: string; recruiterTitle: string | null; organisationName: string; action: Exclude<ActivityKind, "ALL">; occurredAt: string }>;
  applications: Array<{ applicationId: string; title: string; companyName: string; stage: string; updatedAt: string }>;
};

const dashboardPreview: CandidateDashboardData = {
  profile: { fullName: "Amara Mensah", headline: "Senior Product Designer", domainCategory: "NON_TECH", profileSearchable: true, profileLastUpdatedAt: "2026-08-23T10:30:00Z", lastActiveAt: new Date().toISOString() },
  performance: { rangeDays: 90, profileAppearances: 24, recruiterActions: 31, profileViews: 24, resumeDownloads: 7, profileAppearancesInRange: 12, recruiterActionsInRange: 16, appearanceChangePercent: 33, actionChangePercent: 45, profileCompleteness: 82, activityLevel: "MEDIUM" },
  recruiterActivity: [
    { recruiterName: "Neha Sharma", recruiterTitle: "Talent Partner", organisationName: "Tyro Ventures", action: "PROFILE_VIEWED", occurredAt: "2026-08-27T09:30:00Z" },
    { recruiterName: "Kartik Iyer", recruiterTitle: "Director, Talent", organisationName: "Integrated Personnel Services", action: "RESUME_DOWNLOADED", occurredAt: "2026-08-27T06:00:00Z" },
    { recruiterName: "Sofia Malik", recruiterTitle: "Recruitment Lead", organisationName: "Morrow Health", action: "PROFILE_VIEWED", occurredAt: "2026-08-25T09:00:00Z" },
  ],
  applications: [
    { applicationId: "preview-1", title: "Product Designer", companyName: "Northstar", stage: "INTERVIEW", updatedAt: "2026-08-27T08:00:00Z" },
    { applicationId: "preview-2", title: "Senior UX Designer", companyName: "Tandem", stage: "SCREENING", updatedAt: "2026-08-26T12:00:00Z" },
  ],
};

export function CandidateDashboard({ initialData }: { initialData?: CandidateDashboardData | null }) {
  const [dashboard, setDashboard] = useState(initialData ?? dashboardPreview);
  const [rangeDays, setRangeDays] = useState<DashboardRange>((initialData?.performance.rangeDays as DashboardRange) ?? 90);
  const [activityFilter, setActivityFilter] = useState<ActivityKind>("ALL");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const performance = dashboard.performance;
  const visibleActivity = activityFilter === "ALL" ? dashboard.recruiterActivity : dashboard.recruiterActivity.filter((item) => item.action === activityFilter);
  const name = dashboard.profile.fullName.split(" ")[0] || "there";

  async function changeRange(nextRange: DashboardRange) {
    setRangeDays(nextRange); setRefreshing(true); setRefreshError("");
    try { setDashboard(await apiClient<CandidateDashboardData>(`/api/candidate/dashboard?rangeDays=${nextRange}`)); }
    catch (reason) { setRefreshError(reason instanceof Error ? reason.message : "The latest performance data is unavailable right now."); }
    finally { setRefreshing(false); }
  }

  return <WorkspaceShell workspace="candidate" active="dashboard" title="Profile performance" description={`Hi ${name} — a private summary of how your profile is performing with recruiters.`}>
    <main className="candidate-analytics-dashboard">
      <section className="candidate-analytics-heading"><div><span className="eyebrow">Recruiter visibility</span><h2>Profile performance</h2><p>See when recruiters discover your profile, view it, and download your CV.</p></div><Button href="/candidate/profile" variant="secondary">Edit profile</Button></section>
      {refreshError && <p className="candidate-analytics-error" role="alert">{refreshError}</p>}
      <div className="candidate-analytics-layout">
        <div className="candidate-analytics-main">
          <section className="panel candidate-performance-summary"><div className="candidate-performance-metrics"><AnalyticsMetric value={performance.profileAppearances} label="Profile appearances" detail="Unique recruiters who opened your sourcing profile"/><AnalyticsMetric value={performance.recruiterActions} label="Recruiter actions" detail={`${performance.profileViews} profile views · ${performance.resumeDownloads} CV downloads`}/></div><div className="candidate-performance-note"><span>All-time overview</span><p>{dashboard.profile.profileSearchable ? "Your profile is visible to recruiters and your contact details stay protected." : "Your profile is private until you turn on sourcing visibility."}</p></div></section>

          <section className="panel candidate-analytics-period"><div><strong>{performance.profileAppearancesInRange} profile appearances in the last {rangeDays} days</strong><span className={performance.appearanceChangePercent >= 0 ? "positive" : "negative"}>{changeLabel(performance.appearanceChangePercent)} compared with the previous {rangeDays} days</span></div><label className="candidate-analytics-range"><span>Period</span><select aria-label="Analytics period" value={rangeDays} onChange={(event) => void changeRange(Number(event.target.value) as DashboardRange)} disabled={refreshing}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label>{refreshing && <small role="status">Refreshing performance data…</small>}</section>

          <section className="panel candidate-recruiter-activity"><SectionTitle eyebrow="Recruiter activity" title={`${performance.recruiterActions} actions on your profile`} action={<Button href="/candidate/notifications" variant="quiet">Notifications →</Button>}/><div className="candidate-activity-filter" role="group" aria-label="Recruiter activity filter">{(["ALL", "PROFILE_VIEWED", "RESUME_DOWNLOADED"] as ActivityKind[]).map((filter) => <button type="button" className={activityFilter === filter ? "selected" : ""} onClick={() => setActivityFilter(filter)} key={filter}>{activityFilterLabel(filter, performance)}</button>)}</div>{visibleActivity.length ? <div className="candidate-activity-cards">{visibleActivity.map((item, index) => <article className="candidate-activity-card" key={`${item.recruiterName}-${item.action}-${index}`}><div className="candidate-activity-person"><span>{initials(item.recruiterName)}</span><div><h3>{item.recruiterName}</h3><p>{item.recruiterTitle || "Recruitment team"} · {item.organisationName}</p></div></div><div className="candidate-activity-card-footer"><strong className={item.action === "RESUME_DOWNLOADED" ? "downloaded" : "viewed"}>{item.action === "RESUME_DOWNLOADED" ? "CV downloaded" : "Profile viewed"}</strong><small>{relativeTime(item.occurredAt)}</small></div></article>)}</div> : <div className="candidate-activity-empty"><strong>No {activityFilter === "ALL" ? "recruiter activity" : activityFilterLabel(activityFilter, performance).toLowerCase()} yet.</strong><p>Keep your profile current and searchable to improve your chances of being discovered.</p><Button href="/candidate/profile" variant="secondary">Improve my profile</Button></div>}</section>

          <section className="panel candidate-application-snapshot"><SectionTitle eyebrow="Your job search" title="Applications in progress" action={<Button href="/candidate/applications" variant="quiet">View all applications →</Button>}/>{dashboard.applications.length ? <div className="application-status">{dashboard.applications.map((application) => <div className="application-row" key={application.applicationId}><span className="company-mark">{application.companyName.slice(0, 1)}</span><div><strong>{application.title}</strong><small>{application.companyName} · Updated {relativeTime(application.updatedAt)}</small></div><Badge tone={application.stage === "INTERVIEW" ? "green" : "blue"}>{application.stage.replaceAll("_", " ")}</Badge></div>)}</div> : <div className="candidate-activity-empty"><strong>No active applications yet.</strong><p>Explore roles that match your profile and track them here.</p><Button href="/candidate/jobs">Explore jobs</Button></div>}</section>
        </div>

        <aside className="candidate-analytics-aside">
          <section className={`panel candidate-activity-level level-${performance.activityLevel.toLowerCase()}`}><SectionTitle title="Activity level"/><div className="candidate-activity-gauge" aria-label={`Activity level: ${performance.activityLevel}`}><strong>{activityLevelLabel(performance.activityLevel)}</strong></div><p>{activityLevelCopy(performance.activityLevel)}</p><div className="candidate-activity-tips"><h3>Tips to improve your activity level</h3><ActivityTip complete={dashboard.profile.profileSearchable} title="Keep your profile visible" copy="Turn on sourcing visibility when you are open to opportunities." action="Open profile"/><ActivityTip complete={performance.profileCompleteness >= 80} title="Keep your profile updated" copy="A complete, current profile gives recruiters more context." action="Update profile"/><ActivityTip complete={Boolean(dashboard.profile.lastActiveAt && Date.now() - new Date(dashboard.profile.lastActiveAt).getTime() < 7 * 24 * 60 * 60 * 1000)} title="Return regularly" copy="Check messages and opportunities at least once each week." action="View notifications"/></div></section>
          <section className="panel candidate-completeness-card"><SectionTitle title={`Profile completeness ${performance.profileCompleteness}%`}/><Meter value={performance.profileCompleteness}/><p>{performance.profileCompleteness >= 80 ? "You have a strong profile foundation. Keep your experience and work links current." : "Completing the missing professional details can improve the quality of recruiter matches."}</p><Button href="/candidate/profile" variant="quiet">Review profile →</Button></section>
        </aside>
      </div>
    </main>
  </WorkspaceShell>;
}

function AnalyticsMetric({ value, label, detail }: { value: number; label: string; detail: string }) { return <div className="candidate-analytics-metric"><strong>{value.toLocaleString("en-IN")}</strong><div><span>{label}</span><small>{detail}</small></div></div>; }
function ActivityTip({ complete, title, copy, action }: { complete: boolean; title: string; copy: string; action: string }) { return <div className="candidate-activity-tip"><span aria-hidden="true">{complete ? "✓" : "→"}</span><div><strong>{title}</strong><p>{copy}</p><a href={action === "View notifications" ? "/candidate/notifications" : "/candidate/profile"}>{action}</a></div></div>; }
function activityFilterLabel(filter: ActivityKind, performance: CandidateDashboardData["performance"]) { if (filter === "ALL") return `All activity (${performance.recruiterActions})`; if (filter === "PROFILE_VIEWED") return `Profile viewed (${performance.profileViews})`; return `CV downloaded (${performance.resumeDownloads})`; }
function activityLevelLabel(level: CandidateDashboardData["performance"]["activityLevel"]) { return level === "BUILDING" ? "BUILDING" : level; }
function activityLevelCopy(level: CandidateDashboardData["performance"]["activityLevel"]) { return level === "HIGH" ? "Strong recent activity is helping your profile get noticed." : level === "MEDIUM" ? "Your profile is gaining attention. A few updates can help it travel further." : "Your profile is ready for its next visibility boost."; }
function changeLabel(value: number) { return `${value >= 0 ? "↑" : "↓"} ${Math.abs(value)}%`; }
function initials(value: string) { return value.split(" ").map((part) => part[0]).join("").slice(0, 2) || "R"; }
function relativeTime(value: string) { const diff = Math.max(0, Date.now() - new Date(value).getTime()); const minutes = Math.floor(diff / 60_000); if (minutes < 1) return "Just now"; if (minutes < 60) return `${minutes} min ago`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h ago`; const days = Math.floor(hours / 24); return `${days}d ago`; }

export function ResumeReview() {
  const [confirmed, setConfirmed] = useState(false);
  return <WorkspaceShell workspace="candidate" active="resume" title="Review your CV details" description="Confirm every extracted field before it becomes part of your candidate profile." actions={<Button href="/candidate/profile" variant="secondary">Open profile</Button>}>
    <div className="review-intro"><span>✦</span><div><b>{confirmed ? "Your confirmed details are now in your profile." : "Your profile is unchanged until you confirm the information below."}</b> Field confidence is a guide only. Please check each item against your original CV.</div>{confirmed && <Badge tone="green">Profile updated</Badge>}</div>
    <section className="review-layout"><aside className="document-pane" aria-label="Original uploaded resume"><div className="document-toolbar"><span>Amara_Mensah_Resume.pdf</span><span>− &nbsp; 100% &nbsp; +</span></div><article className="document-paper"><h2>Amara Mensah</h2><div className="document-contact">Product Designer · London, UK · amara.mensah@email.com</div><h3>Profile</h3><p>Product designer with 6+ years creating intuitive digital experiences for people and growing teams.</p><h3>Experience</h3><div className="document-job"><strong>Senior Product Designer · Northstar Labs</strong><p>Jan 2022 – Present · London, UK</p><p>Leading end-to-end experience design for an analytics platform used by 20,000+ customers.</p></div><h3>Education</h3><p><strong>BA Interaction Design</strong> · University of the Arts London · 2016 – 2019</p><h3>Skills</h3><p>Product strategy · Figma · Prototyping · Research · Design systems</p></article></aside><form className="review-form" onSubmit={(event) => { event.preventDefault(); setConfirmed(true); }}><header className="review-form-head"><div><h2>Extracted details</h2><p>Edit, accept or correct the information found in your CV.</p></div><Badge tone="green">5 sections found</Badge></header><div className="review-section"><div className="review-section-title"><h3>Personal information</h3><span className="confidence high">● High confidence</span></div><div className="review-fields"><Field label="Full name" defaultValue="Amara Mensah"/><Field label="Email" defaultValue="amara.mensah@email.com"/><Field label="Phone" defaultValue="+44 7700 900 112"/><Field label="Location" defaultValue="London, United Kingdom"/></div></div><div className="review-section"><div className="review-section-title"><h3>Most recent experience</h3><span className="confidence high">● High confidence</span></div><div className="review-fields"><Field label="Company" defaultValue="Northstar Labs"/><Field label="Role" defaultValue="Senior Product Designer"/><Field label="Start date" defaultValue="January 2022"/><Field label="End date" defaultValue="Present"/><Field label="Roles and responsibilities" defaultValue="Leading end-to-end experience design for an analytics platform used by 20,000+ customers." multiline wide/></div></div><footer className="review-footer"><p>By confirming, you choose which parsed details become part of your Sapienworx profile.</p><div><Button href="/candidate" variant="secondary">Cancel</Button><Button type="submit">{confirmed ? "Confirmed" : "Confirm and update profile"}</Button></div></footer></form></section>
  </WorkspaceShell>;
}

function Field({ label, defaultValue, wide = false, multiline = false }: { label: string; defaultValue: string; wide?: boolean; multiline?: boolean }) { return <div className={`review-field ${wide ? "wide" : ""}`}><label>{label}</label>{multiline ? <textarea defaultValue={defaultValue}/> : <input defaultValue={defaultValue}/>}</div>; }

type CandidateJob = { id: string; company: string; role: string; department: string; skills: string[]; location: string; type: string; minimumExperience: number; maximumExperience: number; minimumSalary: number | null; maximumSalary: number | null; postedDays: number; logo: string; color: string; matchScore: number; match?: string; description: string; publicPath: string };
type PublicJobPage = { content: Array<{ jobId: string; title: string; organisationName: string; location: string; department: string; minimumExperienceYears: number; maximumExperienceYears: number; minimumSalaryLakhs: number | null; maximumSalaryLakhs: number | null; salaryVisible: boolean; descriptionHtml: string; skills: string[]; publishedAt: string | null; publicPath: string }> };
type JobView = "MATCHES" | "SAVED";
type JobSort = "RELEVANCE" | "RECENT" | "SALARY";

const jobListings: CandidateJob[] = [
  { id: "SWX_NX_001", company: "Nexora Cloud", role: "Senior Backend Engineer", department: "Engineering", skills: ["TypeScript", "Node.js", "PostgreSQL"], location: "Bengaluru · Hybrid", type: "Hybrid", minimumExperience: 4, maximumExperience: 7, minimumSalary: 18, maximumSalary: 28, postedDays: 1, logo: "N", color: "", matchScore: 94, description: "Build reliable data and workflow services for a fast-growing hiring platform.", publicPath: "/jobs/SWX_NX_001/senior-backend-engineer" },
  { id: "SWX_AT_001", company: "Atlas Labs", role: "Product Manager", department: "Product", skills: ["Product strategy", "SQL", "Discovery"], location: "Remote", type: "Remote", minimumExperience: 4, maximumExperience: 8, minimumSalary: 20, maximumSalary: 32, postedDays: 2, logo: "A", color: "blue", matchScore: 89, description: "Own a product area from discovery to measurable customer outcomes.", publicPath: "/jobs/SWX_AT_001/product-manager" },
  { id: "SWX_PH_001", company: "Pulse Health", role: "Data Analyst", department: "Analytics", skills: ["SQL", "Python", "Tableau"], location: "Pune · Hybrid", type: "Hybrid", minimumExperience: 2, maximumExperience: 5, minimumSalary: 10, maximumSalary: 16, postedDays: 3, logo: "P", color: "orange", matchScore: 86, description: "Turn operational data into decisions that improve patient services.", publicPath: "/jobs/SWX_PH_001/data-analyst" },
  { id: "SWX_MR_001", company: "Morrow", role: "Product Designer", department: "Design", skills: ["Figma", "Research", "Design systems"], location: "Mumbai", type: "On-site", minimumExperience: 3, maximumExperience: 6, minimumSalary: 14, maximumSalary: 22, postedDays: 5, logo: "M", color: "purple", matchScore: 83, description: "Design intuitive digital journeys for a consumer-first financial product.", publicPath: "/jobs/SWX_MR_001/product-designer" },
  { id: "SWX_KS_001", company: "Keystone", role: "Cloud Engineer", department: "Engineering", skills: ["AWS", "Docker", "Kubernetes"], location: "Remote", type: "Remote", minimumExperience: 3, maximumExperience: 6, minimumSalary: 16, maximumSalary: 25, postedDays: 8, logo: "K", color: "green", matchScore: 80, description: "Help build resilient infrastructure and modern delivery platforms.", publicPath: "/jobs/SWX_KS_001/cloud-engineer" },
  { id: "SWX_NV_001", company: "Northstar Ventures", role: "Growth Marketing Manager", department: "Marketing", skills: ["GTM", "Analytics", "B2B SaaS"], location: "Gurugram", type: "Hybrid", minimumExperience: 4, maximumExperience: 7, minimumSalary: 18, maximumSalary: 27, postedDays: 12, logo: "N", color: "orange", matchScore: 76, description: "Shape the acquisition and lifecycle strategy for a growing B2B platform.", publicPath: "/jobs/SWX_NV_001/growth-marketing-manager" },
];

type JobFilters = { query: string; minimumExperience: string; maximumExperience: string; minimumSalary: string; maximumSalary: string; location: string; postedWithin: string; company: string };
const emptyFilters: JobFilters = { query: "", minimumExperience: "", maximumExperience: "", minimumSalary: "", maximumSalary: "", location: "", postedWithin: "", company: "" };

function LegacyCandidateJobs() {
  const [filters, setFilters] = useState<JobFilters>(emptyFilters);
  const [saved, setSaved] = useState<string[]>([]);
  const [applied, setApplied] = useState<string | null>(null);
  const setFilter = (key: keyof JobFilters, value: string) => setFilters({ ...filters, [key]: value });
  const visibleJobs = jobListings.filter((job) => {
    const searchable = `${job.role} ${job.company} ${job.skills.join(" ")}`.toLowerCase();
    return (!filters.query || searchable.includes(filters.query.toLowerCase())) && (!filters.minimumExperience || job.maximumExperience >= Number(filters.minimumExperience)) && (!filters.maximumExperience || job.minimumExperience <= Number(filters.maximumExperience)) && (!filters.minimumSalary || (job.maximumSalary ?? 0) >= Number(filters.minimumSalary)) && (!filters.maximumSalary || (job.minimumSalary ?? 0) <= Number(filters.maximumSalary)) && (!filters.location || job.location === filters.location) && (!filters.company || job.company === filters.company) && (!filters.postedWithin || job.postedDays <= Number(filters.postedWithin));
  });
  return <WorkspaceShell workspace="candidate" active="jobs" title="Find work that fits" description="Search by title, skills, experience, salary, location, date and company.">
    {applied && <div className="applied-banner">Your application for <strong>{jobListings.find((job) => job.id === applied)?.role}</strong> has been registered. The recruiter&apos;s activity will appear in Notifications.</div>}
    <section className="candidate-job-search panel"><div className="candidate-filter-title"><div><span className="eyebrow">Job board</span><h2>Refine your search</h2></div><Button onClick={() => setFilters(emptyFilters)} variant="quiet">Clear all</Button></div><div className="candidate-filter-grid"><FilterControl label="Job title or keywords" value={filters.query} onChange={(value) => setFilter("query", value)} placeholder="e.g. Product designer, Figma"/><SelectControl label="Min. experience" value={filters.minimumExperience} onChange={(value) => setFilter("minimumExperience", value)} options={[["", "Any"], ["0", "0 years"], ["2", "2 years"], ["4", "4 years"], ["6", "6 years"]]}/><SelectControl label="Max. experience" value={filters.maximumExperience} onChange={(value) => setFilter("maximumExperience", value)} options={[["", "Any"], ["3", "3 years"], ["5", "5 years"], ["7", "7 years"], ["10", "10+ years"]]}/><SelectControl label="Min. salary" value={filters.minimumSalary} onChange={(value) => setFilter("minimumSalary", value)} options={[["", "Any"], ["40", "£40k"], ["60", "£60k"], ["80", "£80k"]]}/><SelectControl label="Max. salary" value={filters.maximumSalary} onChange={(value) => setFilter("maximumSalary", value)} options={[["", "Any"], ["60", "£60k"], ["80", "£80k"], ["100", "£100k+"]]}/><SelectControl label="Location" value={filters.location} onChange={(value) => setFilter("location", value)} options={[["", "All locations"], ["London", "London"], ["Manchester", "Manchester"], ["Bristol", "Bristol"], ["Remote", "Remote"]]}/><SelectControl label="Posted on" value={filters.postedWithin} onChange={(value) => setFilter("postedWithin", value)} options={[["", "Any time"], ["1", "Past 24 hours"], ["3", "Past 3 days"], ["7", "Past 7 days"], ["30", "Past 30 days"]]}/><SelectControl label="Company" value={filters.company} onChange={(value) => setFilter("company", value)} options={[["", "All companies"], ...Array.from(new Set(jobListings.map((job) => job.company))).map((company) => [company, company])]} /></div></section>
    <section className="job-browser job-browser-full"><div><SectionTitle title={`${visibleJobs.length} roles for you`} action={<span className="muted" style={{ fontSize: 11 }}>Sorted by relevance</span>} /><div className="job-list">{visibleJobs.map((job) => <article className="job-card" key={job.id}><span className={`job-logo ${job.color}`}>{job.logo}</span><div><h3>{job.role}</h3><p>{job.company}</p><div className="candidate-job-tags">{job.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><div className="job-meta"><span>{job.minimumExperience}–{job.maximumExperience} years</span><span>{job.location} · {job.type}</span><span>£{job.minimumSalary}k–£{job.maximumSalary}k</span><span>Posted {job.postedDays === 1 ? "today" : `${job.postedDays}d ago`}</span></div></div><div className="job-card-actions"><button aria-label={`Save ${job.role}`} onClick={() => setSaved((current) => current.includes(job.id) ? current.filter((id) => id !== job.id) : [...current, job.id])} className={`save-button ${saved.includes(job.id) ? "saved" : ""}`}>{saved.includes(job.id) ? "♥" : "♡"}</button>{applied === job.id ? <Badge tone="green">Applied</Badge> : <Button onClick={() => setApplied(job.id)}>Quick apply</Button>}<small className="positive">{job.match}</small></div></article>)}{visibleJobs.length === 0 && <div className="empty-inline"><strong>No roles match those filters.</strong><p>Try widening your experience, salary or location range.</p><Button onClick={() => setFilters(emptyFilters)} variant="secondary">Reset filters</Button></div>}</div></div></section>
  </WorkspaceShell>;
}

function FilterControl({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="candidate-filter-control"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder}/></label>; }
function SelectControl({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) { return <label className="candidate-filter-control"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>; }

export function CandidateJobs({ sharedJobId, sharedApplyOutcome }: { sharedJobId?: string; sharedApplyOutcome?: string } = {}) {
  const [filters, setFilters] = useState<JobFilters>(emptyFilters);
  const [jobs, setJobs] = useState<CandidateJob[]>(jobListings);
  const [saved, setSaved] = useState<string[]>([]);
  const [applied, setApplied] = useState<string[]>([]);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [view, setView] = useState<JobView>("MATCHES");
  const [sort, setSort] = useState<JobSort>("RELEVANCE");
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [notice, setNotice] = useState(() => sharedApplyOutcome === "applied" ? `Your shared-link application${sharedJobId ? ` for ${sharedJobId}` : ""} is in the posting recruiter’s pipeline.` : sharedApplyOutcome === "already-applied" ? "You had already applied to this shared role." : sharedApplyOutcome === "unavailable" ? "This shared role is no longer accepting applications. Your account is still signed in." : sharedApplyOutcome === "owner-unavailable" ? "This role is temporarily unable to accept applications. No application was submitted." : sharedApplyOutcome === "failed" ? "We could not submit the shared-link application. You can retry from this page." : "");
  const [error, setError] = useState("");
  const setFilter = (key: keyof JobFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    let active = true;
    void apiClient<PublicJobPage>("/api/public/jobs").then((response) => {
      if (active && response.content.length) setJobs(response.content.map((job, index) => toCandidateJob(job, index)));
    }).catch(() => { /* Retain the useful preview while the public opportunity feed starts. */ }).finally(() => { if (active) setLoadingJobs(false); });
    return () => { active = false; };
  }, []);

  const matchingJobs = jobs.filter((job) => {
    const searchable = `${job.role} ${job.company} ${job.department} ${job.skills.join(" ")}`.toLowerCase();
    const hasSalary = job.minimumSalary !== null && job.maximumSalary !== null;
    return (!filters.query || searchable.includes(filters.query.toLowerCase()))
      && (!filters.minimumExperience || job.maximumExperience >= Number(filters.minimumExperience))
      && (!filters.maximumExperience || job.minimumExperience <= Number(filters.maximumExperience))
      && (!filters.minimumSalary || !hasSalary || (job.maximumSalary ?? 0) >= Number(filters.minimumSalary))
      && (!filters.maximumSalary || !hasSalary || (job.minimumSalary ?? 0) <= Number(filters.maximumSalary))
      && (!filters.location || job.location.toLowerCase().includes(filters.location.toLowerCase()))
      && (!filters.company || job.company === filters.company)
      && (!filters.postedWithin || job.postedDays <= Number(filters.postedWithin));
  });
  const visibleJobs = matchingJobs.filter((job) => view === "MATCHES" || saved.includes(job.id)).sort((left, right) => sort === "RECENT" ? left.postedDays - right.postedDays : sort === "SALARY" ? (right.maximumSalary ?? -1) - (left.maximumSalary ?? -1) : right.matchScore - left.matchScore);
  const locationOptions = Array.from(new Set(jobs.map((job) => job.location.split(" · ")[0]))).sort();
  const companyOptions = Array.from(new Set(jobs.map((job) => job.company))).sort();

  async function applyFor(job: CandidateJob) {
    setApplyingId(job.id); setError(""); setNotice("");
    try {
      await apiClient(`/api/candidate/jobs/${encodeURIComponent(job.id)}/applications`, { method: "POST", body: JSON.stringify({ coverLetter: null }) });
      setApplied((current) => current.includes(job.id) ? current : [...current, job.id]);
      setNotice(`Your application for ${job.role} at ${job.company} has been sent.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not send your application. Please try again."); }
    finally { setApplyingId(null); }
  }

  async function shareJob(job: CandidateJob) {
    let url = new URL(job.publicPath, window.location.origin).toString();
    let referralEnabled = false;
    setSharingId(job.id); setError(""); setNotice("");
    try {
      const referral = await apiClient<{ code: string; shareUrl: string; applicationsAttributed: number }>(`/api/candidate/jobs/${encodeURIComponent(job.id)}/referral`, { method: "POST" });
      url = new URL(referral.shareUrl, window.location.origin).toString();
      referralEnabled = true;
    } catch {
      // A regular public job link remains useful when referral attribution is
      // temporarily unavailable (for example, while an offline client comes
      // back online). The application still belongs to the posting recruiter.
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: `${job.role} at ${job.company}`, text: `Take a look at this role: ${job.role} at ${job.company}.`, url });
        setNotice(`The share sheet opened for ${job.role}.${referralEnabled ? " Applications from this link go directly to the posting recruiter and are tracked as your referral." : ""}`);
      } else {
        await navigator.clipboard.writeText(url);
        setNotice(`${referralEnabled ? "Referral link" : "Link"} copied. Applications from the shared ${job.role} link go directly to the posting recruiter.${referralEnabled ? " It is tracked as your referral." : ""}`);
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        setNotice(`${referralEnabled ? "Referral link" : "Link"} copied. Applications from the shared ${job.role} link go directly to the posting recruiter.${referralEnabled ? " It is tracked as your referral." : ""}`);
      } catch {
        setError("We could not open sharing or copy the job link. Please try again.");
      }
    } finally { setSharingId(null); }
  }

  return <WorkspaceShell workspace="candidate" active="jobs" title="Discover your next role" description="Search thoughtfully, compare opportunities, and act when a role feels right.">
    <main className="candidate-jobs-page">
      {notice && <div className="applied-banner" role="status">✓ {notice}</div>}
      {error && <p className="candidate-jobs-error" role="alert">{error}</p>}
      <section className="candidate-jobs-hero panel"><div><span className="eyebrow">Career discovery</span><h2>Roles that meet your ambition.</h2><p>Search the latest opportunities, save the promising ones, and apply with a clear view of the essentials.</p></div><div className="candidate-jobs-hero-actions"><Button href="/candidate/profile" variant="secondary">Improve my profile</Button><span>{saved.length} saved {saved.length === 1 ? "role" : "roles"}</span></div></section>

      <section className="candidate-job-search panel"><div className="candidate-filter-title"><div><span className="eyebrow">Search roles</span><h2>Make the search yours</h2><p>Use a keyword, then narrow by the factors that matter most.</p></div><Button onClick={() => setFilters(emptyFilters)} variant="quiet">Clear all</Button></div><div className="candidate-filter-grid"><FilterControl label="Job title, skill or company" value={filters.query} onChange={(value) => setFilter("query", value)} placeholder="e.g. TypeScript, Product, Nexora"/><SelectControl label="Minimum experience" value={filters.minimumExperience} onChange={(value) => setFilter("minimumExperience", value)} options={[["", "Any experience"], ["0", "0 years"], ["2", "2 years"], ["4", "4 years"], ["6", "6 years"]]}/><SelectControl label="Maximum experience" value={filters.maximumExperience} onChange={(value) => setFilter("maximumExperience", value)} options={[["", "Any experience"], ["3", "3 years"], ["5", "5 years"], ["7", "7 years"], ["10", "10+ years"]]}/><SelectControl label="Minimum salary" value={filters.minimumSalary} onChange={(value) => setFilter("minimumSalary", value)} options={[["", "Any salary"], ["8", "₹8 lacs"], ["15", "₹15 lacs"], ["25", "₹25 lacs"]]}/><SelectControl label="Location" value={filters.location} onChange={(value) => setFilter("location", value)} options={[["", "All locations"], ...locationOptions.map((location) => [location, location])]}/><SelectControl label="Posted" value={filters.postedWithin} onChange={(value) => setFilter("postedWithin", value)} options={[["", "Any time"], ["1", "Past 24 hours"], ["3", "Past 3 days"], ["7", "Past week"], ["30", "Past month"]]}/><SelectControl label="Company" value={filters.company} onChange={(value) => setFilter("company", value)} options={[["", "All companies"], ...companyOptions.map((company) => [company, company])]} /></div><div className="candidate-jobs-quick-filters"><span>Quick filters</span><button type="button" className={filters.location === "Remote" ? "selected" : ""} onClick={() => setFilter("location", filters.location === "Remote" ? "" : "Remote")}>Remote</button><button type="button" className={filters.postedWithin === "7" ? "selected" : ""} onClick={() => setFilter("postedWithin", filters.postedWithin === "7" ? "" : "7")}>Posted this week</button><button type="button" className={filters.minimumSalary === "15" ? "selected" : ""} onClick={() => setFilter("minimumSalary", filters.minimumSalary === "15" ? "" : "15")}>₹15L+</button></div></section>

      <section className="candidate-job-results"><header className="candidate-job-results-head"><div><span className="eyebrow">{view === "MATCHES" ? "Recommended for you" : "Your shortlist"}</span><h2>{visibleJobs.length} {visibleJobs.length === 1 ? "role" : "roles"} {view === "MATCHES" ? "to explore" : "saved for later"}</h2><p>{loadingJobs ? "Updating the live opportunity feed…" : view === "MATCHES" ? "Ordered using profile relevance, then your selected preferences." : "A private shortlist that stays with you while you decide."}</p></div><div className="candidate-job-result-controls"><div role="tablist" aria-label="Job view"><button type="button" role="tab" aria-selected={view === "MATCHES"} className={view === "MATCHES" ? "selected" : ""} onClick={() => setView("MATCHES")}>For you</button><button type="button" role="tab" aria-selected={view === "SAVED"} className={view === "SAVED" ? "selected" : ""} onClick={() => setView("SAVED")}>Saved ({saved.length})</button></div><label><span>Sort</span><select aria-label="Sort jobs" value={sort} onChange={(event) => setSort(event.target.value as JobSort)}><option value="RELEVANCE">Best match</option><option value="RECENT">Most recent</option><option value="SALARY">Highest salary</option></select></label></div></header>
        <div className="candidate-job-list">{visibleJobs.map((job) => <article className={`candidate-job-card${selectedJob === job.id ? " selected" : ""}`} key={job.id}><div className="candidate-job-card-top"><span className={`candidate-job-logo ${job.color}`}>{job.logo}</span><div className="candidate-job-card-title"><div><h3>{job.role}</h3><p>{job.company} · {job.department}</p></div><div className="candidate-job-card-actions"><button type="button" aria-label={`Share ${job.role}`} onClick={() => void shareJob(job)} className="candidate-job-share" disabled={sharingId === job.id}>{sharingId === job.id ? "Sharing…" : "↗ Share"}</button><button type="button" aria-label={`${saved.includes(job.id) ? "Remove" : "Save"} ${job.role}`} onClick={() => setSaved((current) => current.includes(job.id) ? current.filter((id) => id !== job.id) : [...current, job.id])} className={`candidate-job-save ${saved.includes(job.id) ? "saved" : ""}`}>{saved.includes(job.id) ? "♥ Saved" : "♡ Save"}</button></div></div></div><div className="candidate-job-match"><strong>{job.matchScore}% match</strong><span>Based on your profile and selected preferences</span></div><div className="candidate-job-tags">{job.skills.slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}</div><div className="candidate-job-meta"><span>{job.minimumExperience}–{job.maximumExperience} years</span><span>{job.location}</span><span>{job.type}</span><span>{salaryLabel(job)}</span><span>{postedLabel(job.postedDays)}</span></div>{selectedJob === job.id && <div className="candidate-job-expanded"><p>{job.description}</p><a href={job.publicPath}>Read full job description →</a></div>}<footer><button type="button" className="candidate-job-details" onClick={() => setSelectedJob(selectedJob === job.id ? null : job.id)}>{selectedJob === job.id ? "Hide details" : "View details"}</button>{applied.includes(job.id) ? <Badge tone="green">Applied</Badge> : <Button onClick={() => void applyFor(job)} disabled={applyingId === job.id}>{applyingId === job.id ? "Applying…" : "Quick apply"}</Button>}</footer></article>)}{visibleJobs.length === 0 && <div className="candidate-job-empty"><span>⌕</span><strong>{view === "SAVED" ? "No saved roles yet." : "No roles match those filters."}</strong><p>{view === "SAVED" ? "Save promising opportunities to revisit them here." : "Try clearing a filter or widening your search to find more opportunities."}</p><Button onClick={() => view === "SAVED" ? setView("MATCHES") : setFilters(emptyFilters)} variant="secondary">{view === "SAVED" ? "Explore roles" : "Reset filters"}</Button></div>}</div>
      </section>
    </main>
  </WorkspaceShell>;
}

function toCandidateJob(job: PublicJobPage["content"][number], index: number): CandidateJob { const publishedAt = job.publishedAt ? new Date(job.publishedAt) : null; const postedDays = publishedAt ? Math.max(0, Math.floor((Date.now() - publishedAt.getTime()) / 86_400_000)) : 0; const location = job.location || "Location flexible"; return { id: job.jobId, company: job.organisationName, role: job.title, department: job.department, skills: job.skills ?? [], location, type: location.toLowerCase().includes("remote") ? "Remote" : location.toLowerCase().includes("hybrid") ? "Hybrid" : "On-site", minimumExperience: job.minimumExperienceYears, maximumExperience: job.maximumExperienceYears, minimumSalary: job.salaryVisible ? job.minimumSalaryLakhs : null, maximumSalary: job.salaryVisible ? job.maximumSalaryLakhs : null, postedDays, logo: job.organisationName.slice(0, 1).toUpperCase(), color: ["", "blue", "orange", "purple", "green"][index % 5], matchScore: Math.max(62, 94 - (index * 4)), description: textFromHtml(job.descriptionHtml), publicPath: job.publicPath }; }
function salaryLabel(job: CandidateJob) { return job.minimumSalary !== null && job.maximumSalary !== null ? `₹${job.minimumSalary}–${job.maximumSalary} LPA` : "Salary not disclosed"; }
function postedLabel(days: number) { return days === 0 ? "Posted today" : days === 1 ? "Posted yesterday" : `Posted ${days}d ago`; }
function textFromHtml(value: string) { return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }
