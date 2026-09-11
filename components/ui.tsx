"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { apiClient } from "../lib/api-client";
import { WorkspaceLiveEvents } from "./workspace-live-events";
import { LiveAttentionBadge, LiveEventIndicator, LivePipelineBadge, LiveUpdateNotice } from "./live-event-indicators";
import { useLiveEventsStore, type AttentionSummary } from "../stores/live-events";

export type Workspace = "candidate" | "recruiter" | "admin";

type IconName = "home" | "jobs" | "people" | "search" | "pipeline" | "calendar" | "message" | "reports" | "profile" | "settings" | "more" | "bell" | "help" | "logout" | "menu" | "close" | "briefcase";
type NavItem = { label: string; href: string; icon: IconName; id: string };

const iconPaths: Record<IconName, ReactNode> = {
  home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></>,
  jobs: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6V4h8v2M3 11h18M10 14h4"/></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18"/></>,
  people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  pipeline: <><path d="M4 6h6M14 6h6M8 6v12M16 6v12M4 18h6M14 18h6"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M7 9h10M7 13h7"/></>,
  reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.18.37.28.78.28 1.2s-.1.83-.28 1.2z"/></>,
  more: <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.7 1.2c-.7 1-2.2 1.3-2.2 2.8M12 17h.01"/></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
};

export function Icon({ name, size = 20, label }: { name: IconName; size?: number; label?: string }) {
  return <svg className="swx-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} aria-label={label}>{iconPaths[name]}</svg>;
}

const navigation: Record<Workspace, NavItem[]> = {
  candidate: [
    { id: "dashboard", label: "Home", href: "/candidate", icon: "home" },
    { id: "jobs", label: "Jobs", href: "/candidate/jobs", icon: "jobs" },
    { id: "applications", label: "Applications", href: "/candidate/applications", icon: "briefcase" },
    { id: "interviews", label: "Interviews", href: "/candidate/interviews", icon: "calendar" },
    { id: "messages", label: "Messages", href: "/candidate/messages", icon: "message" },
    { id: "profile", label: "Profile", href: "/candidate/profile", icon: "profile" },
  ],
  recruiter: [
    { id: "dashboard", label: "Home", href: "/recruiter", icon: "home" },
    { id: "jobs", label: "Jobs", href: "/recruiter/jobs/manage", icon: "jobs" },
    { id: "sourcing", label: "Candidates", href: "/recruiter/sourcing", icon: "people" },
    { id: "pipeline", label: "Pipeline", href: "/recruiter/pipeline", icon: "pipeline" },
    { id: "interviews", label: "Interviews", href: "/recruiter/interviews", icon: "calendar" },
    { id: "communications", label: "Messages", href: "/recruiter/communications", icon: "message" },
    { id: "workbench", label: "More", href: "/recruiter/workbench", icon: "more" },
    { id: "reports", label: "Reports", href: "/recruiter/reports", icon: "reports" },
  ],
  admin: [
    { id: "dashboard", label: "Platform overview", href: "/admin", icon: "home" },
    { id: "users", label: "Users & access", href: "/admin#users", icon: "people" },
    { id: "organisations", label: "Organisations & jobs", href: "/admin#governance", icon: "briefcase" },
    { id: "operations", label: "Service operations", href: "/admin#operations", icon: "pipeline" },
    { id: "support", label: "Support & privacy", href: "/admin#support", icon: "message" },
    { id: "assurance", label: "Security & reports", href: "/admin#assurance", icon: "reports" },
    { id: "knowledge", label: "Knowledge Hub", href: "/admin#knowledge", icon: "jobs" },
    { id: "advanced", label: "Advanced controls", href: "/admin#advanced", icon: "settings" },
  ],
};

const mobileNavigation: Record<Exclude<Workspace, "admin">, NavItem[]> = {
  candidate: [navigation.candidate[0], navigation.candidate[1], navigation.candidate[2], navigation.candidate[4], navigation.candidate[5]],
  recruiter: [navigation.recruiter[0], navigation.recruiter[1], navigation.recruiter[2], navigation.recruiter[4], navigation.recruiter[6]],
};

const workspaceLabels: Record<Workspace, string> = {
  candidate: "Career workspace",
  recruiter: "Recruiter workspace",
  admin: "Platform control",
};

