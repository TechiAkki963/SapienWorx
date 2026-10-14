"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiRequest } from "@/lib/api";
import type {
  CandidateNotification,
  CandidateProfileSummary,
} from "@/lib/candidate";

type NotificationInbox = {
  items: CandidateNotification[];
  unread_count: number;
};
type WorkspaceState = {
  identity: CandidateProfileSummary | null;
  setIdentity: (value: CandidateProfileSummary) => void;
  patchIdentity: (value: Partial<CandidateProfileSummary>) => void;
  refreshIdentity: () => Promise<void>;
  notifications: CandidateNotification[];
  unreadCount: number | null;
  messageUnreadCount: number;
  notificationError: string;
  refreshNotifications: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};
const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function CandidateWorkspaceState({
  initialIdentity,
  children,
}: {
  initialIdentity: CandidateProfileSummary | null;
  children: ReactNode;
}) {
  const [identity, setIdentity] = useState(initialIdentity);
  const [inbox, setInbox] = useState<NotificationInbox>({
    items: [],
    unread_count: 0,
  });
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [notificationError, setNotificationError] = useState("");
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let revision = 0;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      const current = ++revision;
      try {
        const result = await apiRequest<{ items: { unread_count: number }[] }>("/api/v1/messaging/threads", { signal: controller.signal });
        if (current === revision) setMessageUnreadCount((result.items || []).reduce((count, row) => count + Math.max(0, row.unread_count || 0), 0));
      } catch { /* Navigation remains available if the inbox summary is offline. */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    const update = () => void refresh();
    window.addEventListener("focus", update); window.addEventListener("sapienworx:unread-change", update); document.addEventListener("visibilitychange", update);
    return () => { revision++; controller.abort(); clearInterval(timer); window.removeEventListener("focus", update); window.removeEventListener("sapienworx:unread-change", update); document.removeEventListener("visibilitychange", update); };
  }, []);
  const sequence = useRef(0);
  const identitySequence = useRef(0);
  useEffect(() => {
    setIdentity(initialIdentity);
  }, [initialIdentity]);
  const refreshIdentity = useCallback(async () => {
    const current = ++identitySequence.current;
    const result = await apiRequest<CandidateProfileSummary>(
      "/api/v1/candidate/profile/summary",
    );
    if (current === identitySequence.current) setIdentity(result);
  }, []);
  const patchIdentity = useCallback(
    (value: Partial<CandidateProfileSummary>) => {
      identitySequence.current++;
      setIdentity((current) => (current ? { ...current, ...value } : current));
    },
    [],
  );
  const refreshNotifications = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const result = await apiRequest<NotificationInbox>(
        "/api/v1/candidate/notifications/inbox?limit=8",
      );
      if (current !== sequence.current) return;
      setInbox(result);
      setUnreadCount(result.unread_count);
      setNotificationError("");
    } catch (cause) {
      if (current === sequence.current)
        setNotificationError(
          cause instanceof Error
            ? cause.message
            : "Notifications could not be refreshed.",
        );
    }
  }, []);
  const markRead = useCallback(
    async (id: string) => {
      await apiRequest(
        `/api/v1/candidate/notifications/${encodeURIComponent(id)}/read`,
        { method: "PATCH" },
      );
      await refreshNotifications();
      window.dispatchEvent(new Event("swx-notifications-changed"));
    },
    [refreshNotifications],
  );
  const markAllRead = useCallback(async () => {
    await apiRequest("/api/v1/candidate/notifications/read-all", {
      method: "PATCH",
    });
    await refreshNotifications();
    window.dispatchEvent(new Event("swx-notifications-changed"));
  }, [refreshNotifications]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("_swxrenew")) {
      url.searchParams.delete("_swxrenew");
      window.history.replaceState(
        window.history.state,
        "",
        url.pathname + url.search + url.hash,
      );
    }
    void refreshNotifications();
    const visibleRefresh = () => {
      if (document.visibilityState === "visible") void refreshNotifications();
    };
    const timer = window.setInterval(visibleRefresh, 10000);
    window.addEventListener("focus", visibleRefresh);
    window.addEventListener("swx-notifications-changed", visibleRefresh);
    document.addEventListener("visibilitychange", visibleRefresh);
    return () => {
      sequence.current++;
      window.clearInterval(timer);
      window.removeEventListener("focus", visibleRefresh);
      window.removeEventListener("swx-notifications-changed", visibleRefresh);
      document.removeEventListener("visibilitychange", visibleRefresh);
    };
  }, [refreshNotifications]);
  return (
    <WorkspaceContext.Provider
      value={{
        identity,
        setIdentity,
        patchIdentity,
        refreshIdentity,
        notifications: inbox.items,
        unreadCount,
        messageUnreadCount,
        notificationError,
        refreshNotifications,
        markRead,
        markAllRead,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useCandidateWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("Candidate workspace state is required.");
  return value;
}

export function useOptionalCandidateWorkspace(){return useContext(WorkspaceContext)}
