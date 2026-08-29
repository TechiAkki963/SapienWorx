"use client";

import { useEffect, useMemo, useState } from "react";
import { apiBaseUrl, apiClient } from "../lib/api-client";
import { Badge, Button, SectionTitle, StatCard, WorkspaceShell } from "./ui";

type FunnelItem = { stage: string; count: number; percent: number };
type CandidateApplication = { id: string; jobId: string; title: string; organisation: string; stage: string; appliedAt: string; updatedAt: string };
type CandidateReport = {
  rangeDays: number; candidate: string; generatedAt: string;
  metrics: { profileViews: number; resumeDownloads: number; applications: number; interviews: number; offers: number; referralsShared: number; successfulReferrals: number; profileCompleteness: number; applicationToInterviewRate: number; interviewToOfferRate: number };
  funnel: FunnelItem[]; applicationTrend: { period: string; value: number }[]; engagementTrend: { period: string; views: number; downloads: number }[];
  recentApplications: CandidateApplication[]; insights: string[];
};
type RecruiterReport = {
  rangeDays: number; recruiter: string; organisation: string; generatedAt: string;
  metrics: { activeJobs: number; applications: number; interviews: number; offers: number; onboarded: number; candidateProfilesViewed: number; resumesDownloaded: number; outreachSent: number; outreachReplies: number; applicationToOfferRate: number; offerToHireRate: number; outreachReplyRate: number; averagePipelineUpdateHours: number };
  funnel: FunnelItem[]; applicationTrend: { period: string; applications: number; offers: number }[];
  jobPerformance: { jobId: string; title: string; status: string; publishedAt: string; applicants: number; offers: number; hires: number }[];
  campaigns: { id: string; name: string; status: string; recipients: number; delivered: number; replies: number; updatedAt: string }[];
  insights: string[];
};

const ranges = [7, 30, 90] as const;
const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
const formatDate = (value: string) => value ? new Date(value).toLocaleDateString() : "Not available";

function RangeControls({ range, setRange, onExport }: { range: number; setRange: (value: number) => void; onExport: () => void }) {
  return <div className="report-actions"><div className="report-range" role="group" aria-label="Report period">{ranges.map((value) => <button type="button" className={range === value ? "selected" : ""} key={value} onClick={() => setRange(value)}>{value} days</button>)}</div><Button variant="secondary" onClick={onExport}>Export CSV</Button></div>;
}

function Funnel({ items }: { items: FunnelItem[] }) {
  const maximum = Math.max(1, ...items.map((item) => item.count));
  return <div className="report-funnel">{items.map((item) => <div className="report-funnel-row" key={item.stage}><div><b>{pretty(item.stage)}</b><span>{item.count}</span></div><div className="report-track"><span style={{ width: `${Math.max(item.count ? 8 : 0, (item.count / maximum) * 100)}%` }} /></div><small>{item.percent}% of applications</small></div>)}</div>;
}

function Trend({ items, valueKey }: { items: Record<string, string | number>[]; valueKey: string }) {
  const maximum = Math.max(1, ...items.map((item) => Number(item[valueKey] ?? 0)));
  if (!items.length) return <div className="workflow-empty"><span>◔</span><p>Activity will appear here as the selected period collects data.</p></div>;
  return <div className="report-trend">{items.map((item) => <div key={String(item.period)}><span className="report-column" style={{ height: `${Math.max(8, Number(item[valueKey] ?? 0) / maximum * 100)}%` }} title={`${item.period}: ${item[valueKey]}`} /><small>{item.period}</small></div>)}</div>;
}

function Insights({ items }: { items: string[] }) {
  return <article className="panel report-insights"><SectionTitle eyebrow="Recommended actions" title="What to improve next" />{items.map((item) => <div key={item}><span>✓</span><p>{item}</p></div>)}</article>;
}

