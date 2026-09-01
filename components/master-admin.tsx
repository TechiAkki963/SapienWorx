"use client";

import { useEffect, useState, type ReactNode } from "react";
import { apiBaseUrl, apiClient } from "../lib/api-client";
import { Badge, Button, SectionTitle, StatCard, WorkspaceShell, useHydrated } from "./ui";
import { MasterGovernancePanel, type MasterGovernanceState } from "./master-governance";
import { AccountSecurity } from "./account-security";

type Controls = { maintenanceMode: boolean; candidateSignupEnabled: boolean; recruiterSignupEnabled: boolean; cvParsingEnabled: boolean; campaignsEnabled: boolean; updatedAt: string; updatedBy: string; lastChangeReason: string };
type Queue = { label: string; name: string; group: string; messages: number; consumers: number; available: boolean; health: "HEALTHY" | "DEGRADED" | "UNSTAFFED" | "BLOCKED" | "UNAVAILABLE"; healthSummary: string; requiresAttention: boolean };
type User = { id: string; type: "CANDIDATE" | "RECRUITER"; name: string; email: string; organisation: string; status: string; verified: boolean; suspended: boolean; passwordResetRequired: boolean; reason: string };
type Organisation = { id: string; name: string; workEmailDomain: string; recruiters: number; pendingRecruiterReviews: number; activeJobs: number; suspended: boolean; postingLimit: number; reason: string };
type Job = { id: string; publicJobId: string; title: string; organisation: string; accountableRecruiter: string; status: "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED"; applicants: number; updatedAt: string };
type Ticket = { id: string; subjectType: string; subjectLabel: string; summary: string; priority: string; status: string; ownerAdminId: string; owner: string; createdAt: string; dueAt: string; updatedAt: string; resolvedAt: string };
type PrivacyCase = { candidateId: string; candidate: string; type: "EXPORT" | "ERASURE"; requestedAt: string; status: string; reviewedAt: string; reviewedBy: string; reviewNote: string };
type Activity = { id: string; action: string; resourceType: string; resourceId: string; jobId: string; occurredAt: string; actorId: string; actor: string };
type KnowledgePost = { id: string; slug: string; title: string; category: string; excerpt: string; body: string; heroTone: "navy" | "blue" | "purple" | "sage" | "terracotta"; featured: boolean; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; authorName: string; lastEditorialNote: string; readingMinutes: number; createdAt: string; updatedAt: string; publishedAt: string };
type UserActivityEvent = { id: string; action: string; label: string; description: string; category: string; risk: "LOW" | "MEDIUM" | "HIGH"; occurredAt: string; actor: string; actorRelationship: string; resourceType: string; jobId: string };
type UserActivityInvestigation = {
  investigation: { id: string; purpose: string; reason: string; openedAt: string; accessExpiresAt: string; rangeDays: number };
  subject: { id: string; type: User["type"]; name: string; maskedEmail: string; organisation: string; status: string; verified: boolean; lastActiveAt: string };
  summary: { events: number; elevatedSignals: number; activeSessions: number; applications: number; lastSeenAt: string; categoryCounts: Record<string, number> };
  sessions: Array<{ id: string; deviceName: string; locationHint: string; trusted: boolean; active: boolean; createdAt: string; lastSeenAt: string; expiresAt: string }>;
  events: UserActivityEvent[];
  privacyNotice: string;
};
type BreachIncident = { id: string; status: "OPEN" | "ASSESSING" | "NOTIFIED" | "CONTAINED" | "CLOSED"; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; summary: string; affectedSubjectCount: number; detectedAt: string; boardNotificationDueAt: string; affectedPeopleNotifiedAt: string; boardNotifiedAt: string; notes: string };
type Dashboard = { candidates: number; recruiters: number; organisations: number; jobs: number; applications: number; auditEvents: number; activeJobs: number; openSupportTickets: number; privacyRequests: number; deadLetters: number; attentionQueues: number; blockedQueues: number; platformHealth: "HEALTHY" | "ATTENTION" | "CRITICAL" };
type Tab = string;
type ControlKey = "maintenanceMode" | "candidateSignupEnabled" | "recruiterSignupEnabled" | "cvParsingEnabled" | "campaignsEnabled";
type MasterState = { dashboard: Dashboard; controls: Controls; users: User[]; organisations: Organisation[]; jobs: Job[]; queues: Queue[]; activity: Activity[]; tickets: Ticket[]; privacyCases: PrivacyCase[]; quality: Record<string, unknown>; security: Record<string, unknown>; breaches: BreachIncident[]; governance: MasterGovernanceState; knowledgePosts: KnowledgePost[] };

const normaliseQueue = (queue: Queue): Queue => {
  const health = queue.health ?? (!queue.available ? "UNAVAILABLE" : queue.messages > 0 && queue.consumers === 0 ? "BLOCKED" : queue.group === "DEAD_LETTER" && queue.messages > 0 ? "DEGRADED" : "HEALTHY");
  return {
    ...queue,
    health,
    requiresAttention: queue.requiresAttention ?? health !== "HEALTHY",
    healthSummary: queue.healthSummary ?? (health === "BLOCKED" ? `${queue.messages} messages are waiting with no worker available to process them.` : health === "UNAVAILABLE" ? "The broker could not report this queue." : health === "DEGRADED" ? "Messages need operational review." : "Queue is ready."),
  };
};

const normaliseDashboard = (dashboard: Dashboard, queues: Queue[]): Dashboard => {
  const attentionQueues = dashboard.attentionQueues ?? queues.filter((queue) => queue.requiresAttention).length;
  const blockedQueues = dashboard.blockedQueues ?? queues.filter((queue) => queue.health === "BLOCKED" || queue.health === "UNAVAILABLE").length;
  const platformHealth = dashboard.platformHealth ?? (blockedQueues > 0 ? "CRITICAL" : attentionQueues > 0 ? "ATTENTION" : "HEALTHY");
  return { ...dashboard, applications: dashboard.applications ?? 0, attentionQueues, blockedQueues, platformHealth };
};

const labels: Record<Tab, string> = { overview: "Platform overview", access: "Users & access", governance: "Organisations & jobs", operations: "Service operations", support: "Support & privacy", assurance: "Security & reports", knowledge: "Knowledge Hub", advanced: "Advanced controls", notifications: "Notifications", settings: "Settings", help: "Help centre", search: "Platform search" };
const hashTabs: Record<string, Tab> = { "#users": "access", "#governance": "governance", "#operations": "operations", "#support": "support", "#assurance": "assurance", "#knowledge": "knowledge", "#advanced": "advanced", "#notifications": "notifications", "#settings": "settings", "#help": "help", "#search": "search" };
const activeNavigation: Record<Tab, string> = { overview: "dashboard", access: "users", governance: "organisations", operations: "operations", support: "support", assurance: "assurance", knowledge: "knowledge", advanced: "advanced", notifications: "notifications", settings: "settings", help: "help", search: "search" };
const controlsHelp: Record<ControlKey, [string, string]> = {
  maintenanceMode: ["Maintenance mode", "Pauses candidate, recruiter, and public job API access while Master Access remains available."],
  candidateSignupEnabled: ["Candidate sign-up", "Allows candidate registration and OTP verification."],
  recruiterSignupEnabled: ["Recruiter sign-up", "Allows recruiter and consultant registration."],
  cvParsingEnabled: ["CV parsing", "Allows CV uploads to enter the parser queue; manual profile completion stays available."],
  campaignsEnabled: ["Campaigns & recruiter email", "Allows recruiter campaigns, launch, and email dispatch."],
};
const pretty = (value: string) => value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
const date = (value: string) => value ? new Date(value).toLocaleString() : "Not recorded";
const sectionDescription = (tab: Tab) => ({
  overview: "Live platform health, risk, and guarded controls at a glance.",
  access: "Cross-tenant identities, verification state, and account protection.",
  governance: "Organisation policy, accountable ownership, and job moderation.",
  operations: "Truthful queue readiness, worker coverage, and controlled recovery.",
  support: "Owned service cases and evidence-led privacy operations.",
  assurance: "Readable security posture, data quality, and immutable activity.",
  knowledge: "Draft, review, publish, and archive practical guidance shown on the public Knowledge Hub.",
  advanced: "Role-aware approvals, releases, integrations, billing, and policy.",
  notifications: "Operational signals that still need acknowledgement or resolution.",
  settings: "Master identity, active sessions, and control-plane preferences.",
  help: "Safe operating guidance for routine and emergency platform work.",
  search: "One search across the platform directory and audit trail.",
}[tab] ?? "Protected platform operations.");
const controlReason = (message: string) => {
  const reason = window.prompt(`${message}\n\nRecord a business reason or support-ticket reference:`)?.trim();
  if (!reason) return null;
  return window.confirm("Confirm this high-impact change? It will take effect immediately and be recorded in Master Access.") ? reason : null;
};

