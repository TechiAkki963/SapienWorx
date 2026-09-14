"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";

import { MessageBubble } from "@/components/messaging/message-bubble";
import { TypingIndicator } from "@/components/messaging/typing-indicator";
import { useSapienChat } from "@/hooks/use-sapien-chat";
import type { ChatMessage, MessagingThread } from "@/lib/messaging";

function formatThreadTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat("en-IN", sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short" }).format(date);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

export function CandidateInbox({ initialThreads }: { initialThreads: MessagingThread[] }) {
  const [threads, setThreads] = useState(initialThreads);
  const [activeThreadID, setActiveThreadID] = useState(initialThreads[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const activeThread = useMemo(() => threads.find((thread) => thread.id === activeThreadID), [threads, activeThreadID]);

  const handleMessage = useCallback((message: ChatMessage) => {
    setThreads((current) => current.map((thread) => thread.id === message.thread_id ? {
      ...thread,
      last_message: message.content,
      updated_at: message.created_at,
      unread_count: thread.id === activeThreadID && message.sender_type === "recruiter" ? thread.unread_count + 1 : thread.unread_count,
    } : thread));
  }, [activeThreadID]);

  const handleVisibleRead = useCallback((messageIDs: string[]) => {
    if (messageIDs.length === 0) return;
    setThreads((current) => current.map((thread) => thread.id === activeThreadID ? {
      ...thread,
      unread_count: Math.max(0, thread.unread_count - messageIDs.length),
    } : thread));
  }, [activeThreadID]);

  const {
    messages,
    loading: loadingMessages,
    error: loadError,
    connectionState,
    counterpartyTyping,
    sendMessage,
    emitTyping,
    observeMessage,
  } = useSapienChat({
    threadID: activeThreadID,
    currentSenderType: "candidate",
    onMessage: handleMessage,
    onVisibleRead: handleVisibleRead,
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, counterpartyTyping, activeThreadID]);

  function selectThread(threadID: string) {
    setActiveThreadID(threadID);
    setDraft("");
    setSendError("");
  }

  async function submitMessage(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !activeThreadID || sending) return;

    setSending(true);
    setSendError("");
    try {
      await sendMessage(content);
      setDraft("");
    } catch (cause) {
      setSendError(cause instanceof Error ? cause.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  const error = sendError || loadError;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 shadow-[0_24px_70px_rgba(49,46,129,0.10)] backdrop-blur-xl">
      <div className="grid min-h-[68vh] lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="border-b border-line/70 bg-[linear-gradient(180deg,#fbfaff_0%,#f6f7ff_100%)] lg:border-b-0 lg:border-r">
          <div className="border-b border-line/70 px-4 py-4">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-indigo">Conversations</p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <h1 className="text-xl font-bold tracking-[-0.03em] text-navy">Inbox</h1>
              <span className="text-xs font-semibold text-ink-muted">{threads.length}</span>
            </div>
          </div>

          <div className="max-h-[32vh] overflow-y-auto p-2 lg:max-h-[calc(68vh-4.75rem)]">
            {threads.length === 0 ? (
              <div className="m-2 rounded-2xl border border-dashed border-indigo-200 bg-white/70 p-4 text-sm leading-6 text-ink-muted">No recruiter conversations yet. New InMail messages will appear here.</div>
            ) : threads.map((thread) => {
              const active = thread.id === activeThreadID;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => selectThread(thread.id)}
                  className={`mb-1 flex w-full gap-3 rounded-2xl p-3 text-left transition ${active ? "bg-white shadow-[0_8px_24px_rgba(79,70,229,0.10)] ring-1 ring-indigo-100" : "hover:bg-white/75"}`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-extrabold ${active ? "bg-indigo text-white" : "bg-indigo-100 text-indigo-700"}`}>{initials(thread.counterparty_name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-bold text-ink">{thread.counterparty_name}</span>
                      <span className="shrink-0 text-[10px] font-semibold text-ink-muted">{formatThreadTime(thread.updated_at)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-navy">{thread.subject}</span>
                    {thread.job_title && <span className="mt-0.5 block truncate text-[11px] text-indigo">{thread.job_title}</span>}
                    <span className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-ink-muted">{thread.last_message ?? "Conversation started"}</span>
                      {thread.unread_count > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-indigo px-1 text-[10px] font-extrabold text-white">{thread.unread_count}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex min-h-[34rem] min-w-0 flex-col bg-[radial-gradient(circle_at_90%_0%,rgba(196,181,253,0.18),transparent_28%),linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)]">
          {activeThread ? (
            <>
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 bg-white/70 px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-navy">{activeThread.subject}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">{activeThread.counterparty_name}{activeThread.job_title ? ` · ${activeThread.job_title}` : ""}</p>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-bold">
                  <span className={`h-2 w-2 rounded-full ${connectionState === "live" ? "bg-emerald-400" : connectionState === "connecting" ? "bg-amber-400" : "bg-slate-300"}`} />
                  <span className="text-ink-muted">{connectionState === "live" ? "Live" : connectionState === "connecting" ? "Connecting" : "Reconnecting"}</span>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                {loadingMessages ? (
                  <div className="grid gap-3"><div className="h-16 animate-pulse rounded-2xl bg-slate-100" /><div className="ml-auto h-20 w-3/4 animate-pulse rounded-2xl bg-slate-100" /></div>
                ) : messages.length === 0 && !counterpartyTyping ? (
                  <div className="grid min-h-56 place-items-center text-center"><div><p className="font-bold text-navy">No messages yet</p><p className="mt-1 text-sm text-ink-muted">Start the conversation below.</p></div></div>
                ) : (
                  <div className="grid gap-3">
                    {messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        currentSenderType="candidate"
                        observe={observeMessage}
                      />
                    ))}

                    <AnimatePresence initial={false}>
                      {counterpartyTyping && (
                        <div className="flex justify-start">
                          <TypingIndicator senderType="recruiter" />
                        </div>
                      )}
                    </AnimatePresence>
                    <div ref={endRef} />
                  </div>
                )}
              </div>

              <form onSubmit={submitMessage} className="border-t border-line/70 bg-white/80 p-3 sm:p-4">
                {error && <p role="alert" className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}
                <div className="flex items-end gap-2 rounded-2xl border border-indigo-100 bg-white p-2 shadow-[0_10px_28px_rgba(79,70,229,0.08)] focus-within:ring-4 focus-within:ring-indigo-100/60">
                  <textarea
                    value={draft}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      if (event.target.value.trim()) emitTyping();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    rows={2}
                    maxLength={10000}
                    placeholder="Write a reply…"
                    className="max-h-36 min-h-12 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-ink outline-none placeholder:text-slate-400"
                  />
                  <button type="submit" disabled={!draft.trim() || sending} className="h-10 shrink-0 rounded-xl bg-indigo px-4 text-xs font-extrabold text-white shadow-sm transition hover:bg-indigo/90 disabled:cursor-not-allowed disabled:opacity-40">
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
                <p className="mt-1.5 px-1 text-[10px] font-medium text-ink-muted">Enter to send · Shift + Enter for a new line</p>
              </form>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-6 text-center">
              <div className="max-w-sm">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-xl">✉</div>
                <h2 className="mt-4 text-lg font-bold text-navy">Your conversations live here</h2>
                <p className="mt-2 text-sm leading-6 text-ink-muted">When a recruiter sends you an InMail, you can reply directly from this inbox.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
