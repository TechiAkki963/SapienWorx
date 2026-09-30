"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { ThreadListResponse } from "@/lib/messaging";

type IconName = "overview" | "discover" | "pipeline" | "talent" | "messages" | "jobs" | "interviews";

const sections: { title: string; items: { label: string; href: string; icon: IconName }[] }[] = [
  { title: "Recruiter workspace", items: [
    { label: "Dashboard", href: "/recruiter", icon: "overview" },
    { label: "Job Management", href: "/recruiter/jobs", icon: "jobs" },
    { label: "Applications", href: "/recruiter/pipeline", icon: "pipeline" },
    { label: "Messages / InMail", href: "/recruiter/messages", icon: "messages" },
    { label: "Interviews", href: "/recruiter/interviews", icon: "interviews" },
  ] },
  { title: "Advanced recruitment tools", items: [
    { label: "Discover Talent", href: "/recruiter/discover", icon: "discover" },
    { label: "Talent Pools", href: "/recruiter/talent-pool", icon: "talent" },
  ] },
];

function NavIcon({ name }: { name: IconName }) {
  const common = "h-[18px] w-[18px] shrink-0 fill-none stroke-current stroke-[1.8]";
  if (name === "overview") return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z" /></svg>;
  if (name === "discover") return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5M8 10.5h5M10.5 8v5" /></svg>;
  if (name === "pipeline") return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M4 5h16M7 12h10M10 19h4" /><circle cx="5" cy="5" r="1" /><circle cx="8" cy="12" r="1" /><circle cx="11" cy="19" r="1" /></svg>;
  if (name === "talent") return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M7 4.5h10a1 1 0 0 1 1 1v15l-6-3.6-6 3.6v-15a1 1 0 0 1 1-1Z" /></svg>;
  if (name === "messages") return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M4 5.5h16v11H9l-5 3v-14Z" /><path d="M7.5 9h9M7.5 12.5h6" /></svg>;
  if (name === "jobs") return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="3.5" y="7" width="17" height="12" rx="2" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 11.5h17" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M8 3.5v4M16 3.5v4M4 10h16M8 14h3M13 14h3" /></svg>;
}

export function RecruiterNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const path = usePathname();
  const navScrollRef = useRef<HTMLDivElement>(null);
  const [unread, setUnread] = useState(unreadCount);

  useEffect(() => { setUnread(unreadCount); }, [unreadCount]);
  useEffect(() => {
    const container = navScrollRef.current;
    if (!container || window.innerWidth >= 1024) return;
    const active = container.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) return;
    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
    const target = Math.min(maxScroll, Math.max(0, active.offsetLeft - 12));
    container.scrollTo({ left: target, behavior: "auto" });
  }, [path]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await apiRequest<ThreadListResponse>("/api/v1/messaging/threads");
        if (active) setUnread((response.items ?? []).reduce((total, thread) => total + thread.unread_count, 0));
      } catch { /* Keep the last known count while offline. */ }
    };
    const onChange = (event: Event) => {
      const change = (event as CustomEvent<number>).detail;
      if (typeof change === "number") setUnread((current) => Math.max(0, current + change));
    };
    window.addEventListener("sapienworx:unread-change", onChange);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { active = false; window.removeEventListener("sapienworx:unread-change", onChange); document.removeEventListener("visibilitychange", refresh); window.clearInterval(timer); };
  }, []);
  return (
    <div ref={navScrollRef} className="flex max-w-full gap-3 overflow-x-auto max-[359px]:flex-wrap max-[359px]:gap-1 max-[359px]:overflow-visible lg:grid lg:overflow-visible">
      {sections.map(section => <div key={section.title} className="shrink-0 max-[359px]:max-w-full lg:min-w-0">
      <p className="hidden px-3 pb-2 pt-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-muted/70 lg:block">{section.title}</p>
      <nav aria-label={section.title} className="flex gap-1 max-[359px]:flex-wrap lg:grid">
        {section.items.map(({ label, href, icon }) => {
          const active = href === "/recruiter" ? path === href : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2",
                active ? "bg-navy text-white shadow-sm" : "text-ink-muted hover:bg-slate-100 hover:text-ink",
              )}
            >
              <NavIcon name={icon} />
              <span className={cn(!active && "max-[359px]:sr-only")}>{label}</span>
              {icon === "messages" && unread > 0 && <span aria-label={`${unread} unread messages`} className="ml-auto rounded-full bg-indigo px-1.5 py-0.5 text-[10px] font-extrabold text-white">{Math.min(unread, 99)}</span>}
            </Link>
          );
        })}
      </nav>
      </div>)}
    </div>
  );
}
