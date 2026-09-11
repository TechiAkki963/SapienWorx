"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";
import { useLiveEventsStore, type AttentionSummary } from "../stores/live-events";
import { Badge, Button, WorkspaceShell } from "./ui";
import styles from "./candidate-inbox-v1.module.css";

type InboxFilter = "ALL" | "RECRUITERS" | "SYSTEM" | "UNREAD";

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

type FeedItem =
  | { kind: "human"; id: string; at: string; unread: boolean; conversation: CandidateConversation }
  | { kind: "system"; id: string; at: string; unread: boolean; notification: CandidateNotification };

type Selection = { kind: "human"; id: string } | { kind: "system"; id: string } | null;

const filters: Array<{ value: InboxFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "RECRUITERS", label: "Recruiters" },
  { value: "SYSTEM", label: "System" },
  { value: "UNREAD", label: "Unread" },
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "RW";
}

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Recently";
  const minutes = Math.floor(Math.max(0, Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(value));
}

function messageTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function displayStage(stage: string) {
  return stage.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stageTone(stage: string): "blue" | "green" | "amber" | "rose" | "purple" {
  if (["OFFER", "ONBOARDED"].includes(stage)) return "green";
  if (stage === "REJECTED") return "rose";
  if (["INTERVIEWING", "FINAL_STAGE"].includes(stage)) return "purple";
  if (stage === "SCREENING") return "amber";
  return "blue";
}

function isInterview(notification: CandidateNotification) {
  return notification.notificationType.includes("INTERVIEW");
}

function isApplication(notification: CandidateNotification) {
  return notification.resourceType === "APPLICATION" || notification.notificationType.includes("APPLICATION");
}

function systemIcon(notification: CandidateNotification) {
  if (isInterview(notification)) return "◷";
  if (notification.notificationType.includes("OFFER")) return "✦";
  if (isApplication(notification)) return "↳";
  return "◌";
}

function destinationFor(notification: CandidateNotification) {
  if (isInterview(notification)) return "/candidate/interviews";
  if (isApplication(notification) || notification.notificationType.includes("OFFER")) return "/candidate/applications";
  return "/candidate/profile";
}

export function CandidateInboxV1() {
  const hydrateAttention = useLiveEventsStore((state) => state.hydrateAttention);
  const [conversations, setConversations] = useState<CandidateConversation[]>([]);
  const [notificationPage, setNotificationPage] = useState<CandidateNotificationPage | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [messages, setMessages] = useState<CandidateMessage[]>([]);
  const [filter, setFilter] = useState<InboxFilter>("ALL");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    void Promise.all([
      apiClient<CandidateConversation[]>("/api/candidate/messages/conversations"),
      apiClient<CandidateNotificationPage>("/api/notifications?page=0"),
    ])
      .then(([conversationResponse, notificationResponse]) => {
        if (!current) return;
        setConversations(conversationResponse);
        setNotificationPage(notificationResponse);
        setSelection((existing) => {
          if (existing?.kind === "human" && conversationResponse.some((item) => item.recruiterId === existing.id)) return existing;
          if (existing?.kind === "system" && notificationResponse.content.some((item) => item.id === existing.id)) return existing;
          const newestHuman = conversationResponse[0];
          const newestSystem = notificationResponse.content[0];
          if (!newestHuman && !newestSystem) return null;
          if (!newestSystem || (newestHuman && new Date(newestHuman.activityAt).getTime() >= new Date(newestSystem.createdAt).getTime())) {
            return { kind: "human", id: newestHuman.recruiterId };
          }
          return { kind: "system", id: newestSystem.id };
        });
      })
      .catch((reason) => {
        if (current) setError(reason instanceof Error ? reason.message : "We could not load your inbox.");
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [reloadToken]);

  const activeConversation = selection?.kind === "human"
    ? conversations.find((item) => item.recruiterId === selection.id) ?? null
    : null;
  const activeNotification = selection?.kind === "system"
    ? notificationPage?.content.find((item) => item.id === selection.id) ?? null
    : null;

  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }
    let current = true;
    setThreadLoading(true);
    setActionError("");
    void apiClient<CandidateMessagePage>(`/api/candidate/messages?with=${activeConversation.recruiterId}`)
      .then((response) => {
        if (!current) return;
        setMessages(response.content);
        setConversations((items) => items.map((item) => item.recruiterId === activeConversation.recruiterId ? { ...item, unreadCount: 0 } : item));
        void apiClient<AttentionSummary>("/api/notifications/summary").then(hydrateAttention).catch(() => undefined);
      })
      .catch((reason) => { if (current) setActionError(reason instanceof Error ? reason.message : "We could not load this conversation."); })
      .finally(() => { if (current) setThreadLoading(false); });
    return () => { current = false; };
  }, [activeConversation?.recruiterId, hydrateAttention]);

  const feed = useMemo<FeedItem[]>(() => {
    const human: FeedItem[] = conversations.map((conversation) => ({
      kind: "human",
      id: conversation.recruiterId,
      at: conversation.activityAt,
      unread: conversation.unreadCount > 0,
      conversation,
    }));
    const system: FeedItem[] = (notificationPage?.content ?? []).map((notification) => ({
      kind: "system",
      id: notification.id,
      at: notification.createdAt,
      unread: !notification.readAt,
      notification,
    }));
    const search = query.trim().toLowerCase();
    return [...human, ...system]
      .filter((item) => {
        if (filter === "RECRUITERS" && item.kind !== "human") return false;
        if (filter === "SYSTEM" && item.kind !== "system") return false;
        if (filter === "UNREAD" && !item.unread) return false;
        if (!search) return true;
        if (item.kind === "human") {
          const value = `${item.conversation.recruiterName} ${item.conversation.recruiterTitle ?? ""} ${item.conversation.organisationName ?? ""} ${item.conversation.jobTitle} ${item.conversation.lastMessageBody ?? ""}`;
          return value.toLowerCase().includes(search);
        }
        return `${item.notification.title} ${item.notification.body} ${item.notification.notificationType}`.toLowerCase().includes(search);
      })
      .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
  }, [conversations, filter, notificationPage?.content, query]);

  const unreadHuman = conversations.reduce((sum, item) => sum + item.unreadCount, 0);
  const unreadSystem = (notificationPage?.content ?? []).filter((item) => !item.readAt).length;

  async function selectSystem(notification: CandidateNotification) {
    setSelection({ kind: "system", id: notification.id });
    setActionError("");
    if (notification.readAt) return;
    try {
      const updated = await apiClient<CandidateNotification>(`/api/notifications/${notification.id}/read`, { method: "PATCH" });
      setNotificationPage((current) => current ? { ...current, content: current.content.map((item) => item.id === updated.id ? updated : item) } : current);
      void apiClient<AttentionSummary>("/api/notifications/summary").then(hydrateAttention).catch(() => undefined);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "We could not update this notification.");
    }
  }

  async function send() {
    if (!activeConversation || !draft.trim() || sending) return;
    const body = draft.trim();
    setSending(true);
    setActionError("");
    try {
      const sent = await apiClient<CandidateMessage>("/api/candidate/messages", {
        method: "POST",
        body: JSON.stringify({
          recipientId: activeConversation.recruiterId,
          applicationId: activeConversation.applicationId,
          body,
        }),
      });
      setMessages((items) => [...items, sent]);
      setConversations((items) => items.map((item) => item.recruiterId === activeConversation.recruiterId
        ? { ...item, lastMessageBody: sent.body, lastMessageAt: sent.sentAt, activityAt: sent.sentAt }
        : item));
      setDraft("");
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Your message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  const signedOut = error === "Sign in to continue." || error.includes("signed-in account");

  return (
    <WorkspaceShell
      workspace="candidate"
      active="messages"
      title="Inbox"
      description="Recruiter conversations and hiring-system updates in one chronological workspace."
      actions={<Button href="/candidate/applications" variant="secondary">View applications</Button>}
    >
      <section className={styles.inbox} aria-label="Candidate unified inbox">
        <aside className={styles.feedPane}>
          <header className={styles.feedHeader}>
            <div>
              <span className="eyebrow">Unified communication</span>
              <h2>Inbox</h2>
            </div>
            <span className={styles.unread}>{unreadHuman + unreadSystem} unread</span>
          </header>

          <label className={styles.search}>
            <span aria-hidden="true">⌕</span>
            <input aria-label="Search inbox" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recruiters, jobs or updates" />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear inbox search">×</button>}
          </label>

          <div className={styles.filters} role="tablist" aria-label="Inbox filters">
            {filters.map((item) => (
              <button type="button" role="tab" aria-selected={filter === item.value} className={filter === item.value ? styles.selectedFilter : ""} onClick={() => setFilter(item.value)} key={item.value}>
                {item.label}
              </button>
            ))}
          </div>

          <div className={styles.feed}>
            {loading && <p className={styles.state}>Loading your inbox…</p>}
            {!loading && error && <div className={styles.error} role="alert"><strong>Inbox unavailable</strong><p>{error}</p>{signedOut ? <Button href="/login">Sign in</Button> : <Button variant="secondary" onClick={() => setReloadToken((value) => value + 1)}>Try again</Button>}</div>}
            {!loading && !error && feed.map((item) => {
              const active = selection?.kind === item.kind && selection.id === item.id;
              if (item.kind === "human") {
                const conversation = item.conversation;
                return <button type="button" className={`${styles.feedItem} ${styles.humanItem} ${active ? styles.active : ""} ${item.unread ? styles.unreadItem : ""}`} onClick={() => { setSelection({ kind: "human", id: item.id }); setDraft(""); }} key={`human-${item.id}`}>
                  <span className={styles.avatar} aria-hidden="true">{initials(conversation.recruiterName)}</span>
                  <span className={styles.feedCopy}><span><strong>{conversation.recruiterName}</strong><time>{relativeTime(item.at)}</time></span><small>{conversation.organisationName ?? "Organisation"} · {conversation.jobTitle}</small><p>{conversation.lastMessageBody ?? "Recruiter conversation"}</p></span>
                  {item.unread && <i className={styles.unreadDot} aria-label="Unread recruiter message" />}
                </button>;
              }
              const notification = item.notification;
              return <button type="button" className={`${styles.feedItem} ${styles.systemItem} ${active ? styles.active : ""} ${item.unread ? styles.unreadItem : ""}`} onClick={() => void selectSystem(notification)} key={`system-${item.id}`}>
                <span className={styles.systemIcon} aria-hidden="true">{systemIcon(notification)}</span>
                <span className={styles.feedCopy}><span><strong>{notification.title}</strong><time>{relativeTime(item.at)}</time></span><small>System update · {notification.notificationType.replaceAll("_", " ").toLowerCase()}</small><p>{notification.body}</p></span>
                {item.unread && <i className={styles.unreadDot} aria-label="Unread system update" />}
              </button>;
            })}
            {!loading && !error && feed.length === 0 && <div className={styles.empty}><strong>No inbox items match this view.</strong><p>Try another filter or clear the search.</p><button type="button" onClick={() => { setFilter("ALL"); setQuery(""); }}>Show all activity</button></div>}
          </div>
          {(notificationPage?.totalElements ?? 0) > (notificationPage?.content.length ?? 0) && <p className={styles.pageNote}>Showing the latest {notificationPage?.content.length} of {notificationPage?.totalElements} system updates alongside every recruiter conversation.</p>}
        </aside>

        <article className={styles.detailPane}>
          {actionError && <p className={styles.actionError} role="alert">{actionError}</p>}
          {activeConversation && <>
            <header className={styles.detailHeader}>
              <div className={styles.person}><span className={styles.avatar}>{initials(activeConversation.recruiterName)}</span><div><strong>{activeConversation.recruiterName}</strong><small>{activeConversation.recruiterTitle ?? "Recruiter"} · {activeConversation.organisationName ?? "Organisation"}</small></div></div>
              <Badge tone={stageTone(activeConversation.applicationStage)}>{displayStage(activeConversation.applicationStage)}</Badge>
            </header>
            <div className={styles.context}><strong>{activeConversation.jobTitle}</strong><span>Human recruiter conversation · linked to your application</span><a href="/candidate/applications">View application →</a></div>
            <div className={styles.thread} aria-live="polite">
              {threadLoading && <p className={styles.state}>Loading conversation…</p>}
              {!threadLoading && messages.length === 0 && <div className={styles.threadEmpty}><strong>Start the conversation.</strong><p>Ask a concise question about {activeConversation.jobTitle}, or reply to the recruiter here.</p></div>}
              {!threadLoading && messages.map((message) => {
                const mine = message.recipientId === activeConversation.recruiterId;
                return <div className={`${styles.bubble} ${mine ? styles.mine : styles.theirs}`} key={message.id}><p>{message.body}</p><small>{mine ? "You" : activeConversation.recruiterName} · {messageTime(message.sentAt)}</small></div>;
              })}
            </div>
            <footer className={styles.composer}>
              <textarea aria-label={`Message ${activeConversation.recruiterName}`} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Write a message to ${activeConversation.recruiterName.split(" ")[0]}…`} disabled={threadLoading || sending} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} />
              <div><small>Enter to send · Shift + Enter for a new line</small><Button onClick={() => void send()} disabled={!draft.trim() || threadLoading || sending}>{sending ? "Sending…" : "Send message"}</Button></div>
            </footer>
          </>}

          {activeNotification && <div className={styles.systemDetail}>
            <header><span className={styles.systemDetailIcon} aria-hidden="true">{systemIcon(activeNotification)}</span><div><span className="eyebrow">System update</span><h2>{activeNotification.title}</h2><p>{relativeTime(activeNotification.createdAt)} · {activeNotification.notificationType.replaceAll("_", " ").toLowerCase()}</p></div></header>
            <div className={styles.systemBody}><p>{activeNotification.body}</p></div>
            <div className={styles.systemActions}><a className="button button-primary" href={destinationFor(activeNotification)}>Open related activity</a>{activeNotification.readAt && <span>✓ Read</span>}</div>
          </div>}

          {!activeConversation && !activeNotification && !loading && !error && <div className={styles.placeholder}><strong>Your unified inbox is ready.</strong><p>Recruiter messages use human avatars. System events use muted operational icons so you can immediately distinguish conversation from status information.</p><Button href="/candidate/jobs">Explore jobs</Button></div>}
        </article>
      </section>
    </WorkspaceShell>
  );
}