type CurrentSession = { userId: string; role: "CANDIDATE" | "RECRUITER" | "ADMIN" | "SUPER_ADMIN" };
const workspaceRoles: Record<Workspace, CurrentSession["role"][]> = { candidate: ["CANDIDATE"], recruiter: ["RECRUITER", "ADMIN"], admin: ["SUPER_ADMIN"] };
const workspaceLogin: Record<Workspace, string> = { candidate: "/login", recruiter: "/recruiter/login", admin: "/admin/login" };
const workspaceSettings: Record<Workspace, string> = { candidate: "/candidate/settings", recruiter: "/recruiter/settings", admin: "#settings" };
const roleHome: Record<CurrentSession["role"], string> = { CANDIDATE: "/candidate", RECRUITER: "/recruiter", ADMIN: "/recruiter", SUPER_ADMIN: "/admin" };

export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

export function Logo({ light = false }: { light?: boolean }) {
  return <a className={`logo ${light ? "logo-light" : ""}`} href="/" aria-label="SapienWorx home"><Image className="logo-mark" src="/brand/sapienworx-mark.jpeg" alt="" width={36} height={36} sizes="36px" /><span>Sapien<span>worx</span></span></a>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "blue" | "green" | "amber" | "rose" | "purple" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Meter({ value, color = "blue" }: { value: number; color?: "blue" | "green" | "amber" }) {
  return <span className="meter" aria-label={`${value}% complete`}><span className={`meter-fill meter-${color}`} style={{ width: `${value}%` }} /></span>;
}

export function Button({ children, href, variant = "primary", onClick, type = "button", disabled = false }: { children: ReactNode; href?: string; variant?: "primary" | "secondary" | "quiet" | "danger" | "dark"; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean }) {
  const className = `button button-${variant}`;
  if (href) return <a className={className} href={href} onClick={onClick}>{children}</a>;
  return <button className={className} onClick={onClick} type={type} disabled={disabled}>{children}</button>;
}

function NavLink({ workspace, item, active, compact = false }: { workspace: Workspace; item: NavItem; active: string; compact?: boolean }) {
  const activeNow = item.id === active;
  return <a aria-current={activeNow ? "page" : undefined} className={`${activeNow ? "nav-item nav-item-active" : "nav-item"}${compact ? " nav-item-compact" : ""}`} href={item.href} title={compact ? item.label : undefined}><Icon name={item.icon} /><span className="nav-label">{item.label}</span>{workspace === "recruiter" && item.id === "pipeline" && <LivePipelineBadge/>}{workspace === "candidate" && item.id === "messages" && <LiveAttentionBadge type="messages" />}{workspace === "candidate" && item.id === "applications" && <LiveAttentionBadge type="interviews" />}{workspace === "recruiter" && item.id === "communications" && <LiveAttentionBadge type="messages" />}{workspace === "recruiter" && item.id === "interviews" && <LiveAttentionBadge type="interviews" />}</a>;
}

export function WorkspaceShell({ workspace, active, title, description, actions, globalSearch, children }: { workspace: Workspace; active: string; title?: string; description?: string; actions?: ReactNode; globalSearch?: { value: string; onChange: (value: string) => void; placeholder?: string }; children: ReactNode }) {
  const initials = workspace === "candidate" ? "AM" : workspace === "recruiter" ? "JR" : "SA";
  const hydrated = useHydrated();
  const localDemo = process.env.NEXT_PUBLIC_LOCAL_DEMO === "true";
  const [access, setAccess] = useState<"checking" | "allowed" | "redirecting">(localDemo ? "allowed" : "checking");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const hydrateAttention = useLiveEventsStore((state) => state.hydrateAttention);

  useEffect(() => {
    if (!hydrated) return;
    setSidebarCollapsed(window.localStorage.getItem("sapienworx.recruiter.sidebar") === "collapsed");
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || localDemo) return;
    let cancelled = false;
    void apiClient<CurrentSession>("/api/auth/session").then((session) => {
      if (cancelled) return;
      if (workspaceRoles[workspace].includes(session.role)) setAccess("allowed");
      else { setAccess("redirecting"); window.location.replace(roleHome[session.role]); }
    }).catch(() => { if (!cancelled) { setAccess("redirecting"); window.location.replace(workspaceLogin[workspace]); } });
    return () => { cancelled = true; };
  }, [hydrated, localDemo, workspace]);

  useEffect(() => {
    if (!hydrated || access !== "allowed" || workspace === "admin") return;
    let current = true;
    void apiClient<AttentionSummary>("/api/notifications/summary").then((summary) => { if (current) hydrateAttention(summary); }).catch(() => undefined);
    return () => { current = false; };
  }, [access, hydrateAttention, hydrated, workspace]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const dismissOutside = (event: PointerEvent) => { if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false); };
    const dismissWithKeyboard = (event: KeyboardEvent) => { if (event.key === "Escape") { setAccountMenuOpen(false); accountTriggerRef.current?.focus(); } };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissWithKeyboard);
    return () => { document.removeEventListener("pointerdown", dismissOutside); document.removeEventListener("keydown", dismissWithKeyboard); };
  }, [accountMenuOpen]);

  const signOut = async () => {
    setLoggingOut(true); setLogoutError("");
    try {
      await apiClient<void>("/api/auth/logout", { method: "POST" });
      window.localStorage.removeItem("sapienworx.local-candidate-domain");
      window.localStorage.removeItem("sapienworx-saved-candidates");
      window.location.assign(workspaceLogin[workspace]);
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "We could not log you out securely. Please try again.");
      setLoggingOut(false);
    }
  };

  const toggleRecruiterSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    window.localStorage.setItem("sapienworx.recruiter.sidebar", next ? "collapsed" : "expanded");
  };

  if (!hydrated || access !== "allowed") return <main className="workspace-access-state" aria-live="polite"><Logo/><span className="workspace-access-pulse" aria-hidden="true"/><h1>{access === "redirecting" ? "Taking you to the right workspace…" : "Securing your workspace…"}</h1><p>We’re confirming your signed-in role before showing private information.</p></main>;

  const showGlobalSearch = workspace !== "candidate" || Boolean(globalSearch);
  const desktopNav = workspace === "candidate" ? navigation.candidate.slice(0, 5) : [];

  return <div className={`workspace-shell workspace-shell-${workspace}${workspace === "recruiter" && sidebarCollapsed ? " recruiter-sidebar-collapsed" : ""}`}>
    <a className="skip-link" href="#workspace-content">Skip to workspace content</a>
    <WorkspaceLiveEvents />
    <header className="topbar">
      <Logo />
      {workspace === "candidate" && <nav className="candidate-desktop-nav" aria-label="Candidate primary navigation">{desktopNav.map((item) => <NavLink workspace={workspace} item={item} active={active} key={item.id} />)}</nav>}
      {showGlobalSearch && <label className="global-search"><Icon name="search" size={18}/><input aria-label="Search" value={globalSearch?.value ?? ""} onChange={globalSearch ? (event) => globalSearch.onChange(event.target.value) : undefined} readOnly={!globalSearch} placeholder={globalSearch?.placeholder ?? "Search candidates, jobs, organisations"} /></label>}
      <div className="topbar-actions">
        {workspace === "recruiter" && <a className="button button-primary topbar-create-job" href="/recruiter/jobs">+ Create Job</a>}
        {workspace === "admin" ? <a className="icon-button" aria-label="Help" href="#help"><Icon name="help" /></a> : <button className="icon-button" aria-label="Help" type="button"><Icon name="help" /></button>}
        <a className="icon-button notification-dot" aria-label="Notifications" href={workspace === "candidate" ? "/candidate/notifications" : workspace === "recruiter" ? "/recruiter/communications" : "#notifications"}><Icon name="bell"/><LiveEventIndicator workspace={workspace}/></a>
        <div className="account-menu-shell" ref={accountMenuRef}>
          <button ref={accountTriggerRef} className={`avatar avatar-${workspace} account-trigger`} type="button" aria-label={`Account menu · ${initials}`} aria-expanded={accountMenuOpen} aria-controls="workspace-account-menu" onClick={() => setAccountMenuOpen((open) => !open)}>{initials}</button>
          {accountMenuOpen && <div className="account-menu" id="workspace-account-menu" aria-label="Account options">
            <div className="account-menu-identity"><span className={`avatar avatar-${workspace}`}>{initials}</span><div><strong>{workspace === "admin" ? "Master Admin" : workspace === "recruiter" ? "Recruiter account" : "Candidate account"}</strong><small>{workspaceLabels[workspace]}</small></div></div>
            {workspace === "candidate" && <a className="account-menu-item" href="/candidate/reports" onClick={() => setAccountMenuOpen(false)}><Icon name="reports" size={18}/>Reports</a>}
            <a aria-current={active === "settings" ? "page" : undefined} className="account-menu-item" href={workspaceSettings[workspace]} onClick={() => setAccountMenuOpen(false)}><Icon name="settings" size={18}/>Settings</a>
            <button className="account-menu-item account-menu-logout" type="button" onClick={() => void signOut()} disabled={loggingOut}><Icon name="logout" size={18}/>{loggingOut ? "Logging out…" : "Log out"}</button>
            {logoutError && <p className="logout-error" role="alert">{logoutError}</p>}
          </div>}
        </div>
      </div>
    </header>

    {workspace !== "candidate" && <aside className="sidebar">
      <div className="workspace-name"><span className={`workspace-icon workspace-${workspace}`}>{workspace === "recruiter" ? "R" : "S"}</span><div><strong>{workspaceLabels[workspace]}</strong><small>{workspace === "admin" ? "Super admin" : "Hiring team"}</small></div>{workspace === "recruiter" && <button className="sidebar-collapse" type="button" aria-label={sidebarCollapsed ? "Expand recruiter navigation" : "Collapse recruiter navigation"} aria-pressed={sidebarCollapsed} onClick={toggleRecruiterSidebar}><Icon name={sidebarCollapsed ? "menu" : "close"} size={18}/></button>}</div>
      <div className="sidebar-scroll"><nav aria-label={`${workspace} navigation`}>{navigation[workspace].map((item) => <NavLink workspace={workspace} item={item} active={active} compact={workspace === "recruiter" && sidebarCollapsed} key={item.id}/>)}</nav></div>
    </aside>}

    <main className="workspace-main" id="workspace-content" tabIndex={-1}>
      {(title || description || actions) && <div className="page-heading"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="heading-actions">{actions}</div>}</div>}
      <LiveUpdateNotice workspace={workspace}/>{children}
    </main>

    {workspace !== "admin" && <nav className="workspace-mobile-nav" aria-label={`${workspace} mobile navigation`}>{mobileNavigation[workspace].map((item) => <NavLink workspace={workspace} item={item} active={active} key={item.id}/>)}</nav>}
  </div>;
}

