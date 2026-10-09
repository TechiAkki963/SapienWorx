"use client";
import Link from "next/link";
import {NavigationIcon} from "./navigation-icon";
import { useEffect,useState } from "react";
import { apiRequest } from "@/lib/api";
import type { RecruiterNotificationInbox } from "@/lib/recruiter-notifications";
export function RecruiterNotificationBell({initialUnread}:{initialUnread:number}){
 const[unread,setUnread]=useState(initialUnread);
 useEffect(()=>{const controller=new AbortController();const refresh=()=>{if(document.visibilityState!=="visible")return;apiRequest<RecruiterNotificationInbox>("/api/v1/recruiter/notifications?limit=1",{signal:controller.signal}).then(result=>setUnread(result.unread)).catch(()=>{});};const timer=setInterval(refresh,30000);window.addEventListener("swx-notifications-changed",refresh);document.addEventListener("visibilitychange",refresh);return()=>{clearInterval(timer);controller.abort();window.removeEventListener("swx-notifications-changed",refresh);document.removeEventListener("visibilitychange",refresh);};},[]);
 return <Link href="/recruiter/notifications" aria-label={`Notifications${unread?`, ${unread} unread`:""}`} className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-ink-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-indigo"><NavigationIcon name="notifications"/>{unread>0&&<span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-indigo px-1.5 py-0.5 text-center text-xs font-bold text-white">{unread>99?"99+":unread}</span>}</Link>;
}
