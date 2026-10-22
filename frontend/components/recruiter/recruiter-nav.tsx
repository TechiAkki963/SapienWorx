"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LogoutButton } from "@/components/auth/logout-button";
import { apiRequest } from "@/lib/api";
import type { ThreadListResponse } from "@/lib/messaging";
import { RecruiterModal } from "./workspace-ui";
import { NavigationIcon, type NavigationIconName } from "./navigation-icon";
import { RecruiterBrand } from "./recruiter-brand";
import { useRecruiterProfile } from "./profile-context";

export type RecruiterNavigationAccess = { member:{role:string;talent_seat?:boolean;status?:string}; entitlements:{features:Record<string,boolean>;state:string;managed?:boolean} };
type Item={label:string;href:string;icon:NavigationIconName;premium?:boolean};
const sections:{title:string;items:Item[]}[]=[
 {title:"Workspace",items:[
  {label:"Home",href:"/recruiter",icon:"overview"},
  {label:"Jobs",href:"/recruiter/jobs",icon:"jobs"},
  {label:"Applications",href:"/recruiter/pipeline",icon:"applications"},
  {label:"Messages",href:"/recruiter/messages",icon:"messages"},
  {label:"Interviews",href:"/recruiter/interviews",icon:"interviews"},
  {label:"Referrals",href:"/recruiter/referrals",icon:"referrals"},
 ]},
 {title:"Recruit Plus+",items:[
  {label:"Talent",href:"/recruiter/talent",icon:"talent",premium:true},
  {label:"Offers",href:"/recruiter/offers",icon:"offers",premium:true},
  {label:"Analytics",href:"/recruiter/analytics",icon:"insights",premium:true},
 ]},
];
const talentTools:Item[]=[
 {label:"Discover Talent",href:"/recruiter/discover",icon:"discover"},
 {label:"Talent Pools",href:"/recruiter/talent-pool",icon:"pools"},
 {label:"Saved Searches",href:"/recruiter/saved-searches",icon:"saved"},
 {label:"Outreach",href:"/recruiter/outreach",icon:"outreach"},
];
const items=sections.flatMap(s=>s.items);
const primary=["/recruiter","/recruiter/pipeline","/recruiter/jobs","/recruiter/messages"].map(href=>items.find(i=>i.href===href)!);

function initials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase()||"R";}

