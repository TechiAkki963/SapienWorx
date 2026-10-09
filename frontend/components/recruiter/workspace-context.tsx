"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {NavigationIcon,type NavigationIconName} from "./navigation-icon";

const tools = [
  ["Overview", "/recruiter/talent"], ["Discover", "/recruiter/discover"],
  ["Pools", "/recruiter/talent-pool"], ["Saved searches", "/recruiter/saved-searches"],
  ["Outreach", "/recruiter/outreach"], ["Insights", "/recruiter/talent/insights"],
] as const;
const icons:NavigationIconName[]=["overview","discover","pools","saved","outreach","insights"];
export function RecruiterWorkspaceContext() {
  const path = usePathname();
  if (!tools.some(([, href]) => href === path || href !== "/recruiter/talent" && path.startsWith(href))) return null;
  return <div className="swx-talent-tabs-container mb-5 border-b border-line pb-3"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-[13px] font-semibold text-ink-muted">SapienWorx Talent · Source & engage</p><Link href="/recruiter/pipeline" className="min-h-11 content-center text-[13px] font-semibold text-indigo">Back to Recruit</Link></div><nav aria-label="Talent workspace" className="swx-talent-tabs">{tools.map(([name, href],index) => <Link key={href} href={href} title={name} aria-label={name} aria-current={path === href ? "page" : undefined} className={`swx-talent-tab ${path === href ? "swx-talent-tab-active" : ""}`}><NavigationIcon name={icons[index]}/><span className="swx-talent-label-full">{name}</span><span aria-hidden="true" className="swx-talent-label-short">{name==="Saved searches"?"Saved":name}</span></Link>)}</nav><p aria-hidden="true" className="swx-talent-selected-name">{tools.find(([,href])=>href===path)?.[0]}</p></div>;
}
