"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/swx-command-centre/overview", label: "Overview", icon: "grid" },
  { href: "/swx-command-centre/tenants", label: "Tenant governance", icon: "building" },
  { href: "/swx-command-centre/users", label: "Users & moderation", icon: "users" },
  { href: "/swx-command-centre/system", label: "System health", icon: "pulse" },
] as const;

function Icon({ name }: { name: (typeof items)[number]["icon"] }) {
  if (name === "grid") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-current stroke-[1.7]"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>;
  if (name === "building") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-current stroke-[1.7]"><path d="M5 20V6l7-3 7 3v14M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1M3 20h18"/></svg>;
  if (name === "users") return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-current stroke-[1.7]"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.7-3.2 2.6-5 5.5-5s4.8 1.8 5.5 5M16 5.5a2.7 2.7 0 0 1 0 5.2M16.5 14c2.2.4 3.6 1.9 4 4.2"/></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-current stroke-[1.7]"><path d="M3 12h4l2-5 4 10 2-5h6"/><path d="M4 4h16v16H4z" opacity=".25"/></svg>;
}

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Master Admin navigation" className="grid gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-[#edf1ff] text-[#3147c8] shadow-[inset_0_0_0_1px_rgba(99,102,241,0.10)]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
          >
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${active ? "bg-white text-[#4255d7] shadow-sm" : "bg-slate-50 text-slate-500 group-hover:bg-white"}`}><Icon name={item.icon} /></span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