export function MasterAdminLogin() {
  const hydrated = useHydrated();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [transaction, setTransaction] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [requesting, setRequesting] = useState(false);
  const requestOtp = async () => {
    const nextErrors: { email?: string; password?: string } = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) nextErrors.email = "Enter the approved Master Admin email address.";
    if (password.length < 8) nextErrors.password = "Enter your password (at least 8 characters).";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) { setError("Check the highlighted details before continuing."); return; }
    try {
      setRequesting(true); setError("");
      const response = await apiClient<{ transactionId: string }>("/api/auth/request-otp", { method: "POST", body: JSON.stringify({ flow: "SIGN_IN", role: "SUPER_ADMIN", email: email.trim(), password }) });
      setTransaction(response.transactionId);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The request could not be completed."); }
    finally { setRequesting(false); }
  };
  const verifyOtp = async () => {
    try {
      const response = await apiClient<{ authenticated: boolean; redirectTo: string }>("/api/auth/verify-otp", { method: "POST", body: JSON.stringify({ transactionId: transaction, channel: "EMAIL", code }) });
      if (response.authenticated) window.location.assign(response.redirectTo);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The verification could not be completed."); }
  };
  const form = transaction ? <div className="auth-form"><label className="auth-field"><span>Email OTP</span><input aria-label="Email OTP" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label><Button onClick={() => void verifyOtp()} disabled={code.length !== 6}>Verify and open Master Access</Button></div> : <div className="auth-form"><label className="auth-field"><span>Master email</span><input aria-label="Master email" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "master-email-error" : undefined} type="email" value={email} onChange={(event) => { setEmail(event.target.value); setFieldErrors((current) => ({ ...current, email: undefined })); setError(""); }} />{fieldErrors.email && <small className="auth-field-error" id="master-email-error">{fieldErrors.email}</small>}</label><label className="auth-field"><span>Password</span><input aria-label="Password" aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "master-password-error" : undefined} type="password" value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: undefined })); setError(""); }} />{fieldErrors.password && <small className="auth-field-error" id="master-password-error">{fieldErrors.password}</small>}</label><Button onClick={() => void requestOtp()} disabled={requesting}>{requesting ? "Preparing secure verification…" : "Continue to OTP →"}</Button><p className="auth-microcopy">Locked out? Use the approved account-recovery process or contact platform security. Master Access never uses a bypass code.</p></div>;
  return <main className="auth-page"><section className="auth-layout"><div className="auth-aside"><span className="auth-aside-kicker">Sapienworx control plane</span><h1>Master <em>Access</em></h1><p>Platform-wide operations are protected with password, OTP verification, and an immutable activity trail.</p></div><section className="auth-card" aria-busy={!hydrated}><span className="eyebrow">Super admin only</span><h1>Open the control plane</h1><p className="auth-copy">Manage service health, safety, support, and compliance from one protected workspace.</p>{hydrated ? form : <div className="auth-hydration-state" role="status"><span aria-hidden="true"/>Preparing your secure form…</div>}{error && <p className="consent-error" role="alert">{error}</p>}</section></section></main>;
}

