"use client";
import { useState, type ReactNode } from "react";
import { RecruiterNav, type RecruiterNavigationAccess } from "./recruiter-nav";
import { RecruiterProfileProvider } from "./profile-context";
import styles from "./recruiter-frame.module.css";

export function RecruiterFrame({children,header,initialCollapsed,preferenceKey,unreadCount,access,recruiterName,companyName,profileImageUrl}:{children:ReactNode;header:ReactNode;initialCollapsed:boolean;preferenceKey:string;unreadCount:number;access:RecruiterNavigationAccess|null;recruiterName:string;companyName:string;profileImageUrl?:string}) {
 const [collapsed,setCollapsed]=useState(initialCollapsed);
 function toggle(){setCollapsed(value=>{const next=!value;document.cookie=`${preferenceKey}=${next?"collapsed":"expanded"}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==="https:"?"; Secure":""}`;return next})}
 return <RecruiterProfileProvider initialProfileImageUrl={profileImageUrl || ""}><div className={`swx-recruiter-frame ${styles.frame}`} data-sidebar-collapsed={collapsed}>
  <aside className="swx-recruiter-sidebar-region"><RecruiterNav unreadCount={unreadCount} collapsed={collapsed} onToggle={toggle} access={access} recruiterName={recruiterName} companyName={companyName} profileImageUrl={profileImageUrl}/></aside>
  <div className="swx-recruiter-main-shell">{header}<main id="main-content" tabIndex={-1} className="min-w-0 px-4 pb-24 pt-4 outline-none sm:px-6 lg:py-6">{children}</main></div>
 </div></RecruiterProfileProvider>;
}
