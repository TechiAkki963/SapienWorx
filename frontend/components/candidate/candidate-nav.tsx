"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

const items = [
  ["Overview", "/candidate"],
  ["Find jobs", "/candidate/jobs"],
  ["Applications", "/candidate/applications"],
  ["Interviews", "/candidate/interviews"],
  ["Inbox", "/candidate/inbox"],
  ["Saved", "/candidate/saved"],
  ["Profile", "/candidate/profile"],
  ["Notifications", "/candidate/notifications"],
] as const;

export function CandidateNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-0.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-1 lg:grid lg:overflow-visible" aria-label="Candidate workspace">
      {items.map(([label, href]) => {
        const active = href === "/candidate" ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={href} className={cn("whitespace-nowrap rounded-xl px-2 py-2.5 text-[13px] font-semibold transition sm:px-3 sm:text-sm", active ? "bg-indigo text-white shadow-sm" : "text-ink-muted hover:bg-indigo-soft/50 hover:text-ink")}>{label}</Link>;
      })}
    </nav>
  );
}
