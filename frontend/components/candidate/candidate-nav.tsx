"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useCandidateWorkspace } from "./candidate-workspace-state";
const career = [
  { label: "Home", href: "/candidate", icon: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z" },
  { label: "Jobs", href: "/candidate/jobs", icon: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M15 15l6 6" },
  { label: "Applications", href: "/candidate/applications", icon: "M5 4h14v17H5ZM9 4V2h6v2M8 9h8M8 13h8M8 17h5" },
  { label: "Messages", href: "/candidate/messages", icon: "M3 5h18v14H3ZM3 6l9 7 9-7" },
  { label: "Saved", href: "/candidate/saved", icon: "M6 3h12v18l-6-4-6 4Z" },
];
const grow = [
  { label: "Companies", href: "/companies", icon: "M3 21V7l9-4 9 4v14M8 21v-6h8v6M7 8h2M15 8h2M7 11h2M15 11h2" },
  { label: "Career Hub", href: "/candidate/career-hub", icon: "M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3ZM12 6v16" },
];
export function candidateNavigationActive(pathname: string, href: string) {
  if (href === "/candidate") return pathname === href;
  if (href === "/candidate/jobs") return pathname === "/jobs" || pathname.startsWith("/jobs/") || pathname.startsWith(href);
  if (href === "/candidate/messages") return pathname.startsWith(href) || pathname.startsWith("/candidate/inbox");
  if (href === "/candidate/career-hub") return pathname.startsWith(href) || pathname === "/resources" || pathname.startsWith("/resources/");
  return pathname === href || pathname.startsWith(href + "/");
}
export function CandidateNav({ mobile = false, collapsed = false }: { mobile?: boolean; collapsed?: boolean }) {
  const pathname = usePathname();
  const tooltipID=useId();
  const [tooltip,setTooltip]=useState<{label:string;top:number}|null>(null);
  useEffect(()=>{setTooltip(null)},[pathname,collapsed]);
  useEffect(()=>{const clear=()=>setTooltip(null);const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")clear()};window.addEventListener("resize",clear);window.addEventListener("scroll",clear,true);document.addEventListener("keydown",escape);return()=>{window.removeEventListener("resize",clear);window.removeEventListener("scroll",clear,true);document.removeEventListener("keydown",escape)}},[]);
  const show=(anchor:HTMLElement,label:string)=>{if(collapsed&&!mobile)setTooltip({label,top:anchor.getBoundingClientRect().top+22})};
  const { messageUnreadCount } = useCandidateWorkspace();
  const groups = mobile ? [["Career", career] as const] : [["Career", career], ["Grow", grow]] as const;
  return <><nav id={mobile ? undefined : "candidate-workspace-navigation"} className={mobile ? "candidate-mobile-nav" : "candidate-sidebar-nav"} aria-label={mobile ? "Candidate mobile navigation" : "Candidate workspace"}>
    {groups.map(([section, items]) => <div key={section} className={mobile ? "candidate-mobile-items" : "candidate-navigation-section"}>
      {!mobile && <h2 className={collapsed ? "sr-only" : "candidate-navigation-heading"}>{section}</h2>}
      {items.map(item => <Link key={item.href} href={item.href} prefetch={false} onMouseEnter={event=>show(event.currentTarget,item.label)} onFocus={event=>show(event.currentTarget,item.label)} onMouseLeave={()=>setTooltip(null)} onBlur={()=>setTooltip(null)} aria-describedby={tooltip?.label===item.label?tooltipID:undefined} aria-label={item.label === "Messages" && messageUnreadCount > 0 ? "Messages, " + messageUnreadCount + " unread" : item.label} aria-current={candidateNavigationActive(pathname,item.href) ? "page" : undefined} className="candidate-navigation-link">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.icon}/></svg>
        <span className={collapsed && !mobile ? "sr-only" : "candidate-navigation-label"}>{item.label}</span>
        {item.label === "Messages" && messageUnreadCount > 0 && <span className="candidate-message-badge" aria-hidden="true">{messageUnreadCount > 99 ? "99+" : messageUnreadCount}</span>}
      </Link>)}
    </div>)}
  </nav>{tooltip&&createPortal(<span role="tooltip" id={tooltipID} className="candidate-navigation-tooltip" style={{top:tooltip.top}}>{tooltip.label}</span>,document.body)}</>;
}
