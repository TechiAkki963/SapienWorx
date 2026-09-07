"use client";

import { create } from "zustand";

export type CvParsingCompleteEvent = {
  status: "SUCCESS";
  candidateId: string;
  parserVersion: string;
  warnings: string[];
  timestamp: string;
};

export type CvParsingFailedEvent = {
  status: "FAILED";
  candidateId: string;
  message: string;
  timestamp: string;
};

export type PipelineUpdateEvent = {
  jobId: string;
  candidateId: string;
  previousStage: string;
  newStage: string;
  timestamp: string;
};

export type NotificationCreatedEvent = {
  id: string;
  type: string;
  title: string;
  body: string;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: string;
};

export type MessageReceivedEvent = {
  id: string;
  senderId: string;
  recipientId: string;
  applicationId: string | null;
  body: string;
  sentAt: string;
  readAt: string | null;
};

export type AttentionSummary = {
  unreadNotifications: number;
  unreadMessages: number;
  unreadInterviews: number;
};

type ConnectionState = "idle" | "connected" | "reconnecting";

type LiveEventsState = {
  connectionState: ConnectionState;
  latestCvParsing: CvParsingCompleteEvent | CvParsingFailedEvent | null;
  latestPipelineUpdate: PipelineUpdateEvent | null;
  pipelineUpdates: PipelineUpdateEvent[];
  unreadNotificationCount: number;
  unreadMessageCount: number;
  unreadInterviewCount: number;
  notificationIds: string[];
  messageIds: string[];
  setConnectionState: (state: ConnectionState) => void;
  receiveCvParsingComplete: (event: CvParsingCompleteEvent) => void;
  receiveCvParsingFailed: (event: CvParsingFailedEvent) => void;
  receivePipelineUpdate: (event: PipelineUpdateEvent) => void;
  receiveNotification: (event: NotificationCreatedEvent) => void;
  receiveMessage: (event: MessageReceivedEvent) => void;
  hydrateAttention: (summary: AttentionSummary) => void;
  markNotificationsRead: () => void;
  markMessagesRead: () => void;
};

const rememberedEventIds = (ids: string[], id: string) => [id, ...ids.filter((value) => value !== id)].slice(0, 50);
const nonNegativeCount = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;

/** Client-side projection of authenticated SSE events. */
export const useLiveEventsStore = create<LiveEventsState>((set) => ({
  connectionState: "idle",
  latestCvParsing: null,
  latestPipelineUpdate: null,
  pipelineUpdates: [],
  unreadNotificationCount: 0,
  unreadMessageCount: 0,
  unreadInterviewCount: 0,
  notificationIds: [],
  messageIds: [],
  setConnectionState: (connectionState) => set({ connectionState }),
  receiveCvParsingComplete: (event) => set({ latestCvParsing: event }),
  receiveCvParsingFailed: (event) => set({ latestCvParsing: event }),
  receivePipelineUpdate: (event) => set((state) => ({
    latestPipelineUpdate: event,
    pipelineUpdates: [event, ...state.pipelineUpdates.filter((update) =>
      !(update.candidateId === event.candidateId && update.timestamp === event.timestamp),
    )].slice(0, 50),
  })),
  receiveNotification: (event) => set((state) => {
    if (state.notificationIds.includes(event.id)) return state;
    return {
      notificationIds: rememberedEventIds(state.notificationIds, event.id),
      unreadNotificationCount: state.unreadNotificationCount + 1,
      unreadInterviewCount: state.unreadInterviewCount + (event.type.startsWith("INTERVIEW") ? 1 : 0),
    };
  }),
  receiveMessage: (event) => set((state) => {
    if (state.messageIds.includes(event.id)) return state;
    return {
      messageIds: rememberedEventIds(state.messageIds, event.id),
      unreadMessageCount: state.unreadMessageCount + 1,
    };
  }),
  hydrateAttention: (summary) => set({
    unreadNotificationCount: nonNegativeCount(summary.unreadNotifications),
    unreadMessageCount: nonNegativeCount(summary.unreadMessages),
    unreadInterviewCount: nonNegativeCount(summary.unreadInterviews),
  }),
  markNotificationsRead: () => set({ unreadNotificationCount: 0 }),
  markMessagesRead: () => set({ unreadMessageCount: 0 }),
}));
