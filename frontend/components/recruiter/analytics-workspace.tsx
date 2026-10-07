"use client";

import Link from "next/link";
import { RecruiterDataTable, WorkspaceState, recruiterSecondary } from "./workspace-ui";

export type RecruiterAnalyticsData = {
  active_jobs: number; applications: number; shortlisted: number; interviews: number;
  offers: number; hires: number; placement_rate: number;
  source_performance: Array<{ source: string; applications: number; hires: number; conversion: number }>;
  monthly_trend: Array<{ month: string; applications: number; hires: number }>;
};

const stages = (values: string[]) => "/recruiter/pipeline?" + new URLSearchParams(values.map(value => ["stage", value]));
const csvCell = (value: string | number) => {
  const text = String(value);
  return '"' + (/^[=+@-]/.test(text) ? "'" : "") + text.replaceAll('"', '""') + '"';
};

export function AnalyticsWorkspace({ data }: { data: RecruiterAnalyticsData }) {
  const cards: Array<[string, number, string]> = [
    ["Active jobs", data.active_jobs, "/recruiter/jobs?status=active"],
    ["Applications", data.applications, "/recruiter/pipeline"],
    ["Shortlisted+", data.shortlisted, stages(["shortlisted", "technical_interview", "hr_round", "final_interview", "offer", "hired"])],
    ["Interviews+", data.interviews, stages(["technical_interview", "hr_round", "final_interview", "offer", "hired"])],
    ["Offers+", data.offers, stages(["offer", "hired"])],
    ["Hires", data.hires, stages(["hired"])],
  ];
  const max = Math.max(1, ...data.monthly_trend.map(item => item.applications));
  function download() {
    const rows = [["Source", "Applications", "Hires", "Hire conversion (%)"], ...data.source_performance.map(item => [item.source, item.applications, item.hires, item.conversion.toFixed(1)]), [], ["Application cohort month", "Applications", "Currently hired"], ...data.monthly_trend.map(item => [item.month, item.applications, item.hires])];
    const url = URL.createObjectURL(new Blob([rows.map(row => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "sapienworx-recruiter-analytics.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="grid min-w-0 gap-6">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3"><p className="text-sm text-ink-muted">Company application cohorts · {data.placement_rate.toFixed(1)}% currently hired</p><button onClick={download} className={recruiterSecondary}>Export aggregate CSV</button></div>
    <section aria-label="Hiring funnel" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{cards.map(([name, value, href]) => <Link key={name} href={href} className="swx-workspace-surface rounded-xl border border-line p-4"><p className="text-xs text-ink-muted">{name}</p><p className="mt-2 text-2xl font-semibold text-navy">{value}</p><span className="mt-2 block text-xs text-indigo">View records →</span></Link>)}</section>
    <section aria-labelledby="analytics-trend-title"><h2 id="analytics-trend-title" className="text-lg font-semibold text-navy">Applications & hires</h2><p className="mt-1 text-xs leading-6 text-ink-muted">Last six application months. Hires show the current status of each application cohort.</p><div aria-hidden="true" className="mt-4 flex h-40 items-end gap-3 rounded-xl border border-line p-4">{data.monthly_trend.map(item => <div key={item.month} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2"><div className="rounded-t bg-indigo/80" style={{ height: `${Math.max(1, item.applications / max * 100)}%` }} /><p className="text-center text-xs text-ink-muted">{item.month.slice(5)}</p></div>)}</div><div className="mt-4"><RecruiterDataTable label="Monthly application trend" rows={data.monthly_trend} rowKey={item => item.month} columns={[{ key: "month", title: "Month", render: item => item.month }, { key: "applications", title: "Applications", render: item => item.applications }, { key: "hires", title: "Currently hired", render: item => item.hires }]} mobileRow={item => <p className="text-sm text-ink">{item.month} · {item.applications} applications · {item.hires} currently hired</p>} /></div></section>
    <section aria-labelledby="analytics-source-title"><h2 id="analytics-source-title" className="mb-3 text-lg font-semibold text-navy">Source performance</h2>{data.source_performance.length ? <RecruiterDataTable label="Candidate source performance" rows={data.source_performance} rowKey={item => item.source} columns={[{ key: "source", title: "Source", render: item => <Link href={`/recruiter/pipeline?source=${encodeURIComponent(item.source)}`} className="min-h-11 content-center capitalize text-indigo">{item.source}</Link> }, { key: "applications", title: "Applications", render: item => item.applications }, { key: "hires", title: "Hires", render: item => item.hires }, { key: "conversion", title: "Hire conversion", render: item => `${item.conversion.toFixed(1)}%` }]} mobileRow={item => <div><p className="font-semibold capitalize text-navy">{item.source}</p><p className="mt-2 text-xs text-ink-muted">{item.applications} applications · {item.hires} hires · {item.conversion.toFixed(1)}% conversion</p></div>} /> : <WorkspaceState title="No source data yet" description="Source metrics will appear after applications are received." />}</section>
  </div>;
}