export function MasterAdminConsole() {
  const [tab, setTab] = useState<Tab>("overview");
  const [state, setState] = useState<MasterState | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState({ subjectType: "CANDIDATE", subjectLabel: "", summary: "", details: "", priority: "NORMAL" });

  const load = async () => {
    try {
      setLoading(true); setError("");
      const [dashboard, controls, users, organisations, jobs, queues, activity, tickets, privacyCases, quality, security, breaches, governance, knowledgePosts] = await Promise.all([
        apiClient<Dashboard>("/api/admin/master/dashboard"), apiClient<Controls>("/api/admin/master/controls"), apiClient<User[]>("/api/admin/master/users"),
        apiClient<Organisation[]>("/api/admin/master/organisations"), apiClient<Job[]>("/api/admin/master/jobs"), apiClient<Queue[]>("/api/admin/master/queues"),
        apiClient<Activity[]>("/api/admin/master/activity"), apiClient<Ticket[]>("/api/admin/master/support-tickets"), apiClient<PrivacyCase[]>("/api/admin/master/privacy-cases"),
        apiClient<Record<string, unknown>>("/api/admin/master/data-quality"), apiClient<Record<string, unknown>>("/api/admin/master/security"), apiClient<BreachIncident[]>("/api/admin/master/breaches").catch(() => []), apiClient<MasterGovernanceState>("/api/admin/governance"), apiClient<KnowledgePost[]>("/api/admin/master/knowledge-posts"),
      ]);
      const normalisedQueues = queues.map(normaliseQueue);
      setState({ dashboard: normaliseDashboard(dashboard, normalisedQueues), controls, users, organisations, jobs, queues: normalisedQueues, activity, tickets, privacyCases, quality, security, breaches, governance, knowledgePosts });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Master access is required."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => { const sync = () => setTab(hashTabs[window.location.hash] ?? "overview"); sync(); window.addEventListener("hashchange", sync); return () => window.removeEventListener("hashchange", sync); }, []);
  const mutate = async (path: string, init: RequestInit, message: string) => {
    try { setError(""); setNotice(""); await apiClient<unknown>(path, init); setNotice(message); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The request could not be completed."); }
  };
  const openTab = (next: Tab) => {
    setTab(next);
    const hash = Object.entries(hashTabs).find(([, value]) => value === next)?.[0] ?? "";
    window.history.pushState(null, "", hash || "/admin");
  };
  const searchPlatform = (value: string) => {
    setFilter(value);
    if (value.trim()) {
      setTab("search");
      window.history.replaceState(null, "", "#search");
    }
  };
  const controlSubject = (type: string, id: string, update: Record<string, unknown>, message: string) => void mutate(`/api/admin/master/subjects/${type}/${id}`, { method: "PUT", body: JSON.stringify(update) }, message);
  const setControl = (key: ControlKey) => {
    if (!state) return;
    if (!(key in controlsHelp)) return;
    const nextValue = !state.controls[key];
    const reason = controlReason(`${nextValue ? "Enable" : "Disable"} ${controlsHelp[key][0]}?`);
    if (!reason) return;
    void mutate("/api/admin/master/controls", { method: "PUT", body: JSON.stringify({ [key]: nextValue, reason }) }, `${controlsHelp[key][0]} updated.`);
  };
  let content: ReactNode = <p className="workflow-loading">Loading protected operational data…</p>;
  if (state) {
    if (tab === "overview") content = <Overview state={state} onControl={setControl} onOpen={openTab} />;
    if (tab === "access") content = <Access users={state.users.filter((user) => `${user.name} ${user.email} ${user.type} ${user.organisation}`.toLowerCase().includes(filter.toLowerCase()))} onControl={controlSubject} />;
    if (tab === "governance") content = <Governance organisations={state.organisations.filter((item) => `${item.name} ${item.workEmailDomain}`.toLowerCase().includes(filter.toLowerCase()))} jobs={state.jobs.filter((item) => `${item.title} ${item.organisation} ${item.publicJobId} ${item.accountableRecruiter}`.toLowerCase().includes(filter.toLowerCase()))} onControl={controlSubject} onJob={(id, status, reason) => void mutate(`/api/admin/master/jobs/${id}`, { method: "PATCH", body: JSON.stringify({ status, reason }) }, `Job status changed to ${pretty(status)}.`)} />;
    if (tab === "operations") content = <Operations queues={state.queues} onRetry={() => { if (window.confirm("Replay one CV parser dead-letter message? Only a safely decoded message will be replayed.")) void mutate("/api/admin/master/queues/cv-dlq/retry-one", { method: "POST" }, "CV parser replay attempted."); }} />;
    if (tab === "support") content = <Support tickets={state.tickets} privacyCases={state.privacyCases} currentAdminId={state.governance.currentAdmin.id} ticket={ticket} setTicket={setTicket} onCreate={() => { if (!ticket.subjectLabel.trim() || !ticket.summary.trim()) { setError("Enter a subject and support summary."); return; } void mutate("/api/admin/master/support-tickets", { method: "POST", body: JSON.stringify(ticket) }, "Support ticket created."); setTicket({ subjectType: "CANDIDATE", subjectLabel: "", summary: "", details: "", priority: "NORMAL" }); }} onTicket={(id, update) => void mutate(`/api/admin/master/support-tickets/${id}`, { method: "PATCH", body: JSON.stringify(update) }, "Support ticket updated.")} onPrivacy={(candidateId, type, status, reviewNote) => void mutate(`/api/admin/master/privacy-cases/${candidateId}/${type}`, { method: "PATCH", body: JSON.stringify({ status, reviewNote }) }, "Privacy case updated.")} />;
    if (tab === "assurance") content = <Assurance activity={state.activity.filter((item) => `${item.action} ${item.resourceType} ${item.resourceId} ${item.jobId} ${item.actor}`.toLowerCase().includes(filter.toLowerCase()))} quality={state.quality} security={state.security} breaches={state.breaches} onBreach={(path, init, message) => void mutate(path, init, message)} />;
    if (tab === "knowledge") content = <KnowledgeHubAdmin posts={state.knowledgePosts.filter((post) => `${post.title} ${post.category} ${post.status} ${post.authorName}`.toLowerCase().includes(filter.toLowerCase()))} onRefresh={load} />;
    if (tab === "advanced") content = <MasterGovernancePanel data={state.governance} onRefresh={load} />;
    if (tab === "notifications") content = <Notifications state={state} onOpen={openTab} />;
    if (tab === "settings") content = <AdminSettings state={state} onOpen={openTab} />;
    if (tab === "help") content = <AdminHelp onOpen={openTab} />;
    if (tab === "search") content = <AdminSearch query={filter} state={state} onOpen={openTab} />;
  }
  return <WorkspaceShell workspace="admin" active={activeNavigation[tab] ?? "dashboard"} title="Master Access" description="The protected operations centre for platform safety, service health, support, and compliance." globalSearch={{ value: filter, onChange: searchPlatform, placeholder: "Search users, organisations, jobs, or audit events" }} actions={<><Button variant="secondary" onClick={() => void load()}>{loading ? "Refreshing…" : "Refresh"}</Button><Button variant="secondary" onClick={() => { if (window.confirm("Download the cross-platform operational report? This export will be recorded by your browser and must remain inside approved systems.")) window.open(`${apiBaseUrl}/api/admin/master/reports/platform.csv`, "_blank", "noopener,noreferrer"); }}>Download report</Button></>}><main className="workflow-page master-console">{error && <p className="workflow-error" role="alert">{error}</p>}{notice && <p className="workflow-notice" role="status">{notice}</p>}<section className="master-section-heading"><span>{tab === "overview" ? "Control plane" : "Master Access"}</span><h2>{labels[tab] ?? labels.overview}</h2><p>{sectionDescription(tab)}</p></section>{content}</main></WorkspaceShell>;
}

function Overview({ state, onControl, onOpen }: { state: MasterState; onControl: (key: ControlKey) => void; onOpen: (tab: Tab) => void }) {
  const healthTone = state.dashboard.platformHealth === "HEALTHY" ? "green" : state.dashboard.platformHealth === "CRITICAL" ? "rose" : "amber";
  return <><section className={`master-health-banner master-health-${state.dashboard.platformHealth.toLowerCase()}`}><div><span>Live operational state</span><h3>{state.dashboard.platformHealth === "HEALTHY" ? "All monitored services are ready" : state.dashboard.platformHealth === "CRITICAL" ? "Immediate operational attention is required" : "Some services need attention"}</h3><p>{state.dashboard.attentionQueues} queue{state.dashboard.attentionQueues === 1 ? "" : "s"} need attention · {state.dashboard.blockedQueues} blocked or unavailable · {state.dashboard.deadLetters} dead-letter messages</p></div><Badge tone={healthTone}>{pretty(state.dashboard.platformHealth)}</Badge><button className="master-link" onClick={() => onOpen("operations")}>Inspect operations →</button></section><section className="stat-grid"><StatCard label="Candidates" value={String(state.dashboard.candidates)} icon="♙" tone="blue" /><StatCard label="Recruiters" value={String(state.dashboard.recruiters)} icon="◫" tone="purple" /><StatCard label="Active jobs" value={String(state.dashboard.activeJobs)} icon="▤" tone="green" /><StatCard label="Applications" value={String(state.dashboard.applications)} icon="⇄" tone="amber" /></section><section className="workflow-grid workflow-two"><article className="panel workflow-list"><SectionTitle eyebrow="Service health" title="Operational pulse" action={<button className="master-link" onClick={() => onOpen("notifications")}>Open notifications →</button>} /><article><div><b>{state.dashboard.openSupportTickets} open support tickets</b><p>Cases that still need an owner or resolution.</p></div><Badge tone={state.dashboard.openSupportTickets ? "amber" : "green"}>Support</Badge></article><article><div><b>{state.dashboard.privacyRequests} privacy cases in progress</b><p>Candidate export and erasure requests remain reviewable.</p></div><Badge tone={state.dashboard.privacyRequests ? "purple" : "green"}>Compliance</Badge></article><article><div><b>{state.dashboard.attentionQueues} queues need attention</b><p>Readiness includes worker coverage and backlog—not only queue existence.</p></div><Badge tone={healthTone}>{pretty(state.dashboard.platformHealth)}</Badge></article></article><article className="panel workflow-list"><SectionTitle eyebrow="Guarded controls" title="Platform switches" />{(Object.keys(controlsHelp) as ControlKey[]).map((key) => <label className="privacy-toggle master-control" key={key}><input type="checkbox" checked={state.controls[key]} onChange={() => onControl(key)} /><span><b>{controlsHelp[key][0]}</b><small>{controlsHelp[key][1]}</small></span></label>)}{state.controls.lastChangeReason && <div className="master-control-evidence"><b>Latest platform-wide change</b><p>{state.controls.lastChangeReason}</p><small>{date(state.controls.updatedAt)}</small></div>}</article></section><section className="workflow-grid workflow-two"><article className="panel workflow-list"><SectionTitle eyebrow="Immutable oversight" title="Recent platform activity" action={<button className="master-link" onClick={() => onOpen("assurance")}>Open audit centre →</button>} />{state.activity.slice(0, 8).map((item) => <article key={item.id}><div><b>{pretty(item.action)}</b><p>{item.actor} · {pretty(item.resourceType)} · {date(item.occurredAt)}</p></div></article>)}</article><article className="panel workflow-list"><SectionTitle eyebrow="Quick actions" title="Master workflows" />{[["Users & access", "Suspend, reset, and revoke sessions", "access"], ["Organisation governance", "Set job limits and moderate postings", "governance"], ["Support & privacy", "Resolve service and data-rights cases", "support"] as const].map(([title, copy, target]) => <article key={title}><div><b>{title}</b><p>{copy}</p></div><button className="master-link" onClick={() => onOpen(target)}>Open →</button></article>)}</article></section></>;
}

function Access({ users, onControl }: { users: User[]; onControl: (type: string, id: string, update: Record<string, unknown>, message: string) => void }) {
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [reviewUser, setReviewUser] = useState<User | null>(null);
  const [investigation, setInvestigation] = useState<UserActivityInvestigation | null>(null);
  const [investigationForm, setInvestigationForm] = useState({ purpose: "SUPPORT", reason: "", rangeDays: 30 });
  const [investigationError, setInvestigationError] = useState("");
  const [investigationLoading, setInvestigationLoading] = useState(false);
  const [activityCategory, setActivityCategory] = useState("ALL");
  const [activityRisk, setActivityRisk] = useState("ALL");
  useEffect(() => {
    if (!investigation) return;
    const remaining = new Date(investigation.investigation.accessExpiresAt).getTime() - Date.now();
    if (remaining <= 0) { setInvestigation(null); setInvestigationError("This activity review expired. Record a new reason to reopen it."); return; }
    const timeout = window.setTimeout(() => { setInvestigation(null); setInvestigationError("This activity review expired. Record a new reason to reopen it."); }, remaining);
    return () => window.clearTimeout(timeout);
  }, [investigation]);
  const filtered = users.filter((user) => (type === "ALL" || user.type === type)
    && (status === "ALL" || status === "SUSPENDED" && user.suspended || status === "RESET" && user.passwordResetRequired || status === "UNVERIFIED" && !user.verified));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const visible = filtered.slice((Math.min(page, pages) - 1) * 10, Math.min(page, pages) * 10);
  const act = (user: User, update: Record<string, unknown>, label: string, message: string) => {
    const reason = controlReason(`${label} ${user.name}?`);
    if (reason) onControl(user.type, user.id, { ...update, reason }, message);
  };
  const prepareInvestigation = (user: User) => {
    setReviewUser(user); setInvestigation(null); setInvestigationError(""); setActivityCategory("ALL"); setActivityRisk("ALL");
    setInvestigationForm({ purpose: "SUPPORT", reason: "", rangeDays: 30 });
  };
  const openInvestigation = async () => {
    if (!reviewUser) return;
    if (investigationForm.reason.trim().length < 10) { setInvestigationError("Add a meaningful reason or ticket reference of at least 10 characters."); return; }
    try {
      setInvestigationLoading(true); setInvestigationError("");
      const result = await apiClient<UserActivityInvestigation>(`/api/admin/master/user-activity/${reviewUser.type}/${reviewUser.id}/investigate`, {
        method: "POST", body: JSON.stringify(investigationForm),
      });
      setInvestigation(result);
    } catch (reason) { setInvestigationError(reason instanceof Error ? reason.message : "The activity review could not be opened."); }
    finally { setInvestigationLoading(false); }
  };
  const visibleEvents = investigation?.events.filter((event) => (activityCategory === "ALL" || event.category === activityCategory)
    && (activityRisk === "ALL" || event.risk === activityRisk)) ?? [];
  return <div className="master-stack"><section className="panel workflow-list master-wide-list"><SectionTitle eyebrow="Cross-tenant directory" title={`${filtered.length} of ${users.length} users`} /><div className="master-list-tools"><label><span>Account type</span><select aria-label="Filter by account type" value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}><option value="ALL">All users</option><option value="CANDIDATE">Candidates</option><option value="RECRUITER">Recruiters</option></select></label><label><span>Access state</span><select aria-label="Filter by access state" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="ALL">All states</option><option value="SUSPENDED">Suspended</option><option value="RESET">Password reset required</option><option value="UNVERIFIED">Verification pending</option></select></label></div>{visible.map((user) => <article key={`${user.type}-${user.id}`}><div><div className="master-row-title"><b>{user.name}</b><Badge tone={user.type === "CANDIDATE" ? "blue" : "purple"}>{pretty(user.type)}</Badge>{user.suspended && <Badge tone="rose">Suspended</Badge>}{user.passwordResetRequired && <Badge tone="amber">Reset required</Badge>}</div><p>{user.email} · {user.organisation}</p><small>{pretty(user.status)} · {user.verified ? "Identity verified" : "Verification pending"}{user.reason ? ` · Last control: ${user.reason}` : ""}</small></div><div className="workflow-list-actions"><Button variant="quiet" onClick={() => prepareInvestigation(user)}>Review activity</Button>{user.suspended ? <Button variant="secondary" onClick={() => act(user, { suspended: false }, "Restore access for", "Account restored.")}>Restore</Button> : <Button variant="danger" onClick={() => act(user, { suspended: true }, "Suspend", "Account suspended and access blocked.")}>Suspend</Button>}<Button variant="secondary" onClick={() => act(user, { passwordResetRequired: !user.passwordResetRequired }, user.passwordResetRequired ? "Clear the password-reset requirement for" : "Require a password reset for", user.passwordResetRequired ? "Password reset requirement cleared." : "Password reset requirement recorded.")}>{user.passwordResetRequired ? "Clear reset" : "Require reset"}</Button><Button variant="quiet" onClick={() => act(user, { revokeSessions: true }, "Revoke every active session for", "All current sessions revoked.")}>Revoke sessions</Button></div></article>)}{!visible.length && <div className="workflow-empty"><span>⌕</span><p>No users match the current search and access filters.</p></div>}<Pagination page={Math.min(page, pages)} pages={pages} onPage={setPage} /></section>{reviewUser && !investigation && <section className="panel master-investigation-request" aria-label="Activity review request"><SectionTitle eyebrow="Purpose-limited access" title={`Review ${reviewUser.name}’s activity`} action={<button className="master-link" onClick={() => setReviewUser(null)}>Cancel</button>} /><div className="master-privacy-callout"><b>Private content stays private</b><p>This review contains operational metadata only. OTPs, passwords, messages, CV contents, contact values, and raw search text are excluded.</p></div>{investigationError && <p className="workflow-error" role="alert">{investigationError}</p>}<div className="master-investigation-form"><label><span>Purpose</span><select aria-label="Investigation purpose" value={investigationForm.purpose} onChange={(event) => setInvestigationForm({ ...investigationForm, purpose: event.target.value })}><option value="SUPPORT">Support case</option><option value="SECURITY">Security investigation</option><option value="COMPLIANCE">Compliance review</option><option value="ACCOUNT_REVIEW">Account review</option></select></label><label><span>Time range</span><select aria-label="Activity time range" value={investigationForm.rangeDays} onChange={(event) => setInvestigationForm({ ...investigationForm, rangeDays: Number(event.target.value) })}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label><label className="span-all"><span>Reason or ticket reference</span><textarea aria-label="Investigation reason" value={investigationForm.reason} onChange={(event) => setInvestigationForm({ ...investigationForm, reason: event.target.value })} placeholder="Example: SUP-1842 — investigate repeated login and application-routing complaint" /></label><div className="master-investigation-consent span-all"><span>◷</span><p>Opening this review creates immutable evidence and grants access for 15 minutes.</p></div><Button onClick={() => void openInvestigation()} disabled={investigationLoading}>{investigationLoading ? "Opening protected review…" : "Open 15-minute activity review"}</Button></div></section>}{investigation && <UserActivityReview data={investigation} category={activityCategory} risk={activityRisk} visibleEvents={visibleEvents} onCategory={setActivityCategory} onRisk={setActivityRisk} onClose={() => { setInvestigation(null); setReviewUser(null); }} />}</div>;
}

function UserActivityReview({ data, category, risk, visibleEvents, onCategory, onRisk, onClose }: { data: UserActivityInvestigation; category: string; risk: string; visibleEvents: UserActivityEvent[]; onCategory: (value: string) => void; onRisk: (value: string) => void; onClose: () => void }) {
  const categories = Object.keys(data.summary.categoryCounts);
  return <section className="panel master-activity-review" aria-label="User activity investigation"><header className="master-investigation-header"><div><span className="eyebrow">User Activity &amp; Investigations</span><h2>{data.subject.name}</h2><p>{data.subject.maskedEmail} · {data.subject.organisation} · {pretty(data.subject.type)}</p></div><div className="master-investigation-access"><Badge tone="amber">Purpose: {pretty(data.investigation.purpose)}</Badge><small>Access closes {date(data.investigation.accessExpiresAt)}</small><button className="master-link" onClick={onClose}>Close review</button></div></header><div className="master-privacy-callout protected"><b>Protected, content-free timeline</b><p>{data.privacyNotice}</p><small>Reason: {data.investigation.reason} · Evidence ID {data.investigation.id}</small></div><div className="master-investigation-stats"><div><span>Events</span><strong>{data.summary.events}</strong><small>Last {data.investigation.rangeDays} days</small></div><div><span>Elevated signals</span><strong>{data.summary.elevatedSignals}</strong><small>Review context before acting</small></div><div><span>Active sessions</span><strong>{data.summary.activeSessions}</strong><small>Last seen {date(data.summary.lastSeenAt)}</small></div><div><span>Applications</span><strong>{data.summary.applications}</strong><small>Candidate or owned jobs</small></div></div><div className="master-activity-layout"><section className="master-activity-timeline"><div className="master-list-tools master-activity-tools"><label><span>Event category</span><select aria-label="Filter activity category" value={category} onChange={(event) => onCategory(event.target.value)}><option value="ALL">All categories</option>{categories.map((item) => <option value={item} key={item}>{pretty(item)} ({data.summary.categoryCounts[item]})</option>)}</select></label><label><span>Signal level</span><select aria-label="Filter activity risk" value={risk} onChange={(event) => onRisk(event.target.value)}><option value="ALL">All signals</option><option value="HIGH">Elevated</option><option value="MEDIUM">Review</option><option value="LOW">Routine</option></select></label></div><div className="master-timeline-list">{visibleEvents.map((event) => <article key={event.id}><span className={`master-timeline-dot risk-${event.risk.toLowerCase()}`} aria-hidden="true"/><div><div className="master-row-title"><b>{event.label}</b><Badge tone={event.risk === "HIGH" ? "rose" : event.risk === "MEDIUM" ? "amber" : "neutral"}>{event.risk === "HIGH" ? "Elevated" : event.risk === "MEDIUM" ? "Review" : "Routine"}</Badge><Badge tone="blue">{pretty(event.category)}</Badge></div><p>{event.description}</p><small>{date(event.occurredAt)} · {event.actorRelationship}: {event.actor}{event.jobId ? ` · Job ${event.jobId}` : ""}</small></div></article>)}{!visibleEvents.length && <div className="workflow-empty"><span>◌</span><p>No activity matches these filters in the authorised time range.</p></div>}</div></section><aside className="master-session-panel"><h3>Known sessions</h3><p>Device labels and coarse location hints only—never raw IP addresses.</p>{data.sessions.map((session) => <article key={session.id}><div className="master-row-title"><b>{session.deviceName}</b>{session.active && <Badge tone="green">Active</Badge>}{session.trusted && <Badge tone="purple">Trusted</Badge>}</div><p>{session.locationHint}</p><small>Last active {date(session.lastSeenAt)} · expires {date(session.expiresAt)}</small></article>)}{!data.sessions.length && <div className="workflow-empty compact"><span>◷</span><p>No account sessions were recorded.</p></div>}</aside></div></section>;
}

type KnowledgeForm = { title: string; slug: string; category: string; excerpt: string; body: string; heroTone: KnowledgePost["heroTone"]; featured: boolean };
const emptyKnowledgeForm: KnowledgeForm = { title: "", slug: "", category: "Career growth", excerpt: "", body: "", heroTone: "navy", featured: false };

function KnowledgeHubAdmin({ posts, onRefresh }: { posts: KnowledgePost[]; onRefresh: () => Promise<void> }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<KnowledgeForm>(emptyKnowledgeForm);
  const [status, setStatus] = useState("ALL");
  const [editorialNote, setEditorialNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const visiblePosts = posts.filter((post) => status === "ALL" || post.status === status);
  const readMinutes = Math.max(1, Math.ceil(form.body.trim().split(/\s+/).filter(Boolean).length / 220));
  const edit = (post: KnowledgePost) => {
    setEditingId(post.id);
    setForm({ title: post.title, slug: post.slug, category: post.category, excerpt: post.excerpt, body: post.body, heroTone: post.heroTone, featured: post.featured });
    setEditorialNote(post.lastEditorialNote ?? ""); setError(""); setNotice("");
  };
  const save = async () => {
    try {
      setSaving(true); setError(""); setNotice("");
      const post = await apiClient<KnowledgePost>(editingId ? `/api/admin/master/knowledge-posts/${editingId}` : "/api/admin/master/knowledge-posts", {
        method: editingId ? "PUT" : "POST", body: JSON.stringify(form),
      });
      setEditingId(post.id); setForm({ title: post.title, slug: post.slug, category: post.category, excerpt: post.excerpt, body: post.body, heroTone: post.heroTone, featured: post.featured });
      setNotice(editingId ? "Draft changes saved." : "Article draft created."); await onRefresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The article could not be saved."); }
    finally { setSaving(false); }
  };
  const decide = async (post: KnowledgePost, action: "publish" | "archive") => {
    if (editorialNote.trim().length < 10) { setError("Add an editorial note of at least 10 characters before changing publication status."); return; }
    try {
      setSaving(true); setError(""); setNotice("");
      await apiClient<KnowledgePost>(`/api/admin/master/knowledge-posts/${post.id}/${action}`, { method: "POST", body: JSON.stringify({ reason: editorialNote }) });
      setNotice(action === "publish" ? "Article published to the Knowledge Hub." : "Article archived and removed from public pages."); await onRefresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The publication status could not be changed."); }
    finally { setSaving(false); }
  };
  return <div className="knowledge-admin-layout"><section className="panel knowledge-editor"><SectionTitle eyebrow="Editorial desk" title={editingId ? "Edit article" : "Create a considered draft"} action={<button className="master-link" onClick={() => { setEditingId(null); setForm(emptyKnowledgeForm); setEditorialNote(""); setError(""); setNotice(""); }}>New draft</button>} />
    <p>Write in Sapienworx’s practical, human voice. Public pages render plain editorial text—scripts and embedded HTML are never accepted.</p>
    {error && <p className="workflow-error" role="alert">{error}</p>}{notice && <p className="workflow-notice" role="status">{notice}</p>}
    <div className="knowledge-editor-form"><label><span>Article title</span><input aria-label="Article title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="A specific, useful promise to the reader" /></label><label><span>Category</span><input aria-label="Article category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Career growth" /></label><label className="span-all"><span>Public URL</span><input aria-label="Article slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="Generated from the title when left blank" /></label><label className="span-all"><span>Standfirst</span><textarea aria-label="Article summary" value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} placeholder="Summarise what the reader will learn in one or two sentences." /></label><label className="span-all"><span>Article</span><textarea className="knowledge-body-input" aria-label="Article body" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder={"Write clear paragraphs.\n\nUse a blank line to begin a new paragraph."} /></label><label><span>Card colour</span><select aria-label="Article colour" value={form.heroTone} onChange={(event) => setForm({ ...form, heroTone: event.target.value as KnowledgePost["heroTone"] })}><option value="navy">Deep navy</option><option value="blue">Ink blue</option><option value="purple">Muted plum</option><option value="sage">Sage</option><option value="terracotta">Terracotta</option></select></label><label className="knowledge-featured"><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /><span><b>Feature on the home page</b><small>The newest three featured articles appear in the public Knowledge Hub band.</small></span></label><Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : editingId ? "Save article" : "Create draft"}</Button></div>
    {editingId && <div className="knowledge-publish-controls"><label><span>Editorial decision note</span><input aria-label="Editorial decision note" value={editorialNote} onChange={(event) => setEditorialNote(event.target.value)} placeholder="Example: Editorial review complete — claims and links checked" /></label><div><Button onClick={() => { const post = posts.find((item) => item.id === editingId); if (post) void decide(post, "publish"); }} disabled={saving}>Publish</Button><Button variant="danger" onClick={() => { const post = posts.find((item) => item.id === editingId); if (post) void decide(post, "archive"); }} disabled={saving}>Archive</Button></div></div>}
  </section><aside className="knowledge-admin-side"><article className={`knowledge-preview article-${form.heroTone}`}><span>{form.category || "Category"}</span><h3>{form.title || "Your article title will appear here"}</h3><p>{form.excerpt || "A concise editorial summary gives readers a reason to continue."}</p><footer><small>{readMinutes} min read</small><b>Read article →</b></footer></article><section className="panel knowledge-library"><header><div><span className="eyebrow">Publication library</span><h3>{posts.length} articles</h3></div><select aria-label="Filter articles by status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option><option value="DRAFT">Drafts</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></header>{visiblePosts.map((post) => <article key={post.id} className={post.id === editingId ? "selected" : ""}><div><div className="master-row-title"><b>{post.title}</b><Badge tone={post.status === "PUBLISHED" ? "green" : post.status === "ARCHIVED" ? "neutral" : "amber"}>{pretty(post.status)}</Badge>{post.featured && <Badge tone="purple">Home page</Badge>}</div><p>{post.category} · {post.readingMinutes} min read · {post.authorName}</p><small>Updated {date(post.updatedAt)}</small></div><div><button className="master-link" onClick={() => edit(post)}>Edit</button>{post.status === "PUBLISHED" && <a className="master-link" href={`/knowledge/${post.slug}`} target="_blank" rel="noreferrer">View live ↗</a>}</div></article>)}{!visiblePosts.length && <div className="workflow-empty compact"><span>✎</span><p>No articles match this publication status.</p></div>}</section></aside></div>;
}

function Governance({ organisations, jobs, onControl, onJob }: { organisations: Organisation[]; jobs: Job[]; onControl: (type: string, id: string, update: Record<string, unknown>, message: string) => void; onJob: (id: string, status: Job["status"], reason: string) => void }) {
  const [organisationPage, setOrganisationPage] = useState(1);
  const [jobPage, setJobPage] = useState(1);
  const organisationPages = Math.max(1, Math.ceil(organisations.length / 6));
  const jobPages = Math.max(1, Math.ceil(jobs.length / 6));
  const visibleOrganisations = organisations.slice((Math.min(organisationPage, organisationPages) - 1) * 6, Math.min(organisationPage, organisationPages) * 6);
  const visibleJobs = jobs.slice((Math.min(jobPage, jobPages) - 1) * 6, Math.min(jobPage, jobPages) * 6);
  const organisationAction = (item: Organisation, update: Record<string, unknown>, label: string, message: string) => {
    const reason = controlReason(`${label} ${item.name}?`);
    if (reason) onControl("ORGANISATION", item.id, { ...update, reason }, message);
  };
  const moderate = (job: Job, status: Job["status"]) => {
    const reason = controlReason(`${pretty(status)} “${job.title}” for ${job.organisation}?`);
    if (reason) onJob(job.id, status, reason);
  };
  return <div className="master-stack"><section className="panel workflow-list master-wide-list"><SectionTitle eyebrow="Tenant control" title={`${organisations.length} organisations`} />{visibleOrganisations.map((item) => <article key={item.id}><div><div className="master-row-title"><b>{item.name}</b>{item.suspended && <Badge tone="rose">Suspended</Badge>}{item.pendingRecruiterReviews > 0 && <Badge tone="amber">{item.pendingRecruiterReviews} reviews due</Badge>}</div><p>{item.workEmailDomain ? `Verified domain ${item.workEmailDomain}` : "Work-email domain not verified"}</p><small>{item.recruiters} recruiters · {item.activeJobs} active jobs · {item.postingLimit === 0 ? "No posting cap" : `${item.postingLimit} job cap`}{item.reason ? ` · Last control: ${item.reason}` : ""}</small></div><div className="workflow-list-actions">{item.suspended ? <Button variant="secondary" onClick={() => organisationAction(item, { suspended: false }, "Restore", "Organisation restored.")}>Restore</Button> : <Button variant="danger" onClick={() => organisationAction(item, { suspended: true }, "Suspend", "Organisation suspended and recruiter access blocked.")}>Suspend</Button>}<Button variant="secondary" onClick={() => { const value = window.prompt("Job posting limit. Enter 0 for no limit:", String(item.postingLimit)); if (value === null || !/^\d+$/.test(value)) return; organisationAction(item, { postingLimit: Number(value) }, `Set the posting limit to ${value} for`, "Organisation posting limit updated."); }}>Set limit</Button><Button variant="quiet" onClick={() => organisationAction(item, { revokeSessions: true }, "Revoke every recruiter session for", "Organisation sessions revoked.")}>Revoke team sessions</Button></div></article>)}<Pagination page={Math.min(organisationPage, organisationPages)} pages={organisationPages} onPage={setOrganisationPage} /></section><section className="panel workflow-list master-wide-list"><SectionTitle eyebrow="Job governance" title={`${jobs.length} jobs`} />{visibleJobs.map((job) => <article key={job.id}><div><div className="master-row-title"><b>{job.title}</b><Badge tone={job.status === "ACTIVE" ? "green" : job.status === "DRAFT" ? "amber" : "rose"}>{pretty(job.status)}</Badge></div><p>{job.publicJobId} · {job.organisation} · accountable recruiter: {job.accountableRecruiter}</p><small>{job.applicants} applicants · updated {date(job.updatedAt)}</small></div><div className="workflow-list-actions">{job.status !== "ACTIVE" && <Button variant="secondary" onClick={() => moderate(job, "ACTIVE")}>Publish</Button>}{job.status === "ACTIVE" && <Button variant="secondary" onClick={() => moderate(job, "CLOSED")}>Close</Button>}{job.status !== "ARCHIVED" && <Button variant="danger" onClick={() => moderate(job, "ARCHIVED")}>Archive</Button>}</div></article>)}<Pagination page={Math.min(jobPage, jobPages)} pages={jobPages} onPage={setJobPage} /></section></div>;
}

function Operations({ queues, onRetry }: { queues: Queue[]; onRetry: () => void }) {
  const attention = queues.filter((queue) => queue.requiresAttention);
  return <section className="panel workflow-list master-wide-list"><SectionTitle eyebrow="Background queue readiness" title="Queues, workers, and delivery operations" /><div className={`master-operations-summary ${attention.length ? "attention" : "healthy"}`}><b>{attention.length ? `${attention.length} queues need attention` : "All monitored queues are ready"}</b><p>Readiness combines broker availability, connected workers, backlog and dead-letter state.</p></div>{queues.map((queue) => { const tone = queue.health === "HEALTHY" ? "green" : queue.health === "DEGRADED" || queue.health === "UNSTAFFED" ? "amber" : "rose"; return <article key={queue.name}><div><div className="master-row-title"><b>{queue.label}</b><Badge tone={tone}>{pretty(queue.health)}</Badge></div><p>{queue.name} · {queue.messages} waiting · {queue.consumers} connected worker{queue.consumers === 1 ? "" : "s"}</p><small>{queue.healthSummary}</small></div>{queue.name === "cv.parser.dlq" && queue.messages > 0 ? <Button variant="secondary" onClick={onRetry}>Retry one failure</Button> : <Badge tone={queue.group === "DEAD_LETTER" && queue.messages > 0 ? "amber" : "neutral"}>{queue.group === "DEAD_LETTER" && queue.messages > 0 ? "Review required" : pretty(queue.group)}</Badge>}</article>; })}<div className="master-callout"><b>Protected queue handling</b><p>Master Access exposes only operational metadata. OTP values, email content and raw CV data remain unavailable. Replays are controlled and recorded.</p></div></section>;
}

function Support({ tickets, privacyCases, currentAdminId, ticket, setTicket, onCreate, onTicket, onPrivacy }: { tickets: Ticket[]; privacyCases: PrivacyCase[]; currentAdminId: string; ticket: { subjectType: string; subjectLabel: string; summary: string; details: string; priority: string }; setTicket: (value: { subjectType: string; subjectLabel: string; summary: string; details: string; priority: string }) => void; onCreate: () => void; onTicket: (id: string, update: Record<string, unknown>) => void; onPrivacy: (candidateId: string, type: string, status: string, reviewNote: string) => void }) {
  const openTickets = tickets.filter((item) => item.status !== "RESOLVED");
  return <div className="master-stack"><section className="panel master-ticket-form"><SectionTitle eyebrow="Support workspace" title="Open a service case" /><div className="workflow-inline-form"><label><span>Subject type</span><select value={ticket.subjectType} onChange={(event) => setTicket({ ...ticket, subjectType: event.target.value })}><option>CANDIDATE</option><option>RECRUITER</option><option>ORGANISATION</option></select></label><label><span>Priority</span><select value={ticket.priority} onChange={(event) => setTicket({ ...ticket, priority: event.target.value })}><option>LOW</option><option>NORMAL</option><option>HIGH</option><option>URGENT</option></select></label><label className="span-all"><span>Subject</span><input value={ticket.subjectLabel} onChange={(event) => setTicket({ ...ticket, subjectLabel: event.target.value })} placeholder="Name or organisation affected" /></label><label className="span-all"><span>Summary</span><input value={ticket.summary} onChange={(event) => setTicket({ ...ticket, summary: event.target.value })} placeholder="What needs attention?" /></label><label className="span-all"><span>Internal notes</span><textarea value={ticket.details} onChange={(event) => setTicket({ ...ticket, details: event.target.value })} placeholder="Investigation context, customer impact, and relevant ticket references" /></label><Button onClick={onCreate}>Create support ticket</Button></div></section><section className="panel workflow-list master-wide-list"><SectionTitle eyebrow="Case management" title={`${openTickets.length} open of ${tickets.length} support tickets`} />{tickets.map((item) => { const overdue = Boolean(item.dueAt) && new Date(item.dueAt).getTime() < Date.now() && item.status !== "RESOLVED"; return <article key={item.id}><div><div className="master-row-title"><b>{item.summary}</b><Badge tone={item.priority === "HIGH" || item.priority === "URGENT" ? "rose" : "blue"}>{pretty(item.priority)}</Badge><Badge tone={item.status === "RESOLVED" ? "green" : overdue ? "rose" : "amber"}>{item.status === "RESOLVED" ? "Resolved" : overdue ? "SLA overdue" : pretty(item.status)}</Badge></div><p>{pretty(item.subjectType)} · {item.subjectLabel} · owner: {item.owner}</p><small>Opened {date(item.createdAt)} · due {date(item.dueAt)}</small></div><div className="workflow-list-actions">{item.status !== "RESOLVED" && item.ownerAdminId !== currentAdminId && <Button variant="secondary" onClick={() => { if (window.confirm("Assign this support case to yourself?")) onTicket(item.id, { ownerAdminId: currentAdminId }); }}>Assign to me</Button>}{item.status !== "RESOLVED" && <Button variant="secondary" onClick={() => { if (window.confirm("Resolve this support case? Confirm that customer impact and investigation notes are complete.")) onTicket(item.id, { status: "RESOLVED", ownerAdminId: currentAdminId }); }}>Resolve</Button>}</div></article>; })}{!tickets.length && <div className="workflow-empty"><span>♡</span><p>No support tickets are open.</p></div>}</section><section className="panel workflow-list master-wide-list"><SectionTitle eyebrow="DPDP operations" title={`${privacyCases.length} candidate privacy cases`} />{privacyCases.map((item) => <article key={`${item.candidateId}-${item.type}`}><div><div className="master-row-title"><b>{item.candidate}</b><Badge tone={item.type === "ERASURE" ? "rose" : "purple"}>{pretty(item.type)}</Badge><Badge tone={item.status === "COMPLETED" ? "green" : "amber"}>{pretty(item.status)}</Badge></div><p>Requested {date(item.requestedAt)}{item.reviewedBy ? ` · reviewed by ${item.reviewedBy}` : ""}</p>{item.reviewNote && <small>Evidence: {item.reviewNote}</small>}</div><div className="workflow-list-actions">{item.status === "REQUESTED" && <Button variant="secondary" onClick={() => { const note = window.prompt("Record the identity-verification method or reference:")?.trim(); if (note) onPrivacy(item.candidateId, item.type, "IDENTITY_CHECK", note); }}>Start identity check</Button>}{item.status !== "COMPLETED" && <Button variant={item.type === "ERASURE" ? "danger" : "quiet"} onClick={() => { const note = window.prompt("Record the completion evidence or decision reference:")?.trim(); if (note && window.confirm(`${item.type === "ERASURE" ? "Complete this erasure request" : "Complete this export request"}? This decision will be recorded.`)) onPrivacy(item.candidateId, item.type, "COMPLETED", note); }}>Mark complete</Button>}</div></article>)}{!privacyCases.length && <div className="workflow-empty"><span>✓</span><p>No candidate privacy requests are awaiting review.</p></div>}</section></div>;
}

function Assurance({ activity, quality, security, breaches, onBreach }: { activity: Activity[]; quality: Record<string, unknown>; security: Record<string, unknown>; breaches: BreachIncident[]; onBreach: (path: string, init: RequestInit, message: string) => void }) {
  const [form, setForm] = useState({ severity: "MEDIUM", summary: "", affectedSubjectCount: "0", notes: "" });
  const [formError, setFormError] = useState("");
  const submitBreach = () => {
    if (form.summary.trim().length < 10) { setFormError("Add an incident summary of at least 10 characters."); return; }
    setFormError("");
    onBreach("/api/admin/master/breaches", { method: "POST", body: JSON.stringify({ severity: form.severity, summary: form.summary.trim(), affectedSubjectCount: Number(form.affectedSubjectCount) || 0, notes: form.notes.trim() }) }, "Breach incident recorded.");
    setForm({ severity: "MEDIUM", summary: "", affectedSubjectCount: "0", notes: "" });
  };
  const updateBreach = (incident: BreachIncident, update: Record<string, unknown>) => onBreach(`/api/admin/master/breaches/${incident.id}`, { method: "PATCH", body: JSON.stringify(update) }, "Breach incident updated.");
  return <div className="master-stack"><section className="workflow-grid workflow-two"><MetricList eyebrow="Security centre" title="Access posture" values={security} /><MetricList eyebrow="Data quality" title="Actionable checks" values={quality} /></section><section className="panel workflow-list master-wide-list"><SectionTitle eyebrow="Incident response" title={`${breaches.filter((item) => item.status !== "CLOSED").length} open breach incidents`} /><div className="workflow-inline-form"><label><span>Severity</span><select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label><label><span>Affected people</span><input type="number" min="0" value={form.affectedSubjectCount} onChange={(event) => setForm({ ...form, affectedSubjectCount: event.target.value })} /></label><label className="span-all"><span>Incident summary</span><input value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} placeholder="What happened and which service is affected?" /></label><label className="span-all"><span>Response notes</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Containment, notification, and evidence references" /></label>{formError && <small className="auth-field-error span-all">{formError}</small>}<Button onClick={submitBreach}>Record incident</Button></div>{breaches.map((item) => <article key={item.id}><div><div className="master-row-title"><b>{item.summary}</b><Badge tone={item.severity === "CRITICAL" || item.severity === "HIGH" ? "rose" : item.severity === "MEDIUM" ? "amber" : "blue"}>{pretty(item.severity)}</Badge><Badge tone={item.status === "CLOSED" ? "green" : "amber"}>{pretty(item.status)}</Badge></div><p>{item.affectedSubjectCount} affected people · detected {date(item.detectedAt)}</p><small>Board notification due {date(item.boardNotificationDueAt)}{item.notes ? ` · ${item.notes}` : ""}</small></div><div className="workflow-list-actions">{item.status !== "CLOSED" && <Button variant="secondary" onClick={() => updateBreach(item, { status: item.status === "OPEN" ? "ASSESSING" : item.status === "ASSESSING" ? "CONTAINED" : "CLOSED" })}>{item.status === "OPEN" ? "Start assessment" : item.status === "ASSESSING" ? "Mark contained" : "Close incident"}</Button>}</div></article>)}{!breaches.length && <div className="workflow-empty"><span>✓</span><p>No breach incidents have been recorded.</p></div>}</section><section className="panel workflow-list master-wide-list"><SectionTitle eyebrow="Compliance evidence" title={`${activity.length} immutable audit events`} />{activity.map((item) => <article key={item.id}><div><div className="master-row-title"><b>{pretty(item.action)}</b><Badge tone="neutral">Recorded</Badge></div><p>{item.actor} · {pretty(item.resourceType)}{item.resourceId ? ` · ${item.resourceId}` : ""}{item.jobId ? ` · Job ${item.jobId}` : ""}</p><small>{date(item.occurredAt)} · Actor ID {item.actorId}</small></div></article>)}{!activity.length && <div className="workflow-empty"><span>▤</span><p>No audit events match the current platform search.</p></div>}</section></div>;
}

function MetricList({ eyebrow, title, values }: { eyebrow: string; title: string; values: Record<string, unknown> }) {
  return <article className="panel workflow-list"><SectionTitle eyebrow={eyebrow} title={title} />{Object.entries(values).map(([key, value]) => <article key={key}><div><b>{pretty(key)}</b><p>{typeof value === "boolean" ? (value ? "Enabled" : "Disabled") : String(value)}</p></div></article>)}</article>;
}

function Notifications({ state, onOpen }: { state: MasterState; onOpen: (tab: Tab) => void }) {
  const alerts = state.governance.alerts.filter((item) => item.status !== "RESOLVED");
  const approvals = state.governance.approvals.filter((item) => item.status === "PENDING");
  const tickets = state.tickets.filter((item) => item.status !== "RESOLVED");
  const privacy = state.privacyCases.filter((item) => item.status !== "COMPLETED" && item.status !== "DECLINED");
  const total = alerts.length + approvals.length + tickets.length + privacy.length;
  return <section className="panel workflow-list master-wide-list"><SectionTitle eyebrow="Attention centre" title={`${total} items need review`} />{alerts.map((item) => <article key={item.key}><div><div className="master-row-title"><b>{item.title}</b><Badge tone={item.severity === "CRITICAL" || item.severity === "HIGH" ? "rose" : "amber"}>{pretty(item.severity)}</Badge></div><p>{item.description}</p><small>{item.source} · {pretty(item.status)}</small></div><button className="master-link" onClick={() => onOpen(/queue|sqs|rabbit/i.test(item.source) ? "operations" : "advanced")}>Review →</button></article>)}{approvals.map((item) => <article key={item.id}><div><b>{item.summary}</b><p>Approval requested by {item.requestedBy}</p><small>Expires {date(item.expiresAt)}</small></div><button className="master-link" onClick={() => onOpen("advanced")}>Review →</button></article>)}{tickets.map((item) => <article key={item.id}><div><b>{item.summary}</b><p>{item.owner} · {pretty(item.priority)}</p><small>Due {date(item.dueAt)}</small></div><button className="master-link" onClick={() => onOpen("support")}>Open case →</button></article>)}{privacy.map((item) => <article key={`${item.candidateId}-${item.type}`}><div><b>{item.candidate}</b><p>{pretty(item.type)} privacy request · {pretty(item.status)}</p><small>Requested {date(item.requestedAt)}</small></div><button className="master-link" onClick={() => onOpen("support")}>Review →</button></article>)}{!total && <div className="workflow-empty"><span>✓</span><p>No operational, approval, support, or privacy notifications currently require attention.</p></div>}</section>;
}

function AdminSettings({ state, onOpen }: { state: MasterState; onOpen: (tab: Tab) => void }) {
  const admin = state.governance.currentAdmin;
  return <div className="master-stack"><section className="workflow-grid workflow-two"><article className="panel workflow-list"><SectionTitle eyebrow="Master identity" title={admin.displayName} /><article><div><b>{admin.email}</b><p>{pretty(admin.role)} · {admin.active ? "Active" : "Disabled"}</p><small>Last successful sign-in {date(admin.lastSignedInAt)}</small></div><Badge tone={admin.active ? "green" : "rose"}>{admin.active ? "Protected" : "Disabled"}</Badge></article><article><div><b>Assigned permissions</b><p>{admin.permissions.map(pretty).join(" · ")}</p></div></article></article><article className="panel workflow-list"><SectionTitle eyebrow="Control-plane preferences" title="Operational safeguards" /><article><div><b>Administrator MFA</b><p>{state.governance.securityPolicy.adminMfaRequired ? "Required for Master Access" : "Policy disabled—review immediately"}</p></div><Badge tone={state.governance.securityPolicy.adminMfaRequired ? "green" : "rose"}>{state.governance.securityPolicy.adminMfaRequired ? "Required" : "At risk"}</Badge></article><article><div><b>Session duration</b><p>{state.governance.securityPolicy.sessionDurationMinutes} minutes</p></div><button className="master-link" onClick={() => onOpen("advanced")}>Edit security policy →</button></article><article><div><b>Latest platform switch reason</b><p>{state.controls.lastChangeReason || "No platform-wide control change has been recorded yet."}</p></div></article></article></section><AccountSecurity loginPath="/admin/login" /></div>;
}

function AdminHelp({ onOpen }: { onOpen: (tab: Tab) => void }) {
  return <div className="master-help-grid"><article className="panel"><span className="eyebrow">Incident response</span><h3>A queue or service needs attention</h3><p>Confirm worker coverage and backlog in Service operations. Acknowledge the alert only after an owner and recovery action are clear.</p><button className="master-link" onClick={() => onOpen("operations")}>Open service operations →</button></article><article className="panel"><span className="eyebrow">Account safety</span><h3>A user or organisation may be compromised</h3><p>Record a reason, suspend access where necessary, revoke sessions, and preserve the audit trail. Never request a password or OTP from the user.</p><button className="master-link" onClick={() => onOpen("access")}>Open users & access →</button></article><article className="panel"><span className="eyebrow">Privacy operations</span><h3>An export or erasure request arrives</h3><p>Verify identity, retain the request reference, document the completion evidence, and use dual review for irreversible work.</p><button className="master-link" onClick={() => onOpen("support")}>Open support & privacy →</button></article><article className="panel"><span className="eyebrow">Emergency control</span><h3>Use platform switches cautiously</h3><p>Platform-wide controls require a business reason and confirmation. Communicate expected impact before maintenance mode or channel shutdowns.</p><button className="master-link" onClick={() => onOpen("overview")}>Open guarded controls →</button></article></div>;
}

function AdminSearch({ query, state, onOpen }: { query: string; state: MasterState; onOpen: (tab: Tab) => void }) {
  const needle = query.trim().toLowerCase();
  if (!needle) return <div className="workflow-empty"><span>⌕</span><p>Search by user, email, organisation, job, recruiter, public job ID, or audit action.</p></div>;
  const users = state.users.filter((item) => `${item.name} ${item.email} ${item.organisation}`.toLowerCase().includes(needle)).slice(0, 8);
  const organisations = state.organisations.filter((item) => `${item.name} ${item.workEmailDomain}`.toLowerCase().includes(needle)).slice(0, 8);
  const jobs = state.jobs.filter((item) => `${item.title} ${item.publicJobId} ${item.organisation} ${item.accountableRecruiter}`.toLowerCase().includes(needle)).slice(0, 8);
  const activity = state.activity.filter((item) => `${item.action} ${item.resourceType} ${item.actor} ${item.jobId}`.toLowerCase().includes(needle)).slice(0, 8);
  const total = users.length + organisations.length + jobs.length + activity.length;
  return <div className="master-search-results"><section className="panel workflow-list"><SectionTitle eyebrow="People" title={`${users.length} matching users`} />{users.map((item) => <article key={item.id}><div><b>{item.name}</b><p>{item.email} · {item.organisation}</p></div><button className="master-link" onClick={() => onOpen("access")}>Open directory →</button></article>)}</section><section className="panel workflow-list"><SectionTitle eyebrow="Tenants" title={`${organisations.length} matching organisations`} />{organisations.map((item) => <article key={item.id}><div><b>{item.name}</b><p>{item.workEmailDomain || "Domain not verified"} · {item.recruiters} recruiters</p></div><button className="master-link" onClick={() => onOpen("governance")}>Open governance →</button></article>)}</section><section className="panel workflow-list"><SectionTitle eyebrow="Recruitment" title={`${jobs.length} matching jobs`} />{jobs.map((item) => <article key={item.id}><div><b>{item.title}</b><p>{item.publicJobId} · {item.organisation}</p></div><button className="master-link" onClick={() => onOpen("governance")}>Open job →</button></article>)}</section><section className="panel workflow-list"><SectionTitle eyebrow="Audit evidence" title={`${activity.length} matching events`} />{activity.map((item) => <article key={item.id}><div><b>{pretty(item.action)}</b><p>{item.actor} · {date(item.occurredAt)}</p></div><button className="master-link" onClick={() => onOpen("assurance")}>Open audit →</button></article>)}</section>{!total && <div className="workflow-empty"><span>⌕</span><p>No platform records match “{query}”. Try a name, email domain, public job ID, or audit action.</p></div>}</div>;
}

function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return <nav className="master-pagination" aria-label="List pagination"><button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button></nav>;
}
