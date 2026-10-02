"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { ThreadListResponse } from "@/lib/messaging";

type IconName = "overview" | "discover" | "pipeline" | "talent" | "messages" | "outreach" | "jobs" | "interviews";

type NavItem = { label: string; shortLabel?: string; href: string; icon: IconName };

const sections: { title: string; items: NavItem[] }[] = [
  { title: "Recruiter workspace", items: [
    { label: "Dashboard", shortLabel: "Home", href: "/recruiter", icon: "overview" },
    { label: "Job Management", shortLabel: "Jobs", href: "/recruiter/jobs", icon: "jobs" },
    { label: "Applications", shortLabel: "Apps", href: "/recruiter/pipeline", icon: "pipeline" },
    { label: "Messages / InMail", shortLabel: "Inbox", href: "/recruiter/messages", icon: "messages" },
    { label: "Interviews", href: "/recruiter/interviews", icon: "interviews" },
  ] },
  { title: "Advanced recruitment tools", items: [
    { label: "Discover Talent", href: "/recruiter/discover", icon: "discover" },
    { label: "Talent Pools", href: "/recruiter/talent-pool", icon: "talent" },
    { label: "Outreach", href: "/recruiter/outreach", icon: "outreach" },
  ] },
];

const mobilePrimary = sections[0].items.slice(0, 4);
const mobileMore = [sections[0].items[4], ...sections[1].items];

function NavIcon({ name, className }: { name: IconName; className?: string }) {
  const common = cn("h-[18px] w-[18px] shrink-0 fill-none stroke-current stroke-[1.8]", className);
  if (name === "overview") return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z" /></svg>;
  if (name === "discover") return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5M8 10.5h5M10.5 8v5" /></svg>;
  if (name === "pipeline") return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M4 5h16M7 12h10M10 19h4" /><circle cx="5" cy="5" r="1" /><circle cx="8" cy="12" r="1" /><circle cx="11" cy="19" r="1" /></svg>;
  if (name === "talent") return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M7 4.5h10a1 1 0 0 1 1 1v15l-6-3.6-6 3.6v-15a1 1 0 0 1 1-1Z" /></svg>;
  if (name === "messages") return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M4 5.5h16v11H9l-5 3v-14Z" /><path d="M7.5 9h9M7.5 12.5h6" /></svg>;
  if (name === "outreach") return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M4 7.5h10M4 12h7M4 16.5h5" /><path d="m14 15 5-5M15 10h4v4" /></svg>;
  if (name === "jobs") return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="3.5" y="7" width="17" height="12" rx="2" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 11.5h17" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M8 3.5v4M16 3.5v4M4 10h16M8 14h3M13 14h3" /></svg>;
}

function MoreIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>;
}

function isActive(path: string, href: string) {
  return href === "/recruiter" ? path === href : path.startsWith(href);
}

export function RecruiterNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const path = usePathname();
  const [unread, setUnread] = useState(unreadCount);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => { setUnread(unreadCount); }, [unreadCount]);
  useEffect(() => { setMoreOpen(false); }, [path]);
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

  const moreActive = mobileMore.some((item) => isActive(path, item.href));

  return (
    <>
      <div className="hidden rounded-2xl border border-line/70 bg-white p-2.5 shadow-[0_1px_3px_rgba(16,33,63,0.04)] lg:grid lg:gap-2 xl:gap-3">
        {sections.map((section) => <div key={section.title} className="min-w-0">
          <p className="hidden px-3 pb-2 pt-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-muted/70 xl:block">{section.title}</p>
          <nav aria-label={section.title} className="grid gap-1">
            {section.items.map(({ label, href, icon }) => {
              const active = isActive(path, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-xl py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 lg:justify-center lg:px-0 xl:justify-start xl:px-3",
                    active ? "bg-navy text-white shadow-sm" : "text-ink-muted hover:bg-slate-100 hover:text-ink",
                  )}
                >
                  <NavIcon name={icon} />
                  <span className="lg:sr-only xl:not-sr-only">{label}</span>
                  {icon === "messages" && unread > 0 && <span aria-label={`${unread} unread messages`} className="rounded-full bg-indigo px-1.5 py-0.5 text-[10px] font-extrabold text-white lg:absolute lg:-right-1 lg:-top-1 xl:static xl:ml-auto">{Math.min(unread, 99)}</span>}
                </Link>
              );
            })}
          </nav>
        </div>)}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line/80 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_28px_rgba(16,33,63,0.10)] backdrop-blur-xl lg:hidden" data-testid="recruiter-bottom-nav">
        {moreOpen && (
          <>
            <button type="button" aria-label="Close recruiter navigation" className="fixed inset-0 -z-10 bg-navy/10" onClick={() => setMoreOpen(false)} />
            <div className="absolute bottom-[calc(100%+0.5rem)] right-3 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-line bg-white p-2 shadow-[0_18px_50px_rgba(16,33,63,0.18)]" id="recruiter-more-menu" data-testid="recruiter-more-menu">
              <p className="px-3 pb-1.5 pt-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">More recruiter tools</p>
              <nav aria-label="More recruiter tools" className="grid gap-1">
                {mobileMore.map(({ label, href, icon }) => {
                  const active = isActive(path, href);
                  return (
                    <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition", active ? "bg-indigo-soft text-indigo" : "text-ink hover:bg-slate-50")}>
                      <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", active ? "bg-white text-indigo" : "bg-slate-100 text-ink-muted")}><NavIcon name={icon} /></span>
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </>
        )}

        <nav aria-label="Recruiter mobile navigation" className="mx-auto grid max-w-2xl grid-cols-5">
          {mobilePrimary.map(({ label, shortLabel, href, icon }) => {
            const active = isActive(path, href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("relative flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-bold transition", active ? "text-indigo" : "text-ink-muted hover:bg-slate-50 hover:text-ink")}>
                <span className={cn("relative flex h-6 items-center justify-center", active && "after:absolute after:-bottom-1.5 after:h-1 after:w-1 after:rounded-full after:bg-indigo")}>
                  <NavIcon name={icon} className="h-5 w-5" />
                  {icon === "messages" && unread > 0 && <span aria-label={`${unread} unread messages`} className="absolute -right-3 -top-1 min-w-4 rounded-full bg-indigo px-1 py-0.5 text-center text-[8px] font-extrabold leading-none text-white">{Math.min(unread, 99)}</span>}
                </span>
                <span className="max-w-full truncate">{shortLabel ?? label}</span>
              </Link>
            );
          })}
          <button type="button" aria-expanded={moreOpen} aria-controls="recruiter-more-menu" onClick={() => setMoreOpen((open) => !open)} className={cn("relative flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-bold transition", moreActive || moreOpen ? "text-indigo" : "text-ink-muted hover:bg-slate-50 hover:text-ink")}>
            <span className={cn("relative flex h-6 items-center justify-center", (moreActive || moreOpen) && "after:absolute after:-bottom-1.5 after:h-1 after:w-1 after:rounded-full after:bg-indigo")}><MoreIcon /></span>
            <span>More</span>
          </button>
        </nav>
      </div>
    </>
  );
}
