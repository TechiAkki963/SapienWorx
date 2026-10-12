"use client";
import { useState, type ReactNode } from "react";
import { RecruiterNav, type RecruiterNavigationAccess } from "./recruiter-nav";

export function RecruiterFrame({children,initialCollapsed,preferenceKey,unreadCount,access}:{children:ReactNode;initialCollapsed:boolean;preferenceKey:string;unreadCount:number;access:RecruiterNavigationAccess|null}) {
 const [collapsed,setCollapsed]=useState(initialCollapsed);
 function toggle(){setCollapsed(value=>{const next=!value;document.cookie=`${preferenceKey}=${next?"collapsed":"expanded"}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==="https:"?"; Secure":""}`;return next})}
 return <div className="swx-recruiter-frame mx-auto grid max-w-[108rem] gap-5 px-4 pb-24 pt-4 sm:px-6 lg:px-6 lg:py-6" data-sidebar-collapsed={collapsed}>
  <aside className="min-w-0 lg:sticky lg:top-[5.75rem] lg:self-start"><RecruiterNav unreadCount={unreadCount} collapsed={collapsed} onToggle={toggle} access={access}/></aside>
  <main id="main-content" tabIndex={-1} className="min-w-0 outline-none">{children}</main>
 </div>;
}
