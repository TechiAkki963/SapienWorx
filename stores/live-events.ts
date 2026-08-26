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

type ConnectionState = "idle" | "connected" | "reconnecting";

type LiveEventsState = {
  connectionState: ConnectionState;
  latestCvParsing: CvParsingCompleteEvent | CvParsingFailedEvent | null;
  latestPipelineUpdate: PipelineUpdateEvent | null;
  pipelineUpdates: PipelineUpdateEvent[];
  unreadNotificationCount: number;
  unreadMessageCount: number;
  notificationIds: string[];
  messageIds: string[];
  setConnectionState: (state: ConnectionState) => void;
  receiveCvParsingComplete: (event: CvParsingCompleteEvent) => void;
  receiveCvParsingFailed: (event: CvParsingFailedEvent) => void;
  receivePipelineUpdate: (event: PipelineUpdateEvent) => void;
  receiveNotification: (event: NotificationCreatedEvent) => void;
  receiveMessage: (event: MessageReceivedEvent) => void;
  markNotificationsRead: () => void;
  markMessagesRead: () => void;
};

const rememberedEventIds = (ids: string[], id: string) => [id, ...ids.filter((value) => value !== id)].slice(0, 50);

/** Client-side projection of authenticated SSE events. */
export const useLiveEventsStore = create<LiveEventsState>((set) => ({
  connectionState: "idle",
  latestCvParsing: null,
  latestPipelineUpdate: null,
  pipelineUpdates: [],
  unreadNotificationCount: 0,
  unreadMessageCount: 0,
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
    };
  }),
  receiveMessage: (event) => set((state) => {
    if (state.messageIds.includes(event.id)) return state;
    return {
      messageIds: rememberedEventIds(state.messageIds, event.id),
      unreadMessageCount: state.unreadMessageCount + 1,
    };
  }),
  markNotificationsRead: () => set({ unreadNotificationCount: 0 }),
  markMessagesRead: () => set({ unreadMessageCount: 0 }),
}));
