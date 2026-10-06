"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { MarkReadButton } from "@/components/candidate/notification-actions";
import { Surface } from "@/components/ui/surface";
import { API_URL, apiRequest } from "@/lib/api";
import { CandidateNotification, humanize } from "@/lib/candidate";
import { safeNotificationDestination } from "./candidate-topbar";
import { useCandidateWorkspace } from "./candidate-workspace-state";

function NotificationAction({ href }: { href: string }) {
  return (
    <Link
      className="text-sm font-bold text-indigo hover:underline"
      href={safeNotificationDestination(href)}
    >
      Open →
    </Link>
  );
}

export function LiveNotifications({
  initialItems,
}: {
  initialItems: CandidateNotification[];
}) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState("");
  const { refreshNotifications, markAllRead, unreadCount } =
    useCandidateWorkspace();
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let attempt = 0;

    async function refresh() {
      try {
        const result = await apiRequest<{ items: CandidateNotification[] }>(
          "/api/v1/candidate/notifications",
        );
        if (!cancelled) {
          setItems(result.items || []);
          setError("");
        }
      } catch (cause) {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "Updates could not be refreshed.",
          );
      }
    }

    const base = (API_URL || window.location.origin)
      .replace(/^http:/, "ws:")
      .replace(/^https:/, "wss:");
    function connect() {
      if (cancelled) return;
      socket = new WebSocket(`${base}/api/v1/messaging/inbox/ws`);
      socket.onopen = () => {
        attempt = 0;
      };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as { type?: string };
          if (payload.type === "notifications" || payload.type === "inbox") {
            void refresh();
            void refreshNotifications();
          }
        } catch {
          // Periodic refresh below remains the safe fallback.
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (cancelled) return;
        attempt += 1;
        reconnectTimer = window.setTimeout(
          connect,
          Math.min(10000, 750 * 2 ** Math.min(attempt, 4)),
        );
      };
    }

    connect();
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener("swx-notifications-changed", refresh);
    return () => {
      cancelled = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket?.close();
      window.clearInterval(timer);
      window.removeEventListener("swx-notifications-changed", refresh);
    };
  }, [refreshNotifications]);

  if (!items.length)
    return (
      <Surface className="mt-6 p-8 text-center" tone="mint">
        <h2 className="text-xl font-bold">You’re all caught up.</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Application and account updates will appear here.
        </p>
        {error && (
          <p role="alert" className="candidate-error">
            {error}
          </p>
        )}
      </Surface>
    );

  return (
    <Surface className="mt-6 overflow-hidden">
      <div className="border-b border-line/60 px-5 py-2 flex items-center justify-between text-xs font-semibold text-ink-muted">
        <span>Application and account updates</span>
        <button
          type="button"
          className="min-h-11 font-bold text-indigo"
          disabled={!unreadCount}
          onClick={async () => {
            try {
              await markAllRead();
              setError("");
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Could not mark updates read.",
              );
            }
          }}
        >
          Mark all as read
        </button>
      </div>
      {error && (
        <p role="alert" className="candidate-error m-4">
          {error}
        </p>
      )}
      <div className="divide-y divide-line/60">
        {items.map((item) => (
          <article
            className={`p-5 ${item.read_at ? "bg-white/45" : "bg-indigo-soft/22"}`}
            key={item.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${item.read_at ? "bg-line" : "bg-indigo"}`}
                  />
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">
                    {humanize(item.kind)}
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-bold">{item.title}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">
                  {item.body}
                </p>
                <div className="mt-3 flex items-center gap-4">
                  {item.action_url && (
                    <NotificationAction href={item.action_url} />
                  )}
                  <span className="text-xs text-ink-muted">
                    {new Date(item.created_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </span>
                </div>
              </div>
              <MarkReadButton id={item.id} read={Boolean(item.read_at)} />
            </div>
          </article>
        ))}
      </div>
    </Surface>
  );
}
