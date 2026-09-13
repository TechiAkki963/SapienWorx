"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
const items=[
  ["Overview","/recruiter"],["Pipeline","/recruiter/pipeline"],["Jobs","/recruiter/jobs"],["Interviews","/recruiter/interviews"]
] as const;
export function RecruiterNav(){const path=usePathname();return <nav aria-label="Recruiter workspace" className="flex gap-1 overflow-x-auto lg:grid lg:overflow-visible">{items.map(([label,href])=>{const active=href==="/recruiter"?path===href:path.startsWith(href);return <Link key={href} href={href} className={cn("shrink-0 rounded-xl px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2",active?"bg-indigo text-white shadow-sm":"text-ink-muted hover:bg-indigo-soft/55 hover:text-ink")}>{label}</Link>})}</nav>}