export function RecruiterNav({unreadCount=0,collapsed=false,onToggle,access,recruiterName,companyName,profileImageUrl}:{unreadCount?:number;collapsed?:boolean;onToggle:()=>void;access:RecruiterNavigationAccess|null;recruiterName:string;companyName:string;profileImageUrl?:string}) {
 const path=usePathname(),params=useSearchParams();
 const {setOpen:setProfileOpen}=useRecruiterProfile();
 const jobContext=Boolean(params.get("job_id"))&&(path==="/recruiter/interviews"||path.startsWith("/recruiter/offers"));
 const [unread,setUnread]=useState(unreadCount),[moreOpen,setMoreOpen]=useState(false),[locked,setLocked]=useState("");
 const [toggleTooltip,setToggleTooltip]=useState(false);
 const [toggleReady,setToggleReady]=useState(false);
 const [navigationTooltip,setNavigationTooltip]=useState<{href:string;label:string;left:number;top:number}|null>(null);
 useEffect(()=>setToggleReady(true),[]);
 useEffect(()=>{const hide=()=>{setNavigationTooltip(null);setToggleTooltip(false)};window.addEventListener("resize",hide);return()=>window.removeEventListener("resize",hide)},[]);
 useEffect(()=>setUnread(unreadCount),[unreadCount]);
 useEffect(()=>{setMoreOpen(false);setLocked("");setNavigationTooltip(null)},[path]);
 useEffect(()=>{
  let active=true;
  const refresh=async()=>{if(document.visibilityState!=="visible")return;try{const r=await apiRequest<ThreadListResponse>("/api/v1/messaging/threads");if(active)setUnread((r.items??[]).reduce((n,t)=>n+t.unread_count,0))}catch{/* Retain the last confirmed count. */}};
  const change=(e:Event)=>{const n=(e as CustomEvent<number>).detail;if(typeof n==="number")setUnread(v=>Math.max(0,v+n))};
  const timer=window.setInterval(refresh,30000);
  window.addEventListener("sapienworx:unread-change",change);document.addEventListener("visibilitychange",refresh);
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener("sapienworx:unread-change",change);document.removeEventListener("visibilitychange",refresh)};
 },[]);
 function current(href:string){
  if(jobContext)return href==="/recruiter/jobs";
  if(href==="/recruiter/talent")return ["/recruiter/talent","/recruiter/discover","/recruiter/saved-searches","/recruiter/outreach"].some(p=>path.startsWith(p));
  if(href==="/recruiter/pipeline")return path.startsWith(href)||path.startsWith("/recruiter/candidates/");
  return href==="/recruiter"?path===href:path===href||path.startsWith(href+"/");
 }
 function lockReason(item:Item){
  if(!item.premium)return "";
  if(!access)return "Your workspace access could not be verified. Try again when the connection returns.";
  if(access.member.status&&access.member.status!=="active")return "Your company workspace access is inactive. Ask your Company Admin to review your membership.";
  if(access.member.role==="collaborator")return "Your company role does not permit this workspace. Ask your Company Admin to review your permissions.";
  if(item.label==="Talent"){
   if(!access.entitlements.features["talent.discovery"])return "Your company subscription does not include active Talent access. Existing applicants and conversations remain available.";
   if(!access.member.talent_seat&&access.member.role!=="legacy_recruiter")return "Your company has Talent access, but a Talent seat has not been assigned to you. Ask your Company Admin.";
  }
  return "";
 }
 function profile(){setMoreOpen(false);setProfileOpen(true)}
 function entry(item:Item,mobile=false){
  const active=current(item.href),reason=lockReason(item);
  const cls=`swx-sidebar-item ${active?(item.premium?"swx-sidebar-premium-active":"swx-sidebar-active"):""}`;
  const showTooltip=(element:HTMLElement)=>{if(!collapsed||mobile)return;const rect=element.getBoundingClientRect();setNavigationTooltip({href:item.href,label:item.label,left:rect.right+16,top:rect.top+rect.height/2})};
  const tooltipEvents={onMouseEnter:(event:React.MouseEvent<HTMLElement>)=>showTooltip(event.currentTarget),onMouseLeave:()=>setNavigationTooltip(null),onFocus:(event:React.FocusEvent<HTMLElement>)=>showTooltip(event.currentTarget),onBlur:()=>setNavigationTooltip(null),onKeyDown:(event:React.KeyboardEvent<HTMLElement>)=>{if(event.key==="Escape")setNavigationTooltip(null)},"aria-describedby":navigationTooltip?.href===item.href?"recruiter-navigation-tooltip":undefined};
  const content=<><NavigationIcon name={item.icon}/><span className={collapsed&&!mobile?"sr-only":"swx-sidebar-label"}>{item.label}</span>{item.icon==="messages"&&unread>0&&<span aria-label={unread+" unread messages"} className="swx-sidebar-count">{Math.min(unread,99)}</span>}{reason&&<span aria-label="Access restricted" className="swx-sidebar-restriction ml-auto text-xs">⌑</span>}</>;
  if(reason)return <button key={item.href} {...tooltipEvents} type="button" className={cls} aria-label={item.label+" — access information"} onClick={()=>{setNavigationTooltip(null);setMoreOpen(false);setLocked(reason)}}>{content}</button>;
  return <Link key={item.href} {...tooltipEvents} href={item.href} prefetch={false} className={cls} aria-label={item.label} aria-current={active?"page":undefined} onClick={()=>setNavigationTooltip(null)}>{content}</Link>;
 }
 const avatar=<span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-xs font-bold text-white">{profileImageUrl?<Image src={profileImageUrl} alt="" fill sizes="36px" unoptimized className="object-cover"/>:<span aria-hidden="true">{initials(recruiterName)}</span>}</span>;
 return <>
  <div id="recruiter-desktop-nav" className="swx-recruiter-nav swx-navy-sidebar hidden lg:grid">
   <Link href="/recruiter" prefetch={false} aria-label="SapienWorx recruiter home" className="swx-sidebar-brand-link"><RecruiterBrand collapsed={collapsed}/></Link>
   <button type="button" disabled={!toggleReady} onClick={()=>{setToggleTooltip(false);setNavigationTooltip(null);onToggle()}} onMouseEnter={()=>setToggleTooltip(true)} onMouseLeave={()=>setToggleTooltip(false)} onFocus={()=>setToggleTooltip(true)} onBlur={()=>setToggleTooltip(false)} onKeyDown={event=>{if(event.key==="Escape")setToggleTooltip(false)}} aria-label={collapsed?"Expand sidebar":"Collapse sidebar"} aria-expanded={!collapsed} aria-controls="recruiter-desktop-nav" aria-describedby={toggleTooltip?"recruiter-sidebar-toggle-tooltip":undefined} className="swx-sidebar-toggle">
    <svg aria-hidden="true" className="h-[18px] w-[18px] fill-none stroke-current stroke-2" viewBox="0 0 24 24"><path d={collapsed?"m9 6 6 6-6 6":"m15 6-6 6 6 6"}/></svg>
    {toggleTooltip&&<span id="recruiter-sidebar-toggle-tooltip" role="tooltip" className="swx-sidebar-tooltip swx-sidebar-toggle-tooltip">{collapsed?"Expand sidebar":"Collapse sidebar"}</span>}
   </button>
   <div className="swx-sidebar-sections" onScroll={()=>setNavigationTooltip(null)}>{sections.map(section=><section key={section.title}><h2 className={collapsed?"sr-only":"swx-sidebar-heading"}>{section.title}{section.title==="Recruit Plus+"&&<svg aria-hidden="true" viewBox="0 0 24 24" className="ml-2 inline-block h-4 w-4 fill-none stroke-current stroke-[1.6]"><path d="m3 7 4 4 5-7 5 7 4-4-2 12H5Z"/><path d="M6 16h12"/></svg>}</h2><nav aria-label={section.title} className="grid gap-1">{section.items.map(i=>entry(i))}</nav></section>)}</div>
   <div className={`mt-auto border-t border-white/15 px-2 pb-3 pt-3 ${collapsed?"flex justify-center":""}`}>
    <details className="group relative w-full">
     <summary aria-label={`Account menu for ${recruiterName}`} title={collapsed?`${recruiterName} — Account`:undefined} className={`flex min-h-12 w-full cursor-pointer list-none items-center rounded-xl text-left text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${collapsed?"justify-center px-1":"gap-3 px-2"}`}>
      {avatar}
      {!collapsed&&<span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{recruiterName}</span><span className="mt-0.5 block truncate text-xs text-white/65">{companyName}</span></span>}
      {!collapsed&&<svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3 shrink-0 fill-none stroke-current stroke-[1.7] text-white/70 transition group-open:-rotate-90"><path d="m6 4 4 4-4 4"/></svg>}
     </summary>
     <div className={`absolute bottom-[calc(100%+0.5rem)] z-50 w-60 rounded-xl border border-line bg-white p-2 text-ink shadow-[0_16px_44px_rgba(16,33,63,0.18)] ${collapsed?"left-[calc(100%+0.5rem)]":"left-0"}`}>
      <div className="border-b border-line/70 px-2.5 py-2"><p className="truncate text-sm font-bold text-ink">{recruiterName}</p><p className="mt-0.5 truncate text-xs text-ink-muted">{companyName}</p></div>
      <button type="button" onClick={event=>{event.currentTarget.closest("details")?.removeAttribute("open");profile()}} className="mt-1 flex min-h-11 w-full items-center rounded-lg px-2.5 text-left text-sm font-semibold text-ink-muted hover:bg-slate-50 hover:text-ink">View profile</button>
      <Link href="/recruiter/settings" className="flex min-h-11 items-center rounded-lg px-2.5 text-sm font-semibold text-ink-muted hover:bg-slate-50 hover:text-ink">Settings & preferences</Link>
      {access?.member.role==="primary_admin"&&<Link href="/company" className="flex min-h-11 items-center rounded-lg px-2.5 text-sm font-semibold text-indigo hover:bg-indigo-soft">Company administration</Link>}
      <Link href="/" className="flex min-h-11 items-center rounded-lg px-2.5 text-sm font-semibold text-ink-muted hover:bg-slate-50 hover:text-ink">View public site</Link>
      <div className="mt-1 border-t border-line/70 pt-1"><LogoutButton /></div>
     </div>
    </details>
   </div>
  </div>
  {navigationTooltip&&createPortal(<span id="recruiter-navigation-tooltip" role="tooltip" className="swx-sidebar-floating-tooltip" style={{left:navigationTooltip.left,top:navigationTooltip.top}}>{navigationTooltip.label}</span>,document.body)}
  <RecruiterModal open={moreOpen} onClose={()=>setMoreOpen(false)} title="More recruiter tools" size="small">
   <div id="recruiter-more-menu" data-testid="recruiter-more-menu" className="swx-navy-sidebar"><RecruiterBrand/>{sections.map(section=><section key={section.title}><h2 className="swx-sidebar-heading">{section.title}{section.title==="Recruit Plus+"&&<svg aria-hidden="true" viewBox="0 0 24 24" className="ml-2 inline-block h-4 w-4 fill-none stroke-current stroke-[1.6]"><path d="m3 7 4 4 5-7 5 7 4-4-2 12H5Z"/><path d="M6 16h12"/></svg>}</h2><nav aria-label={section.title+" mobile"}>{section.items.filter(i=>!primary.includes(i)).map(i=>entry(i,true))}</nav></section>)}<nav aria-label="Talent tools">{talentTools.map(i=>entry(i,true))}</nav><div className="mt-3 border-t border-white/15 pt-3"><button type="button" onClick={profile} className="swx-sidebar-item w-full" aria-label="My recruiter profile"><span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-[10px] font-bold">{initials(recruiterName)}</span><span className="swx-sidebar-label">My profile</span></button><Link href="/recruiter/settings" className="swx-sidebar-item"><NavigationIcon name="settings"/><span className="swx-sidebar-label">Settings</span></Link>{access?.member.role==="primary_admin"&&<Link href="/company" className="swx-sidebar-item"><NavigationIcon name="company"/><span className="swx-sidebar-label">Company administration</span></Link>}<div className="px-2 pt-2"><LogoutButton /></div></div></div>
  </RecruiterModal>
  <RecruiterModal open={Boolean(locked)} onClose={()=>setLocked("")} title="Workspace access" size="small"><p className="text-sm leading-7 text-ink">{locked}</p>{access?.member.role==="primary_admin"&&<Link href="/company/plan" className="mt-4 inline-flex min-h-11 items-center font-semibold text-indigo">Review company plan & permissions</Link>}</RecruiterModal>
  <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 lg:hidden" data-testid="recruiter-bottom-nav"><nav aria-label="Recruiter mobile navigation" className="mx-auto grid max-w-2xl grid-cols-5">{primary.map(item=><Link key={item.href} href={item.href} prefetch={false} aria-label={item.label} aria-current={current(item.href)?"page":undefined} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg text-[12px] font-semibold ${current(item.href)?"text-indigo":"text-ink-muted"}`}><NavigationIcon name={item.icon}/><span>{item.label==="Applications"?"Apps":item.label}</span></Link>)}<button type="button" disabled={!toggleReady} aria-expanded={moreOpen} aria-controls="recruiter-more-menu" onClick={()=>setMoreOpen(true)} className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-semibold text-ink-muted"><span aria-hidden="true" className="text-xl leading-5">⋯</span>More</button></nav></div>
 </>;
}
