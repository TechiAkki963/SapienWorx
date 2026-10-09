"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { ThreadListResponse } from "@/lib/messaging";
import { RecruiterDrawer } from "@/components/recruiter/workspace-ui";

import {NavigationIcon as NavIcon,type NavigationIconName as IconName} from "./navigation-icon";

type NavItem = { label: string; shortLabel?: string; href: string; icon: IconName };

const sections: { title: string; items: NavItem[] }[] = [
  { title: "SapienWorx Recruit", items: [
    { label: "Home", href: "/recruiter", icon: "overview" },
    { label: "Jobs", href: "/recruiter/jobs", icon: "jobs" },
    { label: "Applications", shortLabel: "Apps", href: "/recruiter/pipeline", icon: "applications" },
    { label: "Messages", href: "/recruiter/messages", icon: "messages" },
    { label: "Interviews", href: "/recruiter/interviews", icon: "interviews" },
    { label: "Talent", href: "/recruiter/talent", icon: "talent" },
  ] },
  { title: "Workspace", items: [
    { label: "Analytics", href: "/recruiter/analytics", icon: "insights" },
    { label: "Settings", href: "/recruiter/settings", icon: "settings" },
  ] },
];
const secondary: NavItem[] = [
  { label: "Offers", href: "/recruiter/offers", icon: "offers" },
  { label: "Referrals", href: "/recruiter/referrals", icon: "referrals" },
];
const talentTools: NavItem[] = [
  { label: "Discover Talent", href: "/recruiter/discover", icon: "discover" },
  { label: "Talent Pools", href: "/recruiter/talent-pool", icon: "pools" },
  { label: "Saved Searches", href: "/recruiter/saved-searches", icon: "saved" },
  { label: "Outreach", href: "/recruiter/outreach", icon: "outreach" },
];
const allItems = sections.flatMap(section => section.items);
const mobilePrimary = ["/recruiter", "/recruiter/pipeline", "/recruiter/jobs", "/recruiter/messages"].map(href => allItems.find(item => item.href === href)!);
const mobileMore = [...allItems.filter(item => !mobilePrimary.some(primary => primary.href === item.href)), ...secondary, ...talentTools];

function MoreIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>;
}

function isActive(path: string, href: string) {
  if (href === "/recruiter/talent") return ["/recruiter/talent", "/recruiter/discover", "/recruiter/saved-searches", "/recruiter/outreach"].some(prefix => path.startsWith(prefix));
  if (href === "/recruiter/pipeline") return path.startsWith(href) || path.startsWith("/recruiter/candidates/");
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
      <div className="swx-recruiter-nav hidden py-1 lg:grid lg:gap-2 xl:gap-3">
        {sections.map((section) => <div key={section.title} className="min-w-0">
          <p className="hidden px-3 pb-2 pt-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-muted xl:block">{section.title}</p>
          <nav aria-label={section.title} className="grid gap-1">
            {section.items.map(({ label, href, icon }) => {
              const active = isActive(path, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex min-h-11 items-center gap-2.5 rounded-xl py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 lg:justify-center lg:px-0 xl:justify-start xl:px-3",
                    active ? "bg-[#0a66ff] text-white shadow-sm" : "text-ink-muted hover:bg-slate-100 hover:text-ink",
                  )}
                >
                  <NavIcon name={icon} />
                  <span className="lg:sr-only xl:not-sr-only">{label}</span>
                  {icon === "messages" && unread > 0 && <span aria-label={`${unread} unread messages`} className="rounded-full bg-indigo px-1.5 py-0.5 text-[13px] font-extrabold text-white lg:absolute lg:-right-1 lg:-top-1 xl:static xl:ml-auto">{Math.min(unread, 99)}</span>}
                </Link>
              );
            })}
          </nav>
        </div>)}
        <details className="mt-2 border-t border-line pt-2"><summary className="min-h-11 cursor-pointer rounded-lg px-3 py-3 text-xs font-semibold text-ink-muted">Hiring tools</summary><nav aria-label="Contextual hiring tools" className="grid gap-1">{secondary.map(item => <Link key={item.href} href={item.href} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-3 text-sm text-ink-muted"><NavIcon name={item.icon}/>{item.label}</Link>)}</nav></details>
      </div>

      <RecruiterDrawer open={moreOpen} onClose={() => setMoreOpen(false)} title="More recruiter tools">
            <div id="recruiter-more-menu" data-testid="recruiter-more-menu">
              <nav aria-label="More recruiter tools" className="grid gap-1">
                {mobileMore.map(({ label, href, icon }) => {
                  const active = isActive(path, href);
                  return (
                    <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition", active ? "bg-[#0a66ff] text-white" : "text-ink hover:bg-slate-50")}>
                      <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", active ? "text-white" : "bg-slate-100 text-ink-muted")}><NavIcon name={icon} /></span>
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
      </RecruiterDrawer>
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line/80 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl lg:hidden" data-testid="recruiter-bottom-nav">
        <nav aria-label="Recruiter mobile navigation" className="mx-auto grid max-w-2xl grid-cols-5">
          {mobilePrimary.map(({ label, shortLabel, href, icon }) => {
            const active = isActive(path, href);
            return (
              <Link key={href} href={href} aria-label={label} aria-current={active ? "page" : undefined} className={cn("relative flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[13px] font-bold transition", active ? "text-indigo" : "text-ink-muted hover:bg-slate-50 hover:text-ink")}>
                <span className={cn("relative flex h-6 items-center justify-center", active && "after:absolute after:-bottom-1.5 after:h-1 after:w-1 after:rounded-full after:bg-indigo")}>
                  <NavIcon name={icon} className="h-5 w-5" />
                  {icon === "messages" && unread > 0 && <span aria-label={`${unread} unread messages`} className="absolute -right-3 -top-1 min-w-4 rounded-full bg-indigo px-1 py-0.5 text-center text-[12px] font-extrabold leading-none text-white">{Math.min(unread, 99)}</span>}
                </span>
                <span className="max-w-full truncate">{shortLabel ?? label}</span>
              </Link>
            );
          })}
          <button type="button" aria-expanded={moreOpen} aria-controls="recruiter-more-menu" onClick={() => setMoreOpen((open) => !open)} className={cn("relative flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[13px] font-bold transition", moreActive || moreOpen ? "text-indigo" : "text-ink-muted hover:bg-slate-50 hover:text-ink")}>
            <span className={cn("relative flex h-6 items-center justify-center", (moreActive || moreOpen) && "after:absolute after:-bottom-1.5 after:h-1 after:w-1 after:rounded-full after:bg-indigo")}><MoreIcon /></span>
            <span>More</span>
          </button>
        </nav>
      </div>
    </>
  );
}
