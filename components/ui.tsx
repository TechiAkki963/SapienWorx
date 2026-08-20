"use client";

import type { ReactNode } from "react";

export type Workspace = "candidate" | "recruiter" | "admin";

type NavItem = { label: string; href: string; glyph: string; id: string };

const navigation: Record<Workspace, NavItem[]> = {
  candidate: [
    { id: "dashboard", label: "Dashboard", href: "/candidate", glyph: "▦" },
    { id: "jobs", label: "Jobs", href: "/candidate/jobs", glyph: "⌕" },
    { id: "applications", label: "Applications", href: "/candidate", glyph: "◫" },
    { id: "resume", label: "Resume review", href: "/candidate/review", glyph: "▤" },
    { id: "notifications", label: "Notifications", href: "/candidate/notifications", glyph: "◌" },
    { id: "messages", label: "Messages", href: "/candidate/messages", glyph: "✉" },
    { id: "profile", label: "Profile", href: "/candidate/profile", glyph: "♙" },
  ],
  recruiter: [
    { id: "dashboard", label: "Overview", href: "/recruiter", glyph: "▦" },
    { id: "jobs", label: "Post Jobs", href: "/recruiter/jobs", glyph: "▤" },
    { id: "my-jobs", label: "My Jobs", href: "/recruiter/jobs/manage", glyph: "◫" },
    { id: "candidates", label: "Candidates", href: "/recruiter/pipeline", glyph: "♙" },
    { id: "sourcing", label: "Source candidates", href: "/recruiter/sourcing", glyph: "⌕" },
    { id: "pipeline", label: "Pipeline", href: "/recruiter/pipeline", glyph: "⇄" },
    { id: "interviews", label: "Interviews", href: "/recruiter", glyph: "◷" },
    { id: "communications", label: "Communications", href: "/recruiter/communications", glyph: "✉" },
    { id: "reports", label: "Reports", href: "/recruiter", glyph: "◔" },
  ],
  admin: [
    { id: "dashboard", label: "Platform overview", href: "/admin", glyph: "▦" },
    { id: "organizations", label: "Organizations", href: "/admin", glyph: "▦" },
    { id: "users", label: "Users & roles", href: "/admin", glyph: "♙" },
    { id: "parser", label: "Parser operations", href: "/admin", glyph: "◌" },
    { id: "billing", label: "Billing & plans", href: "/admin", glyph: "◇" },
    { id: "audit", label: "Audit logs", href: "/admin", glyph: "▤" },
  ],
};

const workspaceLabels: Record<Workspace, string> = {
  candidate: "Career workspace",
  recruiter: "Nexora Technologies",
  admin: "Platform control",
};

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <a className={`logo ${light ? "logo-light" : ""}`} href="/" aria-label="Sapienworx home">
      <span className="logo-mark" aria-hidden="true"><i /> <i /> <i /></span>
      <span>Sapien<span>worx</span></span>
    </a>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "blue" | "green" | "amber" | "rose" | "purple" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Meter({ value, color = "blue" }: { value: number; color?: "blue" | "green" | "amber" }) {
  return <span className="meter" aria-label={`${value}% complete`}><span className={`meter-fill meter-${color}`} style={{ width: `${value}%` }} /></span>;
}

export function Button({ children, href, variant = "primary", onClick, type = "button", disabled = false }: { children: ReactNode; href?: string; variant?: "primary" | "secondary" | "quiet" | "danger" | "dark"; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean }) {
  const className = `button button-${variant}`;
  if (href) return <a className={className} href={href}>{children}</a>;
  return <button className={className} onClick={onClick} type={type} disabled={disabled}>{children}</button>;
}

export function WorkspaceShell({ workspace, active, title, description, actions, children }: { workspace: Workspace; active: string; title?: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  const initials = workspace === "candidate" ? "AM" : workspace === "recruiter" ? "JR" : "SA";
  return (
    <div className="workspace-shell">
      <header className="topbar">
        <Logo />
        <label className="global-search"><span>⌕</span><input aria-label="Search" placeholder={workspace === "candidate" ? "Search jobs, companies, skills" : "Search"} /></label>
        <div className="topbar-actions">
          <button className="icon-button" aria-label="Help">?</button>
          <a className="icon-button notification-dot" aria-label="Notifications" href={workspace === "candidate" ? "/candidate/notifications" : "#notifications"}>♧</a>
          <span className={`avatar avatar-${workspace}`}>{initials}</span>
        </div>
      </header>
      <aside className="sidebar">
        <div className="workspace-name"><span className={`workspace-icon workspace-${workspace}`}>{workspace === "candidate" ? "✦" : workspace === "recruiter" ? "N" : "S"}</span><div><strong>{workspaceLabels[workspace]}</strong><small>{workspace === "admin" ? "Super admin" : workspace === "recruiter" ? "Recruiter workspace" : "Candidate portal"}</small></div></div>
        <nav aria-label={`${workspace} navigation`}>
          {navigation[workspace].map((item) => <a className={item.id === active ? "nav-item nav-item-active" : "nav-item"} href={item.href} key={item.id}><span aria-hidden="true">{item.glyph}</span>{item.label}</a>)}
        </nav>
        <div className="sidebar-bottom">
          <a className={active === "settings" ? "nav-item nav-item-active" : "nav-item"} href={workspace === "candidate" ? "/candidate/settings" : "#settings"}><span aria-hidden="true">⚙</span>Settings</a>
          <a className="switch-workspace" href={workspace === "candidate" ? "/recruiter" : workspace === "recruiter" ? "/admin" : "/candidate"}>Switch workspace <span>→</span></a>
        </div>
      </aside>
      <main className="workspace-main">
        {(title || description || actions) && <div className="page-heading"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="heading-actions">{actions}</div>}</div>}
        {children}
      </main>
    </div>
  );
}

export function StatCard({ label, value, change, tone = "blue", icon }: { label: string; value: string; change?: string; tone?: "blue" | "green" | "amber" | "rose" | "purple"; icon?: string }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span>{icon && <b className={`stat-icon stat-icon-${tone}`}>{icon}</b>}</div><strong>{value}</strong>{change && <small className={change.startsWith("+") ? "positive" : "muted"}>{change}</small>}</article>;
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <div className="section-title"> <div>{eyebrow && <p>{eyebrow}</p>}<h2>{title}</h2></div>{action}</div>;
}

export function EmptyState({ icon, title, copy, action }: { icon: string; title: string; copy: string; action: ReactNode }) {
  return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{copy}</p>{action}</div>;
}
