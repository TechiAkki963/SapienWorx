"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { API_URL } from "@/lib/api";
import type { SapienChatEvent } from "@/lib/messaging";

export type MessagingEventsConnectionState = "offline" | "connecting" | "live";

function wsBase() {
  const base = API_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return base.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
}

export function useMessagingEvents({
  onInboxChanged,
  onNotificationsChanged,
}: {
  onInboxChanged?: () => void;
  onNotificationsChanged?: () => void;
}) {
  const [connectionState, setConnectionState] = useState<MessagingEventsConnectionState>("offline");
  const inboxRef = useRef(onInboxChanged);
  const notificationsRef = useRef(onNotificationsChanged);

  useEffect(() => {
    inboxRef.current = onInboxChanged;
  }, [onInboxChanged]);

  useEffect(() => {
    notificationsRef.current = onNotificationsChanged;
  }, [onNotificationsChanged]);

  const dispatch = useCallback((event: SapienChatEvent) => {
    if (event.type === "inbox_changed") inboxRef.current?.();
    if (event.type === "notifications_changed") notificationsRef.current?.();
  }, []);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    function connect() {
      if (disposed) return;
      setConnectionState("connecting");
      socket = new WebSocket(`${wsBase()}/api/v1/messaging/ws`);

      socket.onopen = () => {
        if (disposed) return;
        attempts = 0;
        setConnectionState("live");
      };

      socket.onmessage = (raw) => {
        try {
          dispatch(JSON.parse(String(raw.data)) as SapienChatEvent);
        } catch {
          // Ignore malformed frames. The server owns the authenticated event contract.
        }
      };

      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (disposed) return;
        setConnectionState("offline");
        attempts += 1;
        const delay = Math.min(15_000, 1000 * 2 ** Math.min(attempts, 4));
        retryTimer = setTimeout(connect, delay);
      };
    }

    connect();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [dispatch]);

  return connectionState;
}
