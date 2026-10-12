"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { ThreadListResponse } from "@/lib/messaging";
import { RecruiterModal } from "./workspace-ui";
import { NavigationIcon, type NavigationIconName } from "./navigation-icon";

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
 {title:"Profile",items:[{label:"My profile",href:"#my-profile",icon:"candidates"},{label:"Preferences",href:"/recruiter/settings",icon:"settings"}]},
];
const talentTools:Item[]=[
 {label:"Discover Talent",href:"/recruiter/discover",icon:"discover"},
 {label:"Talent Pools",href:"/recruiter/talent-pool",icon:"pools"},
 {label:"Saved Searches",href:"/recruiter/saved-searches",icon:"saved"},
 {label:"Outreach",href:"/recruiter/outreach",icon:"outreach"},
];
const items=sections.flatMap(s=>s.items);
const primary=["/recruiter","/recruiter/pipeline","/recruiter/jobs","/recruiter/messages"].map(href=>items.find(i=>i.href===href)!);
export function RecruiterNav({unreadCount=0,collapsed=false,onToggle,access}:{unreadCount?:number;collapsed?:boolean;onToggle:()=>void;access:RecruiterNavigationAccess|null}) {
 const path=usePathname(),params=useSearchParams();
 const jobContext=Boolean(params.get("job_id"))&&(path==="/recruiter/interviews"||path.startsWith("/recruiter/offers"));
 const [unread,setUnread]=useState(unreadCount),[moreOpen,setMoreOpen]=useState(false),[locked,setLocked]=useState("");
 useEffect(()=>setUnread(unreadCount),[unreadCount]);
 useEffect(()=>{setMoreOpen(false);setLocked("")},[path]);
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
  // Offers history stays reachable when a subscription lapses. Individual new
  // actions are checked by the server rather than hiding preserved records.
  return "";
 }
 function profile(){setMoreOpen(false);window.dispatchEvent(new Event("sapienworx:recruiter-profile"))}
 function entry(item:Item,mobile=false){
  const active=current(item.href),reason=lockReason(item);
  const cls=`swx-sidebar-item ${active?(item.premium?"swx-sidebar-premium-active":"swx-sidebar-active"):""}`;
  const content=<><NavigationIcon name={item.icon}/><span className={collapsed&&!mobile?"sr-only":"swx-sidebar-label"}>{item.label}</span>{item.icon==="messages"&&unread>0&&<span aria-label={unread+" unread messages"} className="swx-sidebar-count">{Math.min(unread,99)}</span>}{reason&&<span aria-label="Access restricted" className="ml-auto text-xs">⌑</span>}{collapsed&&!mobile&&<span aria-hidden="true" className="swx-sidebar-tooltip">{item.label}</span>}</>;
  if(item.href==="#my-profile")return <button key={item.href} type="button" className={cls} aria-label={item.label} onClick={profile}>{content}</button>;
  if(reason)return <button key={item.href} type="button" className={cls} aria-label={item.label+" — access information"} onClick={()=>{setMoreOpen(false);setLocked(reason)}}>{content}</button>;
  // Fetch authenticated workspace data on navigation, rather than for every visible tool.
  return <Link key={item.href} href={item.href} prefetch={false} className={cls} aria-label={item.label} aria-current={active?"page":undefined}>{content}</Link>;
 }
 return <>
  <div id="recruiter-desktop-nav" className="swx-recruiter-nav swx-navy-sidebar hidden lg:grid">
   <button type="button" onClick={onToggle} aria-label={collapsed?"Expand sidebar":"Collapse sidebar"} aria-expanded={!collapsed} aria-controls="recruiter-desktop-nav" className="swx-sidebar-toggle"><svg aria-hidden="true" className="h-5 w-5 fill-none stroke-current" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16m6-12-3 4 3 4"/></svg>{!collapsed&&<span>Collapse sidebar</span>}</button>
   {sections.map(section=><section key={section.title}><h2 className={collapsed?"sr-only":"swx-sidebar-heading"}>{section.title}{section.title==="Recruit Plus+"&&<svg aria-hidden="true" viewBox="0 0 24 24" className="ml-2 inline-block h-4 w-4 fill-none stroke-current stroke-[1.6]"><path d="m3 7 4 4 5-7 5 7 4-4-2 12H5Z"/><path d="M6 16h12"/></svg>}</h2><nav aria-label={section.title} className="grid gap-1">{section.items.map(i=>entry(i))}</nav></section>)}
  </div>
  <RecruiterModal open={moreOpen} onClose={()=>setMoreOpen(false)} title="More recruiter tools" size="small">
   <div id="recruiter-more-menu" data-testid="recruiter-more-menu" className="swx-navy-sidebar">{sections.map(section=><section key={section.title}><h2 className="swx-sidebar-heading">{section.title}{section.title==="Recruit Plus+"&&<svg aria-hidden="true" viewBox="0 0 24 24" className="ml-2 inline-block h-4 w-4 fill-none stroke-current stroke-[1.6]"><path d="m3 7 4 4 5-7 5 7 4-4-2 12H5Z"/><path d="M6 16h12"/></svg>}</h2><nav aria-label={section.title+" mobile"}>{section.items.filter(i=>!primary.includes(i)).map(i=>entry(i,true))}</nav></section>)}<nav aria-label="Talent tools">{talentTools.map(i=>entry(i,true))}</nav></div>
  </RecruiterModal>
  <RecruiterModal open={Boolean(locked)} onClose={()=>setLocked("")} title="Workspace access" size="small"><p className="text-sm leading-7 text-ink">{locked}</p>{access?.member.role==="primary_admin"&&<Link href="/company/plan" className="mt-4 inline-flex min-h-11 items-center font-semibold text-indigo">Review company plan & permissions</Link>}</RecruiterModal>
  <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 lg:hidden" data-testid="recruiter-bottom-nav"><nav aria-label="Recruiter mobile navigation" className="mx-auto grid max-w-2xl grid-cols-5">{primary.map(item=><Link key={item.href} href={item.href} prefetch={false} aria-label={item.label} aria-current={current(item.href)?"page":undefined} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg text-[12px] font-semibold ${current(item.href)?"text-indigo":"text-ink-muted"}`}><NavigationIcon name={item.icon}/><span>{item.label==="Applications"?"Apps":item.label}</span></Link>)}<button type="button" aria-expanded={moreOpen} aria-controls="recruiter-more-menu" onClick={()=>setMoreOpen(true)} className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-semibold text-ink-muted"><span aria-hidden="true" className="text-xl leading-5">⋯</span>More</button></nav></div>
 </>;
}
