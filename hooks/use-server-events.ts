"use client";

import { useEffect, useRef } from "react";

export type CvParsingCompleteEvent = {
  status: "SUCCESS";
  candidateId: string;
  parserVersion: string;
  warnings: string[];
  timestamp: string;
};

export type PipelineUpdateEvent = {
  jobId: string;
  candidateId: string;
  previousStage: string;
  newStage: string;
  timestamp: string;
};

type ServerEventHandlers = {
  onCvParsingComplete?: (event: CvParsingCompleteEvent) => void;
  onPipelineUpdate?: (event: PipelineUpdateEvent) => void;
  onConnectionError?: (event: Event) => void;
};

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

/**
 * Opens the authenticated event stream once per mounted client component.
 * EventSource reconnects automatically; callers only provide state-update callbacks.
 */
export function useServerEvents(handlers: ServerEventHandlers = {}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const eventSource = new EventSource(`${apiBaseUrl}/api/events/stream`, {
      withCredentials: true,
    });

    eventSource.addEventListener("CV_PARSING_COMPLETE", (event) => {
      handlersRef.current.onCvParsingComplete?.(
        JSON.parse((event as MessageEvent<string>).data) as CvParsingCompleteEvent,
      );
    });

    eventSource.addEventListener("PIPELINE_UPDATE", (event) => {
      handlersRef.current.onPipelineUpdate?.(
        JSON.parse((event as MessageEvent<string>).data) as PipelineUpdateEvent,
      );
    });

    eventSource.onerror = (event) => {
      handlersRef.current.onConnectionError?.(event);
    };

    return () => eventSource.close();
  }, []);
}
