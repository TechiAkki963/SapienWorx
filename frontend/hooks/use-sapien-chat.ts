"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { API_URL, apiRequest } from "@/lib/api";
import type {
  ChatMessage,
  MessageEventPayload,
  MessageListResponse,
  MessagingSenderType,
  ReadEventPayload,
  SapienChatEvent,
  TypingEventPayload,
} from "@/lib/messaging";

const READ_BATCH_DELAY_MS = 120;
const TYPING_IDLE_MS = 2000;
const MAX_READ_BATCH = 100;

function wsBase() {
  return API_URL.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
}

function mergeMessage(list: ChatMessage[], incoming: ChatMessage) {
  const index = list.findIndex((message) => message.id === incoming.id);
  if (index >= 0) {
    const next = [...list];
    next[index] = { ...next[index], ...incoming };
    return next;
  }
  return [...list, incoming].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

function parseMessagePayload(event: SapienChatEvent): ChatMessage | null {
  if (event.type !== "message") return null;
  if (event.message) return event.message;
  const payload = event.payload as MessageEventPayload;
  return payload?.message ?? null;
}

export type SapienChatConnectionState = "offline" | "connecting" | "live";

type UseSapienChatOptions = {
  threadID: string;
  currentSenderType: MessagingSenderType;
  onMessage?: (message: ChatMessage) => void;
  onRead?: (messageIDs: string[]) => void;
};

export function useSapienChat({ threadID, currentSenderType, onMessage, onRead }: UseSapienChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [connectionState, setConnectionState] = useState<SapienChatConnectionState>("offline");
  const [counterpartyTyping, setCounterpartyTyping] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const typingIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSentRef = useRef(false);
  const remoteTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readQueueRef = useRef<Set<string>>(new Set());
  const readFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedNodesRef = useRef<Map<Element, ChatMessage>>(new Map());
  const disposedRef = useRef(false);

  const sendEvent = useCallback((event: object) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(event));
    return true;
  }, []);

  const refreshHistory = useCallback(async () => {
    if (!threadID) {
      setMessages([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<MessageListResponse>(`/api/v1/messaging/threads/${threadID}/messages?limit=100`);
      if (!disposedRef.current) setMessages(result.items ?? []);
    } catch (cause) {
      if (!disposedRef.current) setError(cause instanceof Error ? cause.message : "Could not load conversation.");
    } finally {
      if (!disposedRef.current) setLoading(false);
    }
  }, [threadID]);

  useEffect(() => {
    disposedRef.current = false;
    void refreshHistory();
    return () => {
      disposedRef.current = true;
    };
  }, [refreshHistory]);

  useEffect(() => {
    if (!threadID) return;
    let disposed = false;

    function clearReconnectTimer() {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    }

    function connect() {
      if (disposed) return;
      clearReconnectTimer();
      setConnectionState("connecting");
      const socket = new WebSocket(`${wsBase()}/api/v1/messaging/threads/${threadID}/ws`);
      socketRef.current = socket;

      socket.onopen = () => {
        if (disposed) return;
        const wasReconnect = reconnectAttemptsRef.current > 0;
        reconnectAttemptsRef.current = 0;
        setConnectionState("live");
        if (wasReconnect) void refreshHistory();
      };

      socket.onmessage = (raw) => {
        try {
          const event = JSON.parse(String(raw.data)) as SapienChatEvent;
          if (event.thread_id && event.thread_id !== threadID) return;

          switch (event.type) {
            case "message": {
              const message = parseMessagePayload(event);
              if (!message) return;
              setMessages((current) => mergeMessage(current, message));
              onMessage?.(message);
              break;
            }
            case "typing": {
              const payload = event.payload as TypingEventPayload;
              setCounterpartyTyping(Boolean(payload?.is_typing));
              if (remoteTypingTimerRef.current) clearTimeout(remoteTypingTimerRef.current);
              if (payload?.is_typing) {
                remoteTypingTimerRef.current = setTimeout(() => setCounterpartyTyping(false), TYPING_IDLE_MS + 500);
              }
              break;
            }
            case "read": {
              const payload = event.payload as ReadEventPayload;
              const ids = Array.isArray(payload?.message_ids) ? payload.message_ids : [];
              if (ids.length === 0) return;
              const idSet = new Set(ids);
              setMessages((current) => current.map((message) => idSet.has(message.id) ? { ...message, is_read: true } : message));
              onRead?.(ids);
              break;
            }
          }
        } catch {
          // Ignore malformed socket frames; the server validates its own wire contract.
        }
      };

      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (disposed) return;
        setConnectionState("offline");
        setCounterpartyTyping(false);
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(10000, 750 * 2 ** Math.min(reconnectAttemptsRef.current, 4));
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    }

    connect();
    return () => {
      disposed = true;
      clearReconnectTimer();
      reconnectAttemptsRef.current = 0;
      socketRef.current?.close();
      socketRef.current = null;
      setConnectionState("offline");
    };
  }, [onMessage, onRead, refreshHistory, threadID]);

  const sendMessage = useCallback(async (content: string) => {
    const clean = content.trim();
    if (!clean || !threadID) return null;

    if (sendEvent({ type: "message", thread_id: threadID, payload: { content: clean } })) {
      return null;
    }

    const message = await apiRequest<ChatMessage>(`/api/v1/messaging/threads/${threadID}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: clean }),
    });
    setMessages((current) => mergeMessage(current, message));
    onMessage?.(message);
    return message;
  }, [onMessage, sendEvent, threadID]);

  const emitTyping = useCallback(() => {
    if (!threadID) return;
    if (!typingSentRef.current) {
      typingSentRef.current = sendEvent({ type: "typing", thread_id: threadID, payload: { is_typing: true } });
    }
    if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
    typingIdleTimerRef.current = setTimeout(() => {
      if (typingSentRef.current) {
        sendEvent({ type: "typing", thread_id: threadID, payload: { is_typing: false } });
        typingSentRef.current = false;
      }
    }, TYPING_IDLE_MS);
  }, [sendEvent, threadID]);

  useEffect(() => () => {
    if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
    if (remoteTypingTimerRef.current) clearTimeout(remoteTypingTimerRef.current);
    if (typingSentRef.current) {
      sendEvent({ type: "typing", thread_id: threadID, payload: { is_typing: false } });
      typingSentRef.current = false;
    }
  }, [sendEvent, threadID]);

  const flushReadQueue = useCallback(() => {
    readFlushTimerRef.current = null;
    const ids = Array.from(readQueueRef.current).slice(0, MAX_READ_BATCH);
    if (ids.length === 0 || !threadID) return;
    ids.forEach((id) => readQueueRef.current.delete(id));

    const sent = sendEvent({ type: "read", thread_id: threadID, payload: { message_ids: ids } });
    if (!sent) {
      apiRequest<void>(`/api/v1/messaging/threads/${threadID}/read`, { method: "PATCH" }).catch(() => {});
    }

    if (readQueueRef.current.size > 0) {
      readFlushTimerRef.current = setTimeout(flushReadQueue, READ_BATCH_DELAY_MS);
    }
  }, [sendEvent, threadID]);

  useEffect(() => {
    if (!threadID || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.6) continue;
        const message = observedNodesRef.current.get(entry.target);
        if (!message || message.sender_type === currentSenderType || message.is_read) continue;
        readQueueRef.current.add(message.id);
      }
      if (readQueueRef.current.size > 0 && !readFlushTimerRef.current) {
        readFlushTimerRef.current = setTimeout(flushReadQueue, READ_BATCH_DELAY_MS);
      }
    }, { threshold: [0.6] });

    observerRef.current = observer;
    for (const node of observedNodesRef.current.keys()) observer.observe(node);

    return () => {
      observer.disconnect();
      observerRef.current = null;
      if (readFlushTimerRef.current) clearTimeout(readFlushTimerRef.current);
      readFlushTimerRef.current = null;
      readQueueRef.current.clear();
    };
  }, [currentSenderType, flushReadQueue, threadID]);

  const observeMessage = useCallback((message: ChatMessage, node: HTMLElement | null) => {
    for (const [element, stored] of observedNodesRef.current.entries()) {
      if (stored.id === message.id && element !== node) {
        observerRef.current?.unobserve(element);
        observedNodesRef.current.delete(element);
      }
    }
    if (!node) return;
    observedNodesRef.current.set(node, message);
    observerRef.current?.observe(node);
  }, []);

  return {
    messages,
    loading,
    error,
    connectionState,
    counterpartyTyping,
    sendMessage,
    emitTyping,
    observeMessage,
    refreshHistory,
  };
}
