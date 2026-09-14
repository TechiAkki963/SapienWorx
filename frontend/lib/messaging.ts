export type MessagingSenderType = "candidate" | "recruiter";
export type MessagingThreadStatus = "open" | "closed";
export type SapienChatEventType = "message" | "typing" | "read";

export type MessagingThread = {
  id: string;
  recruiter_id: string;
  candidate_id: string;
  job_id?: string | null;
  subject: string;
  status: MessagingThreadStatus;
  counterparty_name: string;
  job_title?: string | null;
  last_message?: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_type: MessagingSenderType;
  content: string;
  is_read: boolean;
  created_at: string;
};

export type ThreadListResponse = { items: MessagingThread[] };
export type MessageListResponse = { items: ChatMessage[] };

export type MessageEventPayload = { message: ChatMessage };
export type MessageInputPayload = { content: string };
export type TypingEventPayload = { is_typing: boolean };
export type ReadEventPayload = { message_ids: string[] };

export type SapienChatEvent = {
  type: SapienChatEventType;
  thread_id: string;
  sender_id: string;
  payload: MessageEventPayload | TypingEventPayload | ReadEventPayload;
  message?: ChatMessage;
};

export type SocketMessageEvent = SapienChatEvent;
