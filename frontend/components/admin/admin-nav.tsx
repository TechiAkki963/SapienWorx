"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { canAdmin, type AdminAccess, type AdminPermission } from "@/lib/admin-access";

const items = [
  ["/swx-command-centre/overview", "Overview"],
  ["/swx-command-centre/tenants", "Tenant governance"],
  ["/swx-command-centre/users", "Users & moderation"],
  ["/swx-command-centre/jobs", "Job moderation"],
  ["/swx-command-centre/privacy", "Privacy operations"],
  ["/swx-command-centre/audit", "Audit logs"],
  ["/swx-command-centre/system", "System health"],
  ["/swx-command-centre/access", "Access design · preview"],
  ["/swx-command-centre/organizations", "Organizations"],
  ["/swx-command-centre/applications", "Applications & outcomes"],
  ["/swx-command-centre/interviews", "Interview oversight"],
  ["/swx-command-centre/control-plane", "Operations & approvals"],
  ["/swx-command-centre/alerts", "Alerts & incidents"],
  ["/swx-command-centre/workforce-taxonomy", "Workforce taxonomy"],
  ["/swx-command-centre/intelligence", "Intelligence"],
  ["/swx-command-centre/trust", "Trust & risk review"],
  ["/swx-command-centre/releases", "Release control"],
  ["/swx-command-centre/content-settings", "Content, settings & costs"],
  ["/swx-command-centre/company-reviews", "Company review moderation"],
] as const;

const modulePermissions: (AdminPermission | null)[] = ["overview.read", "organizations.read", "users.read", "jobs.read", "privacy.read", "audit.read", "system.read", null, "organizations.read", "recruitment.read", "recruitment.read", "control_plane.read", "control_plane.read", "taxonomy.read", "intelligence.read", "trust_risk.read", "release.manage", "control_plane.read", "trust_risk.read"];

const mobileLabels = [
  "Overview",
  "Tenants",
  "Users",
  "Jobs",
  "Privacy",
  "Audit",
  "System",
  "Access",
  "Orgs",
  "Apps",
  "Interviews",
  "Ops",
  "Alerts",
  "Taxonomy",
  "AI",
  "Trust",
  "Releases",
  "Settings",
  "Reviews",
] as const;

function Icon({ index }: { index: number }) {
  const paths = [
    "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    "M5 20V6l7-3 7 3v14M3 20h18M9 9h1M14 9h1M9 14h1M14 14h1",
    "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 20c.6-4 2.5-6 5.5-6s4.9 2 5.5 6M16 7a3 3 0 0 1 0 5M16.5 15c2.2.5 3.5 2 4 4.5",
    "M5 5h14v14H5zM8 9h8M8 13h6M8 17h4",
    "M12 3 5 6v5c0 4.5 2.7 8 7 10 4.3-2 7-5.5 7-10V6l-7-3Zm-2 9 1.5 1.5L15 10",
    "M6 3h12v18H6zM9 8h6M9 12h6M9 16h4",
    "M3 12h4l2-5 4 10 2-5h6",
    "M12 3 5 6v5c0 4.5 2.7 8 7 10 4.3-2 7-5.5 7-10V6l-7-3ZM9 12l2 2 4-4",
  ];
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-current stroke-[1.7]"><path d={paths[index] ?? paths[1]} /></svg>;
}

export function AdminNav({ access, mobile = false }: { access: AdminAccess; mobile?: boolean }) {
  const pathname = usePathname();
  return <nav aria-label="Master Admin navigation" className={mobile ? "flex max-w-full gap-1 overflow-x-auto [scrollbar-width:none]" : "grid gap-1 overflow-visible"}>{items.map(([href, label], index) => {
    const permission = modulePermissions[index];
    if (permission && !canAdmin(access, permission)) return null;
    const displayLabel = mobile ? mobileLabels[index] : index === 7 && access.enabled ? "Access & permissions" : label;
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return <Link key={href} href={href} className={`group flex shrink-0 font-semibold transition ${mobile ? "min-w-[4.25rem] flex-col items-center gap-1 rounded-xl px-1.5 py-2 text-[10px] leading-3" : "items-center gap-3 rounded-xl px-3 py-2.5 text-sm"} ${active ? "bg-[#edf1ff] text-[#3147c8] shadow-[inset_0_0_0_1px_rgba(99,102,241,0.10)]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${active ? "bg-white text-[#4255d7] shadow-sm" : "bg-slate-50 text-slate-500 group-hover:bg-white"}`}><Icon index={index} /></span><span className={mobile ? "max-w-full truncate text-center" : ""}>{displayLabel}</span></Link>;
  })}</nav>;
}
