"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

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
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active || window.matchMedia("(min-width: 1024px)").matches) return;
    active.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <nav ref={navRef} className="flex gap-1 overflow-x-auto pb-1 lg:grid lg:overflow-visible" aria-label="Candidate workspace">
      {items.map(([label, href]) => {
        const active = href === "/candidate" ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition", active ? "bg-indigo text-white shadow-sm" : "text-ink-muted hover:bg-indigo-soft/50 hover:text-ink")}>{label}</Link>;
      })}
    </nav>
  );
}
