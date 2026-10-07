"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tools = [
  ["Overview", "/recruiter/talent"], ["Discover", "/recruiter/discover"],
  ["Pools", "/recruiter/talent-pool"], ["Saved searches", "/recruiter/saved-searches"],
  ["Outreach", "/recruiter/outreach"], ["Insights", "/recruiter/talent/insights"],
] as const;
export function RecruiterWorkspaceContext() {
  const path = usePathname();
  if (!tools.some(([, href]) => href === path || href !== "/recruiter/talent" && path.startsWith(href))) return null;
  return <div className="mb-5 border-b border-line pb-3"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-ink-muted">SapienWorx Talent · Source & engage</p><Link href="/recruiter/pipeline" className="min-h-11 content-center text-xs font-semibold text-indigo">Back to Recruit</Link></div><nav aria-label="Talent workspace" className="flex flex-wrap gap-1">{tools.map(([name, href]) => <Link key={href} href={href} aria-current={path === href ? "page" : undefined} className={`min-h-11 rounded-lg px-3 py-3 text-sm font-semibold ${path === href ? "bg-indigo-soft text-indigo" : "text-ink-muted hover:bg-slate-50"}`}>{name}</Link>)}</nav></div>;
}
