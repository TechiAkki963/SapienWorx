"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ThemeModeControl } from "@/components/theme/theme-mode-control";
import { apiRequest } from "@/lib/api";
import { CandidateAvatar } from "./candidate-avatar";
import { useCandidateWorkspace } from "./candidate-workspace-state";
import { WorkspaceDialog } from "./workspace-dialog";

export function safeNotificationDestination(value?: string) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(value)
  )
    return "/candidate/notifications";
  try {
    const url = new URL(value, "https://candidate.invalid");
    if (
      url.origin === "https://candidate.invalid" &&
      /^\/candidate(?:\/(?:applications|interviews|inbox|notifications|saved|settings|profile|jobs)(?:\/[a-zA-Z0-9-]+)?)?\/?$/.test(
        url.pathname,
      )
    )
      return url.pathname + url.search + url.hash;
  } catch {}
  return "/candidate/notifications";
}

export function CandidateTopbar({ name }: { name: string }) {
  const router = useRouter();
  const {
    identity,
    notifications,
    unreadCount,
    notificationError,
    refreshNotifications,
    markRead,
    markAllRead,
  } = useCandidateWorkspace();
  const [panel, setPanel] = useState<"account" | "notifications" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function action(work: () => Promise<void>) {
    setPending(true);
    setError("");
    try {
      await work();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This action could not be completed. Try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="candidate-topbar-actions">
      <ThemeModeControl compact />
      <button
        type="button"
        className="candidate-icon-button candidate-bell"
        aria-label={
          unreadCount == null
            ? "Notifications, count unavailable"
            : `Notifications, ${unreadCount} unread`
        }
        aria-haspopup="dialog"
        aria-expanded={panel === "notifications"}
        onClick={() => {
          setError("");
          setPanel("notifications");
          void refreshNotifications();
        }}
      >
        <svg
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {unreadCount != null && unreadCount > 0 && (
          <span className="candidate-notification-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      <button
        type="button"
        className="candidate-account-trigger"
        aria-label="Candidate account"
        aria-haspopup="dialog"
        aria-expanded={panel === "account"}
        onClick={() => {
          setError("");
          setPanel("account");
        }}
      >
        <CandidateAvatar name={name} />
      </button>
      {panel === "account" && (
        <WorkspaceDialog
          title="Your account"
          onClose={() => setPanel(null)}
          popover
          busy={pending}
        >
          <div className="candidate-account-identity">
            <CandidateAvatar name={name} />
            <div>
              <strong>{identity?.full_name || name}</strong>
              {identity?.email && <p>{identity.email}</p>}
            </div>
          </div>
          <nav aria-label="Account links" className="candidate-account-links">
            <Link href="/candidate/profile" onClick={() => setPanel(null)}>
              View profile
            </Link>
            <Link href="/candidate/referrals" onClick={() => setPanel(null)}>My Referrals</Link>
            <Link href="/candidate/settings" onClick={() => setPanel(null)}>
              Settings
            </Link>
            <Link
              href="/candidate/profile?panel=visibility"
              onClick={() => setPanel(null)}
            >
              Privacy & visibility
            </Link>
            <Link
              href="/candidate/saved"
              onClick={() => setPanel(null)}
              className="candidate-secondary-mobile"
            >
              Saved jobs
            </Link>
            <Link
              href="/candidate/interviews"
              onClick={() => setPanel(null)}
              className="candidate-secondary-mobile"
            >
              Interviews
            </Link>
          </nav>
          <button
            type="button"
            className="candidate-logout"
            disabled={pending}
            onClick={() =>
              void action(async () => {
                await apiRequest("/api/v1/auth/logout", { method: "POST" });
                router.replace("/login");
                router.refresh();
              })
            }
          >
            {pending ? "Logging out…" : "Log out"}
          </button>
          {error && (
            <p role="alert" className="candidate-error">
              {error}
            </p>
          )}
        </WorkspaceDialog>
      )}
      {panel === "notifications" && (
        <WorkspaceDialog
          title="Notifications"
          onClose={() => setPanel(null)}
          popover
          busy={pending}
        >
          <div className="candidate-notification-toolbar">
            <span>
              {unreadCount == null
                ? "Count unavailable"
                : `${unreadCount} unread`}
            </span>
            <button
              type="button"
              disabled={pending || !unreadCount}
              onClick={() => void action(markAllRead)}
            >
              Mark all as read
            </button>
          </div>
          {(error || notificationError) && (
            <p role="alert" className="candidate-error">
              {error || notificationError}{" "}
              <button type="button" onClick={() => void refreshNotifications()}>
                Retry
              </button>
            </p>
          )}
          {unreadCount === null && !notificationError ? (
            <p role="status" className="candidate-empty">
              Loading notifications…
            </p>
          ) : notifications.length ? (
            <div className="candidate-notification-list">
              {notifications.map((note) => (
                <button
                  type="button"
                  key={note.id}
                  disabled={pending}
                  className={note.read_at ? "" : "unread"}
                  onClick={() =>
                    void action(async () => {
                      if (!note.read_at) await markRead(note.id);
                      setPanel(null);
                      router.push(safeNotificationDestination(note.action_url));
                    })
                  }
                >
                  <span
                    className="candidate-notification-dot"
                    aria-hidden="true"
                  />
                  <span>
                    <strong>{note.title}</strong>
                    <span className="candidate-notification-description">
                      {note.body}
                    </span>
                    <time dateTime={note.created_at}>
                      {new Date(note.created_at).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                    <span className="sr-only">
                      {note.read_at ? "Read" : "Unread"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            !notificationError && (
              <p className="candidate-empty">
                You’re all caught up. New updates will appear here.
              </p>
            )
          )}
          <Link
            className="candidate-view-notifications"
            href="/candidate/notifications"
            onClick={() => setPanel(null)}
          >
            View all notifications →
          </Link>
        </WorkspaceDialog>
      )}
    </div>
  );
}
