"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useServerEvents } from "../hooks/use-server-events";

/** Refreshes server-rendered workspace data when the API publishes a relevant SSE event. */
export function WorkspaceLiveEvents() {
  const router = useRouter();
  const refreshTimer = useRef<number | null>(null);
  const refresh = useCallback(() => {
    if (refreshTimer.current !== null) return;
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      router.refresh();
    }, 120);
  }, [router]);

  useServerEvents({
    onCvParsingComplete: refresh,
    onPipelineUpdate: refresh,
    onNotificationCreated: refresh,
    onMessageReceived: refresh,
  });
  return null;
}
