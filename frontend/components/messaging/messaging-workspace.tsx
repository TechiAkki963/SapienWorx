"use client";
import {CandidateOutreachInterest} from "./candidate-outreach-interest";

import { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import dynamic from "next/dynamic";

import { API_URL, apiRequest } from "@/lib/api";
import { RecruiterConversationContext } from "./recruiter-conversation-context";
import { RecruiterModal, recruiterSecondary } from "@/components/recruiter/workspace-ui";
import { MessageBubble } from "@/components/messaging/message-bubble";
import { TypingIndicator } from "@/components/messaging/typing-indicator";
import { useSapienChat } from "@/hooks/use-sapien-chat";
import type { ChatMessage, MessagingSenderType, MessagingThread, ThreadListResponse } from "@/lib/messaging";
import { insertMessageEmoji, MAX_MESSAGE_BYTES, messageBytes } from "@/lib/message-emoji";
import "./messaging-workspace.css";

const EmojiPicker = dynamic(() => import("./emoji-picker").then(module => module.EmojiPicker), {ssr:false});

function formatThreadTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
  const sameDay = dayFormat.format(date) === dayFormat.format(now);
  return new Intl.DateTimeFormat("en-IN", sameDay ? { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" } : { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" }).format(date);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

export function MessagingWorkspace({ initialThreads, role, initialUnreadOnly = false }: { initialThreads: MessagingThread[]; role: MessagingSenderType; initialUnreadOnly?: boolean }) {
  const [threads, setThreads] = useState(initialThreads);
  const [activeThreadID, setActiveThreadID] = useState("");
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(initialUnreadOnly);
  const [showConversation, setShowConversation] = useState(false);
  const [contextOpen,setContextOpen] = useState(false);
  const [contextCollapsed, setContextCollapsed] = useState(false);
  useEffect(() => setContextOpen(false),[activeThreadID]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const workspaceRef = useRef<HTMLElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const emojiTrigger = useRef<HTMLButtonElement | null>(null);
  const selection = useRef({start:0,end:0});
  const [emojiOpen, setEmojiOpen] = useState(false);
  const closeEmoji = useCallback((restoreFocus: boolean) => {
    setEmojiOpen(false);
    if (restoreFocus) emojiTrigger.current?.focus({preventScroll:true});
  },[]);
  useEffect(()=>setEmojiOpen(false),[activeThreadID,showConversation]);

  // Follow the mobile visual viewport when a software keyboard reduces its height.
  // The desktop composer remains in the conversation's normal flex layout.
  useEffect(() => {
    const frame = workspaceRef.current?.closest<HTMLElement>(".swx-recruiter-frame, .candidate-frame");
    const viewport = window.visualViewport;
    if (!frame || !viewport) return;
    const resize = () => {
      if (viewport.scale === 1) frame.style.setProperty("--swx-messages-viewport-height", `${viewport.height}px`);
    };
    resize();
    viewport.addEventListener("resize", resize);
    return () => {
      viewport.removeEventListener("resize", resize);
      frame.style.removeProperty("--swx-messages-viewport-height");
    };
  }, []);

  useLayoutEffect(() => {
    const input = composerRef.current;
    if (!input) return;
    input.style.height = "auto";
    if (draft) input.style.height = `${input.scrollHeight}px`;
  }, [draft, activeThreadID, showConversation]);

  const activeThread = useMemo(() => threads.find((thread) => thread.id === activeThreadID), [threads, activeThreadID]);
  const visibleThreads = useMemo(() => threads.filter((thread) => (!unreadOnly || thread.unread_count > 0 || thread.id === activeThreadID) && `${thread.counterparty_name} ${thread.subject} ${thread.job_title ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())), [threads, query, unreadOnly, activeThreadID]);
  const otherRole = role === "candidate" ? "recruiter" : "candidate";

  const refreshThreads = useCallback(async () => {
    try {
      const result = await apiRequest<ThreadListResponse>("/api/v1/messaging/threads");
      setThreads(result.items ?? []);
    } catch {
      // Keep the last known list; the active conversation reports its own errors.
    }
  }, []);

  useEffect(() => {
    setUnreadOnly(initialUnreadOnly);
  }, [initialUnreadOnly]);

  useEffect(() => {
    const timer = window.setInterval(() => { if(document.visibilityState === "visible")void refreshThreads(); }, 10000);
    const onVisible = () => { if (document.visibilityState === "visible") void refreshThreads(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [refreshThreads]);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let attempt = 0;

    const base = (API_URL || window.location.origin).replace(/^http:/, "ws:").replace(/^https:/, "wss:");

    function connect() {
      if (disposed) return;
      socket = new WebSocket(`${base}/api/v1/messaging/inbox/ws`);
      socket.onopen = () => { attempt = 0; };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as { type?: string };
          if (payload.type === "inbox") void refreshThreads();
        } catch {
          // Ignore malformed server frames; periodic refresh remains the fallback.
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (disposed) return;
        attempt += 1;
        reconnectTimer = window.setTimeout(connect, Math.min(10000, 750 * 2 ** Math.min(attempt, 4)));
      };
    }

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [refreshThreads]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("thread");
    if (requested && initialThreads.some((thread) => thread.id === requested)) {
      setActiveThreadID(requested);
      setShowConversation(true);
    } else if (initialThreads[0]) {
      setActiveThreadID(initialUnreadOnly ? initialThreads.find((thread) => thread.unread_count > 0)?.id ?? "" : initialThreads[0].id);
    }
  }, [initialThreads, initialUnreadOnly]);

  const handleMessage = useCallback((message: ChatMessage) => {
    if (message.sender_type === otherRole) {
      window.dispatchEvent(new CustomEvent("sapienworx:unread-change", { detail: 1 }));
    }
    setThreads((current) => current.map((thread) => thread.id === message.thread_id ? {
      ...thread,
      last_message: message.content,
      updated_at: message.created_at,
      unread_count: message.sender_type === otherRole ? thread.unread_count + 1 : thread.unread_count,
    } : thread));
  }, [otherRole, role]);

  const handleVisibleRead = useCallback((messageIDs: string[]) => {
    if (messageIDs.length === 0) return;
    window.dispatchEvent(new CustomEvent("sapienworx:unread-change", { detail: -messageIDs.length }));
    setThreads((current) => current.map((thread) => thread.id === activeThreadID ? {
      ...thread,
      unread_count: Math.max(0, thread.unread_count - messageIDs.length),
    } : thread));
  }, [activeThreadID, role]);

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
    currentSenderType: role,
    onMessage: handleMessage,
    onVisibleRead: handleVisibleRead,
  });

  useEffect(() => {
    const history = historyRef.current;
    if (!history) return;
    // Never scroll ancestors (scrollIntoView can move the entire workspace).
    const latest = () => history.scrollTo({ top: history.scrollHeight, behavior: "instant" });
    latest();
    const observer = new ResizeObserver(latest);
    if (history.firstElementChild) observer.observe(history.firstElementChild);
    observer.observe(history);
    return () => observer.disconnect();
  }, [messages.at(-1)?.id, counterpartyTyping, activeThreadID, showConversation, loadingMessages]);

  function selectThread(threadID: string) {
    setActiveThreadID(threadID);
    setShowConversation(true);
    setDraft("");
    setSendError("");
  }

  async function submitMessage(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !activeThreadID || sending || messageBytes(content)>MAX_MESSAGE_BYTES) return;

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

  const tooLong = messageBytes(draft)>MAX_MESSAGE_BYTES;
  const error = tooLong ? "Message is too long. Shorten it to fit the 5,000-byte limit; emoji may use several bytes." : sendError || loadError;

  return (
    <section ref={workspaceRef} aria-label={role === "candidate" ? "Candidate inbox" : "Recruiter messages"} className="swx-messaging-workspace overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className={`swx-messaging-columns grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)] ${role === "recruiter" && activeThread && !contextCollapsed ? "2xl:grid-cols-[19rem_minmax(0,1fr)_18rem]" : ""}`}>
        <aside aria-label="Conversation list" className={`swx-messaging-list ${showConversation ? "hidden lg:flex" : "flex"} min-h-0 flex-col border-line/70 bg-[linear-gradient(180deg,#fbfaff_0%,#f6f7ff_100%)] lg:border-r`}>
          <div className="shrink-0 border-b border-line/70 px-4 py-3">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-sm font-bold text-navy">Conversations</h2>
              <span className="text-xs font-semibold text-ink-muted">{threads.length}</span>
            </div>
            <label className="mt-3 block">
              <span className="sr-only">Search conversations</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-indigo focus:ring-2 focus:ring-indigo-100" />
            </label>
            {role === "recruiter" && <button type="button" aria-pressed={unreadOnly} onClick={() => setUnreadOnly((value) => !value)} className={`mt-2 rounded-full border px-3 py-1.5 text-xs font-bold ${unreadOnly ? "border-indigo bg-indigo text-white" : "border-line bg-white text-ink-muted hover:text-indigo"}`}>Unread only</button>}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {threads.length === 0 ? (
              <div className="m-2 rounded-2xl border border-dashed border-indigo-200 bg-white/70 p-4 text-sm leading-6 text-ink-muted">{role === "candidate" ? "No recruiter conversations yet. New InMail messages will appear here." : "No conversations yet. Start InMail from an eligible candidate profile."}</div>
            ) : visibleThreads.length === 0 ? (
              <p className="p-4 text-sm text-ink-muted">{unreadOnly ? "No unread conversations match your search." : "No conversations match your search."}</p>
            ) : visibleThreads.map((thread) => {
              const active = thread.id === activeThreadID;
              return (
                <button
                  key={thread.id}
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => selectThread(thread.id)}
                  className={`swx-thread-row relative ${active ? "swx-thread-row-active" : ""} mb-1 flex w-full gap-3 rounded-2xl p-3 text-left transition-shadow ${active ? "shadow-[0_8px_24px_rgba(79,70,229,0.10)] ring-1 ring-indigo-100" : "hover:bg-white/75"}`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-extrabold ${active ? "bg-indigo text-white" : "bg-indigo-100 text-indigo-700"}`}>{initials(thread.counterparty_name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-bold text-ink">{thread.counterparty_name}</span>
                      <span className="shrink-0 text-[10px] font-semibold text-ink-muted">{formatThreadTime(thread.updated_at)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-muted">{thread.job_title || thread.subject}</span>
                    <span className="sr-only">{thread.subject}</span>
                    <span className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-ink-muted">{thread.last_message ?? "Conversation started"}</span>
                      {thread.unread_count > 0 && <span aria-label={`${thread.unread_count} unread messages`} className="grid h-5 min-w-5 place-items-center rounded-full bg-indigo px-1 text-[10px] font-extrabold text-white">{thread.unread_count}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className={`swx-messaging-pane ${showConversation ? "flex" : "hidden lg:flex"} min-h-0 min-w-0 flex-col bg-[radial-gradient(circle_at_90%_0%,rgba(196,181,253,0.18),transparent_28%),linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)]`}>
          {activeThread ? (
            <>
              <header className="swx-messaging-header flex shrink-0 flex-wrap items-center gap-2 border-b border-line/70 bg-white px-3 py-2 sm:px-5 sm:py-3">
                <button type="button" aria-label="Back to conversations" onClick={() => setShowConversation(false)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-indigo hover:bg-indigo-soft lg:hidden"><svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 5-7 7 7 7M5 12h14"/></svg></button>
                <div className="min-w-0 flex-1 basis-24">
                  <h2 className="truncate text-sm font-bold text-navy" title={activeThread.counterparty_name}>{activeThread.counterparty_name}</h2>
                  <p className="mt-0.5 truncate text-xs text-ink-muted" title={activeThread.subject}>{activeThread.job_title || activeThread.subject}</p>
                </div>
                {role==="candidate"&&<CandidateOutreachInterest threadID={activeThread.id}/>}
                {role === "recruiter" && <button type="button" aria-label="Candidate context" onClick={()=>setContextOpen(true)} className={`${recruiterSecondary} 2xl:hidden`}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current sm:hidden" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></svg><span className="hidden sm:inline">Candidate context</span></button>}
                {role === "recruiter" && <span className="hidden 2xl:inline-flex"><button type="button" aria-expanded={!contextCollapsed} aria-controls="messaging-candidate-context" onClick={()=>setContextCollapsed(value=>!value)} className={recruiterSecondary}>{contextCollapsed ? "Show context" : "Hide context"}</button></span>}
                <div className="flex items-center gap-2 text-[11px] font-bold">
                  <span className={`h-2 w-2 rounded-full ${connectionState === "live" ? "bg-emerald-400" : connectionState === "connecting" ? "bg-amber-400" : "bg-slate-300"}`} />
                  <span className="text-ink-muted">{connectionState === "live" ? "Live" : connectionState === "connecting" ? "Connecting" : "Reconnecting"}</span>
                </div>
              </header>

              <div ref={historyRef} role="region" aria-label="Message history" tabIndex={0} aria-busy={loadingMessages} className="swx-message-history min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-5 pb-7 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo sm:px-5">
                <div role="log" aria-label="Conversation messages" aria-live="polite" aria-relevant="additions text" className="mx-auto w-full max-w-[52rem]">
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
                        currentSenderType={role}
                        observe={observeMessage}
                      />
                    ))}

                    <AnimatePresence initial={false}>
                      {counterpartyTyping && (
                        <div className="flex justify-start">
                          <TypingIndicator senderType={otherRole} />
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                </div>
              </div>

              <form onSubmit={submitMessage} aria-label="Message composer" className="swx-messaging-composer sticky bottom-0 z-10 shrink-0 border-t border-line/70 bg-white p-3">
                <div className="mx-auto w-full max-w-[52rem]">
                {error && <p role="alert" className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}
                <div className="flex items-end gap-2 rounded-xl border border-line bg-white p-1 focus-within:ring-2 focus-within:ring-indigo/30">
                  <textarea
                    ref={composerRef}
                    value={draft}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      if (event.target.value.trim()) emitTyping();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    rows={1}
                    maxLength={5000}
                    aria-label="Write a reply"
                    aria-describedby="message-composer-help"
                    placeholder="Write a reply…"
                    className="swx-message-input min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2.5 text-sm leading-6 text-ink outline-none placeholder:text-ink-muted"
                  />
                  <button ref={emojiTrigger} type="button" aria-label="Add emoji" aria-haspopup="dialog" aria-expanded={emojiOpen} aria-controls={emojiOpen?"message-emoji-picker":undefined} title="Add emoji" disabled={sending} onClick={()=>{
                    if(emojiOpen){closeEmoji(true);return;}
                    const input=composerRef.current;
                    selection.current={start:input?.selectionStart??draft.length,end:input?.selectionEnd??draft.length};
                    setEmojiOpen(true);
                  }} className="swx-emoji-trigger">
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M8 14a4.5 4.5 0 0 0 8 0M8.5 9h.01M15.5 9h.01"/></svg>
                  </button>
                  {emojiOpen&&activeThread&&<EmojiPicker anchor={emojiTrigger} storageKey={`swx:emoji:recent:v1:${role}:${role==="candidate"?activeThread.candidate_id:activeThread.recruiter_id}`} onClose={closeEmoji} onSelect={emoji=>{
                    const result=insertMessageEmoji(draft,selection.current.start,selection.current.end,emoji);
                    if(!result)return false;
                    setDraft(result.value);setEmojiOpen(false);emitTyping();
                    requestAnimationFrame(()=>{composerRef.current?.focus({preventScroll:true});composerRef.current?.setSelectionRange(result.cursor,result.cursor);});
                    return true;
                  }}/>}
                  <button type="submit" disabled={!draft.trim() || sending || tooLong} className="min-h-11 shrink-0 rounded-xl bg-indigo px-4 text-xs font-extrabold text-white shadow-sm transition hover:bg-indigo/90 disabled:cursor-not-allowed disabled:opacity-40">
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
                <p id="message-composer-help" className="sr-only">Enter to send · Shift + Enter for a new line</p>
                </div>
              </form>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-6 text-center">
              <div className="max-w-sm">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-xl">✉</div>
                <h2 className="mt-4 text-lg font-bold text-navy">Your conversations live here</h2>
                <p className="mt-2 text-sm leading-6 text-ink-muted">{role === "candidate" ? "When a recruiter sends you an InMail, you can reply directly from this inbox." : "Start an InMail from a candidate profile to open a two-way conversation."}</p>
              </div>
            </div>
          )}
        </div>
        {role === "recruiter" && activeThread && <><aside id="messaging-candidate-context" className={`${contextCollapsed ? "hidden" : "hidden 2xl:block"} min-h-0 overflow-y-auto overscroll-contain border-l border-line bg-white`}>{!contextCollapsed && <RecruiterConversationContext thread={activeThread}/>}</aside><RecruiterModal open={contextOpen} onClose={()=>setContextOpen(false)} title="Candidate context">{contextOpen && <RecruiterConversationContext thread={activeThread}/>}</RecruiterModal></>}
      </div>
    </section>
  );
}
