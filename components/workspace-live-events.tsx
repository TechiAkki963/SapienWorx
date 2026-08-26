"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useServerEvents } from "../hooks/use-server-events";
import { useLiveEventsStore } from "../stores/live-events";

/** Refreshes server-rendered workspace data when the API publishes a relevant SSE event. */
export function WorkspaceLiveEvents() {
  const router = useRouter();
  const setConnectionState = useLiveEventsStore((state) => state.setConnectionState);
  const receiveCvParsingComplete = useLiveEventsStore((state) => state.receiveCvParsingComplete);
  const receiveCvParsingFailed = useLiveEventsStore((state) => state.receiveCvParsingFailed);
  const receivePipelineUpdate = useLiveEventsStore((state) => state.receivePipelineUpdate);
  const receiveNotification = useLiveEventsStore((state) => state.receiveNotification);
  const receiveMessage = useLiveEventsStore((state) => state.receiveMessage);
  const refreshTimer = useRef<number | null>(null);
  const refresh = useCallback(() => {
    if (refreshTimer.current !== null) return;
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      router.refresh();
    }, 120);
  }, [router]);

  useServerEvents({
    onConnected: () => setConnectionState("connected"),
    onConnectionError: () => setConnectionState("reconnecting"),
    onCvParsingComplete: (event) => { receiveCvParsingComplete(event); refresh(); },
    onCvParsingFailed: (event) => { receiveCvParsingFailed(event); refresh(); },
    onPipelineUpdate: (event) => { receivePipelineUpdate(event); refresh(); },
    onNotificationCreated: (event) => { receiveNotification(event); refresh(); },
    onMessageReceived: (event) => { receiveMessage(event); refresh(); },
  });
  return null;
}
