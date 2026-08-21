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

export type NotificationCreatedEvent = { id: string; type: string; title: string; body: string; resourceType: string | null; resourceId: string | null; createdAt: string };
export type MessageReceivedEvent = { id: string; senderId: string; recipientId: string; applicationId: string | null; body: string; sentAt: string; readAt: string | null };

type ServerEventHandlers = {
  onCvParsingComplete?: (event: CvParsingCompleteEvent) => void;
  onPipelineUpdate?: (event: PipelineUpdateEvent) => void;
  onNotificationCreated?: (event: NotificationCreatedEvent) => void;
  onMessageReceived?: (event: MessageReceivedEvent) => void;
  onConnectionError?: (event: Event) => void;
};

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");

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

    eventSource.addEventListener("NOTIFICATION_CREATED", (event) => {
      handlersRef.current.onNotificationCreated?.(JSON.parse((event as MessageEvent<string>).data) as NotificationCreatedEvent);
    });

    eventSource.addEventListener("MESSAGE_RECEIVED", (event) => {
      handlersRef.current.onMessageReceived?.(JSON.parse((event as MessageEvent<string>).data) as MessageReceivedEvent);
    });

    eventSource.onerror = (event) => {
      handlersRef.current.onConnectionError?.(event);
    };

    return () => eventSource.close();
  }, []);
}