export function CandidateReports() {
  const [range, setRange] = useState(90);
  const [report, setReport] = useState<CandidateReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  useEffect(() => { let active = true; setLoading(true); setError(""); apiClient<CandidateReport>(`/api/candidate/reports?rangeDays=${range}`).then((value) => { if (active) setReport(value); }).catch((reason) => { if (active) { setReport(null); setError(reason instanceof Error ? reason.message : "The report could not be loaded."); } }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [range, reloadToken]);
  const applicationTrend = useMemo(() => report?.applicationTrend as Record<string, string | number>[] ?? [], [report]);
  return <WorkspaceShell workspace="candidate" active="reports" title="My reports" description="Understand profile visibility, application progress, and where to focus next." actions={<RangeControls range={range} setRange={setRange} onExport={() => window.open(`${apiBaseUrl}/api/candidate/reports/export.csv?rangeDays=${range}`, "_blank", "noopener,noreferrer")} />}><main className="workflow-page portal-report">{error && !loading && <section className="panel report-recovery" role="alert"><span aria-hidden="true">↻</span><div><h2>Your report is temporarily unavailable</h2><p>{error}</p><Button variant="secondary" onClick={() => setReloadToken((value) => value + 1)}>Try again</Button></div></section>}{loading && !report ? <p className="workflow-loading" role="status">Preparing your private report…</p> : report ? <><section className="stat-grid"><StatCard label="Profile views" value={String(report.metrics.profileViews)} tone="blue" icon="◉" /><StatCard label="Resume downloads" value={String(report.metrics.resumeDownloads)} tone="purple" icon="⇩" /><StatCard label="Applications" value={String(report.metrics.applications)} tone="amber" icon="▤" /><StatCard label="Offers" value={String(report.metrics.offers)} tone="green" icon="✓" /></section><section className="workflow-grid workflow-two"><article className="panel"><SectionTitle eyebrow={`${range}-day report`} title="Application funnel" /><Funnel items={report.funnel} /></article><article className="panel"><SectionTitle eyebrow="Momentum" title="Applications over time" /><Trend items={applicationTrend} valueKey="value" /></article></section><section className="report-kpi-strip"><article><span>Profile completeness</span><b>{report.metrics.profileCompleteness}%</b></article><article><span>Application → interview</span><b>{report.metrics.applicationToInterviewRate}%</b></article><article><span>Interview → offer</span><b>{report.metrics.interviewToOfferRate}%</b></article><article><span>Successful referrals</span><b>{report.metrics.successfulReferrals}/{report.metrics.referralsShared}</b></article></section><section className="workflow-grid workflow-two"><article className="panel workflow-list report-table"><SectionTitle eyebrow="Hiring journey" title="Recent applications" />{report.recentApplications.map((item) => <article key={item.id}><div><b>{item.title}</b><p>{item.organisation} · applied {formatDate(item.appliedAt)}</p></div><Badge tone={item.stage === "OFFER" || item.stage === "ONBOARDED" ? "green" : item.stage === "REJECTED" ? "rose" : "blue"}>{pretty(item.stage)}</Badge></article>)}{!report.recentApplications.length && <div className="workflow-empty"><span>▤</span><p>Your applications will appear here.</p></div>}</article><Insights items={report.insights} /></section></> : null}</main></WorkspaceShell>;
}

export function RecruiterReports() {
  const [range, setRange] = useState(90);
  const [report, setReport] = useState<RecruiterReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  useEffect(() => { let active = true; setLoading(true); setError(""); apiClient<RecruiterReport>(`/api/recruiter/reports?rangeDays=${range}`).then((value) => { if (active) setReport(value); }).catch((reason) => { if (active) { setReport(null); setError(reason instanceof Error ? reason.message : "The report could not be loaded."); } }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [range, reloadToken]);
  const trend = useMemo(() => report?.applicationTrend as Record<string, string | number>[] ?? [], [report]);
  return <WorkspaceShell workspace="recruiter" active="reports" title="Hiring reports" description="Job, pipeline, sourcing, and outreach performance for your owned hiring work." actions={<RangeControls range={range} setRange={setRange} onExport={() => window.open(`${apiBaseUrl}/api/recruiter/reports/export.csv?rangeDays=${range}`, "_blank", "noopener,noreferrer")} />}><main className="workflow-page portal-report">{error && !loading && <section className="panel report-recovery" role="alert"><span aria-hidden="true">↻</span><div><h2>Hiring analytics are temporarily unavailable</h2><p>{error}</p><Button variant="secondary" onClick={() => setReloadToken((value) => value + 1)}>Try again</Button></div></section>}{loading && !report ? <p className="workflow-loading" role="status">Preparing recruiter analytics…</p> : report ? <><section className="stat-grid"><StatCard label="Active jobs" value={String(report.metrics.activeJobs)} tone="blue" icon="▤" /><StatCard label="Applications" value={String(report.metrics.applications)} tone="purple" icon="♙" /><StatCard label="Interviews" value={String(report.metrics.interviews)} tone="amber" icon="◷" /><StatCard label="Hires" value={String(report.metrics.onboarded)} tone="green" icon="✓" /></section><section className="workflow-grid workflow-two"><article className="panel"><SectionTitle eyebrow={`${range}-day report`} title="Hiring funnel" /><Funnel items={report.funnel} /></article><article className="panel"><SectionTitle eyebrow="Candidate flow" title="Applications over time" /><Trend items={trend} valueKey="applications" /></article></section><section className="report-kpi-strip"><article><span>Application → offer</span><b>{report.metrics.applicationToOfferRate}%</b></article><article><span>Offer → hire</span><b>{report.metrics.offerToHireRate}%</b></article><article><span>Outreach reply rate</span><b>{report.metrics.outreachReplyRate}%</b></article><article><span>Average pipeline update</span><b>{report.metrics.averagePipelineUpdateHours}h</b></article></section><section className="workflow-grid workflow-two"><article className="panel workflow-list report-table"><SectionTitle eyebrow="Job performance" title="Role-level conversion" />{report.jobPerformance.map((job) => <article key={job.jobId}><div><b>{job.title}</b><p>{job.jobId} · {job.applicants} applicants · {job.offers} offers · {job.hires} hires</p></div><Badge tone={job.status === "ACTIVE" ? "green" : "neutral"}>{pretty(job.status)}</Badge></article>)}{!report.jobPerformance.length && <div className="workflow-empty"><span>▤</span><p>Post a job to start role-level reporting.</p></div>}</article><Insights items={report.insights} /></section><section className="panel workflow-list report-table"><SectionTitle eyebrow="Outreach performance" title="Campaign delivery and replies" />{report.campaigns.map((campaign) => <article key={campaign.id}><div><b>{campaign.name}</b><p>{campaign.recipients} recipients · {campaign.delivered} delivered · {campaign.replies} replies</p></div><Badge tone={campaign.status === "COMPLETED" ? "green" : "blue"}>{pretty(campaign.status)}</Badge></article>)}{!report.campaigns.length && <div className="workflow-empty"><span>✉</span><p>Campaign performance will appear after outreach begins.</p></div>}</section></> : null}</main></WorkspaceShell>;
}
