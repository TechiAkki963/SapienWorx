"use client";

import { useEffect, useRef } from "react";

import { API_URL } from "@/lib/api";

type StageChangeEvent = {
  type: "STAGE_CHANGE";
  payload?: {
    application_id?: string;
    candidate_id?: string;
    job_id?: string;
    stage?: string;
  };
};

function wsBase() {
  return API_URL.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
}

export function CandidateEventBridge() {
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let attempts = 0;

    const connect = () => {
      if (disposed) return;
      socket = new WebSocket(`${wsBase()}/api/v1/events/ws`);
      socket.onopen = () => { attempts = 0; };
      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(String(message.data)) as StageChangeEvent;
          if (event.type !== "STAGE_CHANGE" || !event.payload?.application_id || !event.payload.stage) return;
          window.dispatchEvent(new CustomEvent("sapienworx:stage-change", { detail: event.payload }));
        } catch {
          // Ignore malformed realtime frames and keep the connection alive.
        }
      };
      socket.onclose = () => {
        if (disposed) return;
        attempts += 1;
        const delay = Math.min(15000, 1000 * 2 ** Math.min(attempts, 4));
        reconnectRef.current = setTimeout(connect, delay);
      };
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      socket?.close();
    };
  }, []);

  return null;
}
