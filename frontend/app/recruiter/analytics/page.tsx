import { RecruiterProductHeader } from "@/components/recruiter/recruiter-product-header";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic="force-dynamic";
type Analytics={active_jobs:number;applications:number;shortlisted:number;interviews:number;offers:number;hires:number;placement_rate:number;source_performance:Array<{source:string;applications:number;hires:number;conversion:number}>;monthly_trend:Array<{month:string;applications:number;hires:number}>};

export default async function RecruiterAnalyticsPage(){
 await requireRole("recruiter");
 const a=await recruiterAPI<Analytics>("/api/v1/recruiter/analytics");
 const cards=[["Active jobs",a.active_jobs],["Applications",a.applications],["Shortlisted+",a.shortlisted],["Interviews+",a.interviews],["Offers+",a.offers],["Hires",a.hires]];
 const maxTrend=Math.max(1,...a.monthly_trend.map(x=>x.applications));
 return <RecruiterShell><div className="grid gap-5 pb-24">
  <RecruiterProductHeader eyebrow="Recruiting intelligence" title="Analytics" description="Company-scoped funnel, source and hiring trend visibility across recruiter workflows." />
  <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{cards.map(([label,value])=><div key={String(label)} className="rounded-2xl border border-line/70 bg-white p-4 shadow-sm"><p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-ink-muted">{label}</p><p className="mt-2 text-2xl font-black text-navy">{value}</p></div>)}</section>
  <section className="grid gap-5 xl:grid-cols-[1fr_.9fr]">
   <div className="rounded-2xl border border-line/70 bg-white p-5 shadow-sm"><div className="flex items-end justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-indigo">6-month trend</p><h2 className="mt-1 text-lg font-bold text-navy">Applications & hires</h2></div><span className="text-xs font-bold text-emerald-700">{a.placement_rate.toFixed(1)}% placement rate</span></div><div className="mt-5 grid h-64 grid-cols-6 items-end gap-3" aria-label="Monthly application trend">{a.monthly_trend.map(x=><div key={x.month} className="grid h-full items-end gap-2"><div className="relative flex h-full items-end rounded-lg bg-slate-50"><div title={x.applications+" applications"} className="w-full rounded-lg bg-indigo/80" style={{height:Math.max(6,(x.applications/maxTrend)*100)+"%"}}/></div><p className="text-center text-[10px] font-bold text-ink-muted">{x.month.slice(5)}</p></div>)}</div></div>
   <div className="rounded-2xl border border-line/70 bg-white p-5 shadow-sm"><p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-indigo">Source performance</p><h2 className="mt-1 text-lg font-bold text-navy">Where hires come from</h2><div className="mt-4 grid gap-3">{a.source_performance.length?a.source_performance.map(x=><div key={x.source} className="rounded-xl border border-line/60 p-3"><div className="flex items-center justify-between gap-3"><p className="font-bold capitalize text-navy">{x.source}</p><p className="text-xs font-bold text-emerald-700">{x.conversion.toFixed(1)}% hire conversion</p></div><p className="mt-1 text-xs text-ink-muted">{x.applications} applications · {x.hires} hires</p></div>):<p className="text-sm text-ink-muted">No source data yet.</p>}</div></div>
  </section>
 </div></RecruiterShell>
}