export function StatCard({ label, value, change, tone = "blue", icon }: { label: string; value: string; change?: string; tone?: "blue" | "green" | "amber" | "rose" | "purple"; icon?: string }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span>{icon && <b className={`stat-icon stat-icon-${tone}`}>{icon}</b>}</div><strong>{value}</strong>{change && <small className={change.startsWith("+") ? "positive" : "muted"}>{change}</small>}</article>;
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <div className="section-title"><div>{eyebrow && <p>{eyebrow}</p>}<h2>{title}</h2></div>{action}</div>;
}

export function EmptyState({ icon, title, copy, action }: { icon: string; title: string; copy: string; action: ReactNode }) {
  return <div className="empty-state editorial-empty-state"><span className="editorial-empty-icon">{icon}</span><h3>{title}</h3><p>{copy}</p>{action}</div>;
}

export function GuardedActionDialog({ open, title, description, actionLabel, danger = false, requireReason = true, busy = false, onCancel, onConfirm }: { open: boolean; title: string; description: string; actionLabel: string; danger?: boolean; requireReason?: boolean; busy?: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (!open) setReason(""); }, [open]);
  if (!open) return null;
  const valid = !requireReason || reason.trim().length >= 3;
  return <div className="guarded-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className="guarded-dialog" role="dialog" aria-modal="true" aria-labelledby="guarded-dialog-title" aria-describedby="guarded-dialog-description">
      <div><h2 id="guarded-dialog-title">{title}</h2><p id="guarded-dialog-description">{description}</p></div>
      {requireReason && <label>Reason <textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Add a clear reason for the audit trail" rows={4}/><small>Required. This reason may be stored in the audit record.</small></label>}
      <div className="guarded-dialog-actions"><Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button><Button variant={danger ? "danger" : "primary"} onClick={() => onConfirm(reason.trim())} disabled={!valid || busy}>{busy ? "Working…" : actionLabel}</Button></div>
    </section>
  </div>;
}
