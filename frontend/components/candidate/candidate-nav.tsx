"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

const items = [
  ["Overview", "/candidate"],
  ["Find jobs", "/jobs"],
  ["Applications", "/candidate/applications"],
  ["Saved", "/candidate/saved"],
  ["Profile", "/candidate/profile"],
  ["Notifications", "/candidate/notifications"],
] as const;

export function CandidateNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 lg:grid lg:overflow-visible" aria-label="Candidate workspace">
      {items.map(([label, href]) => {
        const active = href === "/candidate" ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={href} className={cn("whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition", active ? "bg-indigo text-white shadow-sm" : "text-ink-muted hover:bg-indigo-soft/50 hover:text-ink")}>{label}</Link>;
      })}
    </nav>
  );
}
