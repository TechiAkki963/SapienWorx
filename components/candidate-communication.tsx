"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";
import { Badge, Button, SectionTitle, WorkspaceShell } from "./ui";

type NotificationFilter = "ALL" | "UNREAD" | "APPLICATIONS" | "INTERVIEWS";
type CandidateNotification = {
  id: string;
  notificationType: string;
  title: string;
  body: string;
  resourceType: string | null;
  resourceId: string | null;
  readAt: string | null;
  createdAt: string;
};
type CandidateNotificationPage = {
  content: CandidateNotification[];
  totalElements: number;
  totalPages: number;
  number: number;
  first: boolean;
  last: boolean;
};

const notificationFilters: Array<{ id: NotificationFilter; label: string }> = [
  { id: "ALL", label: "All activity" },
  { id: "UNREAD", label: "Unread" },
  { id: "APPLICATIONS", label: "Applications" },
  { id: "INTERVIEWS", label: "Interviews" },
];

function isInterview(notification: CandidateNotification) { return notification.notificationType.includes("INTERVIEW"); }
function isApplication(notification: CandidateNotification) { return notification.resourceType === "APPLICATION" || notification.notificationType.includes("APPLICATION"); }
function iconFor(notification: CandidateNotification) { return isInterview(notification) ? "◷" : notification.notificationType.includes("MESSAGE") ? "✉" : isApplication(notification) ? "◫" : "◌"; }
function destinationFor(notification: CandidateNotification) { return notification.notificationType.includes("MESSAGE") ? "/candidate/messages" : isApplication(notification) || isInterview(notification) ? "/candidate/applications" : "/candidate/profile"; }
function actionFor(notification: CandidateNotification) { return notification.notificationType.includes("MESSAGE") ? "Open message" : isApplication(notification) || isInterview(notification) ? "View application" : "Open profile"; }
function relativeTime(value: string) { const minutes = Math.floor(Math.max(0, Date.now() - new Date(value).getTime()) / 60_000); if (minutes < 1) return "Just now"; if (minutes < 60) return `${minutes} min ago`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h ago`; const days = Math.floor(hours / 24); return days === 1 ? "Yesterday" : `${days}d ago`; }
function matchesFilter(notification: CandidateNotification, filter: NotificationFilter) { return filter === "ALL" || (filter === "UNREAD" && !notification.readAt) || (filter === "APPLICATIONS" && isApplication(notification)) || (filter === "INTERVIEWS" && isInterview(notification)); }

export function CandidateNotifications() {
  const [data, setData] = useState<CandidateNotificationPage | null>(null);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<NotificationFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    void apiClient<CandidateNotificationPage>(`/api/notifications?page=${page}`)
      .then((response) => { if (current) setData(response); })
      .catch((reason) => { if (current) setError(reason instanceof Error ? reason.message : "We could not load your notifications."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [page, reloadToken]);

  const notifications = data?.content ?? [];
  const visibleNotifications = useMemo(() => notifications.filter((notification) => matchesFilter(notification, filter)), [filter, notifications]);
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const interviewCount = notifications.filter(isInterview).length;
  const applicationCount = notifications.filter(isApplication).length;

  async function markRead(notification: CandidateNotification) {
    if (notification.readAt) return;
    setActionError("");
    try {
      const updated = await apiClient<CandidateNotification>(`/api/notifications/${notification.id}/read`, { method: "PATCH" });
      setData((current) => current ? { ...current, content: current.content.map((item) => item.id === updated.id ? updated : item) } : current);
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "We could not update this notification."); }
  }

  async function markAllRead() {
    setMarkingAll(true);
    setActionError("");
    try {
      await apiClient<void>("/api/notifications/read-all", { method: "PATCH" });
      const readAt = new Date().toISOString();
      setData((current) => current ? { ...current, content: current.content.map((notification) => notification.readAt ? notification : { ...notification, readAt }) } : current);
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "We could not mark the notifications as read."); }
    finally { setMarkingAll(false); }
  }

  return <WorkspaceShell workspace="candidate" active="notifications" title="Notifications" description="Application, interview and recruiter updates in one clear activity centre." actions={<Button variant="secondary" onClick={() => void markAllRead()} disabled={!unreadCount || markingAll}>{markingAll ? "Marking…" : "Mark all as read"}</Button>}>
    <main className="candidate-notifications-page">
      <section className="candidate-notifications-hero panel"><div><span className="eyebrow">Career activity</span><h2>Everything that needs your attention.</h2><p>The bell in the top bar is your single notification entry point. New updates from recruiters land here in real time.</p></div><a href="/candidate/applications">View applications →</a></section>

      <section className="candidate-notification-stat-grid" aria-label="Notification overview"><article><span>Unread on this page</span><strong>{unreadCount}</strong><small>Updates waiting for you</small></article><article><span>Application updates</span><strong>{applicationCount}</strong><small>Stage and hiring activity</small></article><article><span>Interview updates</span><strong>{interviewCount}</strong><small>Scheduling and next steps</small></article><article><span>Total activity</span><strong>{data?.totalElements ?? 0}</strong><small>Across your notifications</small></article></section>

      <section className="candidate-notification-centre panel"><SectionTitle eyebrow="Live activity" title="Your updates" action={<span className="candidate-notification-total">{data ? `${data.totalElements} total` : "Loading…"}</span>} />
        <div className="candidate-notification-filter" role="tablist" aria-label="Notification filter">{notificationFilters.map((item) => <button type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? "selected" : ""} key={item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
        {actionError && <p className="candidate-notification-action-error" role="alert">{actionError}</p>}
        {error && <div className="candidate-notification-error" role="alert"><strong>We couldn&apos;t load your notifications.</strong><span>{error}</span>{error === "Sign in to continue." || error.includes("signed-in account") ? <Button href="/login">Sign in</Button> : <Button onClick={() => setReloadToken((current) => current + 1)} variant="secondary">Try again</Button>}</div>}
        {loading && <div className="candidate-notification-loading" role="status"><span></span><span></span><span></span><p>Loading your activity…</p></div>}
        {!loading && !error && visibleNotifications.length > 0 && <div className="candidate-notification-list">{visibleNotifications.map((notification) => <article className={notification.readAt ? "candidate-activity-notification" : "candidate-activity-notification unread"} key={notification.id}><span className={`candidate-notification-icon ${isInterview(notification) ? "interview" : isApplication(notification) ? "application" : "general"}`}>{iconFor(notification)}</span><div className="candidate-notification-content"><div><strong>{notification.title}</strong>{!notification.readAt && <Badge tone="blue">New</Badge>}</div><p>{notification.body}</p><small>{relativeTime(notification.createdAt)} · {notification.notificationType.replaceAll("_", " ")}</small></div><div className="candidate-notification-actions"><a href={destinationFor(notification)} onClick={() => void markRead(notification)}>{actionFor(notification)}</a><button type="button" aria-label={`Mark ${notification.title} as ${notification.readAt ? "unread" : "read"}`} onClick={() => void markRead(notification)} disabled={Boolean(notification.readAt)}>{notification.readAt ? "✓ Read" : "Mark read"}</button></div></article>)}</div>}
        {!loading && !error && notifications.length > 0 && visibleNotifications.length === 0 && <div className="candidate-notification-empty"><span>⌕</span><strong>No updates match this view.</strong><p>Try another filter to see the rest of your activity.</p><Button onClick={() => setFilter("ALL")} variant="secondary">Show all activity</Button></div>}
        {!loading && !error && notifications.length === 0 && <div className="candidate-notification-empty"><span>◌</span><strong>You&apos;re all caught up.</strong><p>Recruiter messages, application stage changes and interview updates will appear here.</p><Button href="/candidate/jobs">Explore jobs</Button></div>}
        {!loading && !error && data && data.totalPages > 1 && <footer className="candidate-notification-pagination"><span>Page {data.number + 1} of {data.totalPages}</span><div><Button onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={data.first} variant="secondary">Previous</Button><Button onClick={() => setPage((current) => current + 1)} disabled={data.last}>Next</Button></div></footer>}
      </section>
    </main>
  </WorkspaceShell>;
}

type CandidateConversation = {
  recruiterId: string;
  recruiterName: string;
  recruiterTitle: string | null;
  organisationName: string | null;
  applicationId: string;
  jobTitle: string;
  applicationStage: string;
  lastMessageBody: string | null;
  lastMessageAt: string | null;
  activityAt: string;
  unreadCount: number;
};

type CandidateMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  applicationId: string | null;
  body: string;
  sentAt: string;
  readAt: string | null;
};

type CandidateMessagePage = { content: CandidateMessage[] };

function conversationInitials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "RW"; }
function stageTone(stage: string): "blue" | "green" | "amber" | "rose" | "purple" { if (["OFFER", "ONBOARDED"].includes(stage)) return "green"; if (stage === "REJECTED") return "rose"; if (["INTERVIEWING", "FINAL_STAGE"].includes(stage)) return "purple"; if (stage === "SCREENING") return "amber"; return "blue"; }
function displayStage(stage: string) { return stage.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function messageTime(value: string) { return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value)); }

export function CandidateMessages() {
  const [conversations, setConversations] = useState<CandidateConversation[]>([]);
  const [activeRecruiterId, setActiveRecruiterId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CandidateMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let current = true;
    setLoadingConversations(true);
    setError("");
    void apiClient<CandidateConversation[]>("/api/candidate/messages/conversations")
      .then((response) => {
        if (!current) return;
        setConversations(response);
        setActiveRecruiterId((activeId) => response.some((conversation) => conversation.recruiterId === activeId) ? activeId : response[0]?.recruiterId ?? null);
      })
      .catch((reason) => { if (current) setError(reason instanceof Error ? reason.message : "We could not load your messages."); })
      .finally(() => { if (current) setLoadingConversations(false); });
    return () => { current = false; };
  }, [reloadToken]);

  const active = conversations.find((conversation) => conversation.recruiterId === activeRecruiterId) ?? null;

  useEffect(() => {
    if (!active) { setMessages([]); return; }
    let current = true;
    setLoadingThread(true);
    setSendError("");
    void apiClient<CandidateMessagePage>(`/api/candidate/messages?with=${active.recruiterId}`)
      .then((response) => {
        if (!current) return;
        setMessages(response.content);
        setConversations((items) => items.map((item) => item.recruiterId === active.recruiterId ? { ...item, unreadCount: 0 } : item));
      })
      .catch((reason) => { if (current) setSendError(reason instanceof Error ? reason.message : "We could not load this conversation."); })
      .finally(() => { if (current) setLoadingThread(false); });
    return () => { current = false; };
  }, [active?.recruiterId]);

  const visibleConversations = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return conversations;
    return conversations.filter((conversation) => `${conversation.recruiterName} ${conversation.recruiterTitle ?? ""} ${conversation.organisationName ?? ""} ${conversation.jobTitle} ${conversation.lastMessageBody ?? ""}`.toLowerCase().includes(search));
  }, [conversations, query]);
  const unreadCount = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);

  async function send() {
    if (!active || !draft.trim() || sending) return;
    const body = draft.trim();
    setSending(true);
    setSendError("");
    try {
      const sent = await apiClient<CandidateMessage>("/api/candidate/messages", { method: "POST", body: JSON.stringify({ recipientId: active.recruiterId, applicationId: active.applicationId, body }) });
      setMessages((items) => [...items, sent]);
      setConversations((items) => items.map((item) => item.recruiterId === active.recruiterId ? { ...item, lastMessageBody: sent.body, lastMessageAt: sent.sentAt, activityAt: sent.sentAt } : item).sort((left, right) => new Date(right.activityAt).getTime() - new Date(left.activityAt).getTime()));
      setDraft("");
    } catch (reason) { setSendError(reason instanceof Error ? reason.message : "Your message could not be sent. Please try again."); }
    finally { setSending(false); }
  }

  const cannotLoad = error === "Sign in to continue." || error.includes("signed-in account");

  return <WorkspaceShell workspace="candidate" active="messages" title="Message centre" description="Every recruiter conversation is connected to the application it relates to." actions={<Button href="/candidate/applications" variant="secondary">View applications</Button>}>
    <section className="message-center candidate-message-centre" aria-label="Candidate message centre">
      <aside className="message-list">
        <header><div><span className="eyebrow">Application conversations</span><h2>Messages</h2><p>{loadingConversations ? "Loading conversations…" : `${conversations.length} application-linked conversations`}</p></div><span className="message-unread-count">{unreadCount} unread</span></header>
        <label className="message-search"><span className="message-search-icon" aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recruiters or roles" aria-label="Search conversations" />{query && <button type="button" className="message-search-clear" onClick={() => setQuery("")} aria-label="Clear conversation search">×</button>}</label>
        <div className="conversation-list">
          {loadingConversations && <p className="message-empty">Loading your messages…</p>}
          {!loadingConversations && error && <div className="candidate-message-error" role="alert"><strong>We couldn&apos;t load your messages.</strong><span>{error}</span>{cannotLoad ? <Button href="/login">Sign in</Button> : <Button onClick={() => setReloadToken((value) => value + 1)} variant="secondary">Try again</Button>}</div>}
          {!loadingConversations && !error && visibleConversations.length > 0 && visibleConversations.map((conversation) => <button type="button" aria-pressed={conversation.recruiterId === active?.recruiterId} className={conversation.recruiterId === active?.recruiterId ? "conversation active" : "conversation"} onClick={() => { setActiveRecruiterId(conversation.recruiterId); setDraft(""); }} key={conversation.recruiterId}><span className="conversation-avatar">{conversationInitials(conversation.recruiterName)}</span><div className="conversation-summary"><strong>{conversation.recruiterName}</strong><small>{conversation.recruiterTitle ?? "Recruiter"} · {conversation.organisationName ?? "Organisation"}</small><p>{conversation.lastMessageBody ?? `Application: ${conversation.jobTitle}`}</p></div><time className="conversation-time">{conversation.unreadCount > 0 ? <i aria-label={`${conversation.unreadCount} unread`} /> : null}{relativeTime(conversation.activityAt)}</time></button>)}
          {!loadingConversations && !error && conversations.length > 0 && visibleConversations.length === 0 && <p className="message-empty">No conversations match that search.</p>}
          {!loadingConversations && !error && conversations.length === 0 && <div className="candidate-message-empty"><strong>No recruiter conversations yet.</strong><p>When you apply for a role, its recruiter will appear here so you can keep the conversation in context.</p><Button href="/candidate/jobs">Explore jobs</Button></div>}
        </div>
      </aside>
      <article className="conversation-panel">
        {active ? <>
          <header><div className="conversation-person"><span className="conversation-avatar">{conversationInitials(active.recruiterName)}</span><div><strong>{active.recruiterName}</strong><small>{active.recruiterTitle ?? "Recruiter"} · {active.organisationName ?? "Organisation"}</small></div></div><Badge tone={stageTone(active.applicationStage)}>{displayStage(active.applicationStage)}</Badge></header>
          <div className="message-context"><span>{active.jobTitle}</span><p>{active.organisationName ?? "Organisation"} · This conversation is tied to your application. <a href="/candidate/applications">View application</a></p></div>
          <div className="message-thread" aria-live="polite">{loadingThread ? <p className="message-empty">Loading conversation…</p> : <>{messages.length > 0 && <div className="message-day-divider"><span>Conversation</span></div>}{messages.length > 0 ? messages.map((message) => <div className={`message-bubble ${message.recipientId === active.recruiterId ? "me" : "them"}`} key={message.id}><p>{message.body}</p><small>{message.recipientId === active.recruiterId ? "You" : active.recruiterName} · {messageTime(message.sentAt)}</small></div>) : <div className="candidate-thread-empty"><strong>Start the conversation.</strong><p>Ask a concise question about {active.jobTitle}, or reply to the recruiter here.</p></div>}</>}</div>
          <footer className="message-composer"><label className="message-compose-field"><span className="sr-only">Message {active.recruiterName}</span><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Write a message to ${active.recruiterName.split(" ")[0]}…`} disabled={loadingThread || sending} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} /></label>{sendError && <p className="candidate-message-send-error" role="alert">{sendError}</p>}<div><small>Linked to {active.jobTitle} · Enter to send · Shift + Enter for a new line</small><Button onClick={() => void send()} disabled={!draft.trim() || loadingThread || sending}>{sending ? "Sending…" : "Send message"}</Button></div></footer>
        </> : <div className="candidate-message-placeholder"><strong>Choose an application conversation.</strong><p>Select a recruiter from the left, or apply to a job to start a new application-linked conversation.</p><Button href="/candidate/jobs">Explore jobs</Button></div>}
      </article>
    </section>
  </WorkspaceShell>;
}
