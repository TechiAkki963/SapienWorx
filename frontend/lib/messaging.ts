export type MessagingSenderType = "candidate" | "recruiter";
export type MessagingThreadStatus = "open" | "closed";

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

export type SocketMessageEvent = {
  type: "message";
  message: ChatMessage;
};
