"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

type IconName = "overview" | "pipeline" | "jobs" | "interviews";

const items: { label: string; href: string; icon: IconName }[] = [
  { label: "Overview", href: "/recruiter", icon: "overview" },
  { label: "Pipeline", href: "/recruiter/pipeline", icon: "pipeline" },
  { label: "Jobs", href: "/recruiter/jobs", icon: "jobs" },
  { label: "Interviews", href: "/recruiter/interviews", icon: "interviews" },
];

function NavIcon({ name }: { name: IconName }) {
  const common = "h-[18px] w-[18px] shrink-0 fill-none stroke-current stroke-[1.8]";
  if (name === "overview") return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z" /></svg>;
  if (name === "pipeline") return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><path d="M4 5h16M7 12h10M10 19h4" /><circle cx="5" cy="5" r="1" /><circle cx="8" cy="12" r="1" /><circle cx="11" cy="19" r="1" /></svg>;
  if (name === "jobs") return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="3.5" y="7" width="17" height="12" rx="2" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 11.5h17" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}><rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M8 3.5v4M16 3.5v4M4 10h16M8 14h3M13 14h3" /></svg>;
}

export function RecruiterNav() {
  const path = usePathname();
  return (
    <div>
      <p className="hidden px-3 pb-2 pt-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-muted/70 lg:block">Workspace</p>
      <nav aria-label="Recruiter workspace" className="flex gap-1 overflow-x-auto lg:grid lg:overflow-visible">
        {items.map(({ label, href, icon }) => {
          const active = href === "/recruiter" ? path === href : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2",
                active ? "bg-navy text-white shadow-sm" : "text-ink-muted hover:bg-slate-100 hover:text-ink",
              )}
            >
              <NavIcon name={icon} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
