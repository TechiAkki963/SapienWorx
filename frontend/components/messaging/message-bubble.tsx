"use client";

import { AnimatePresence, domAnimation, LazyMotion, m, MotionConfig } from "motion/react";

import type { ChatMessage, MessagingSenderType } from "@/lib/messaging";

type MessageBubbleProps = {
  message: ChatMessage;
  currentSenderType: MessagingSenderType;
  observe?: (message: ChatMessage, node: HTMLElement | null) => void;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function DoubleCheck() {
  return (
    <svg viewBox="0 0 18 12" aria-hidden="true" className="h-3.5 w-4.5 fill-none stroke-current" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 6.4 4.6 9.5 10.6 2.6" />
      <path d="M7.1 8.8 8.1 9.7 16.2 1.7" />
    </svg>
  );
}

export function MessageBubble({ message, currentSenderType, observe }: MessageBubbleProps) {
  const mine = message.sender_type === currentSenderType;
  const candidateMessage = message.sender_type === "candidate";

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <m.div
          ref={(node) => observe?.(message, node)}
          data-message-id={message.id}
          initial={{ opacity: 0, y: 8, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 26, mass: 0.78 }}
          className={`flex ${mine ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[82%] rounded-[1.35rem] px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:max-w-[72%] ${
              candidateMessage
                ? "rounded-br-md border border-emerald-100 bg-emerald-50 text-emerald-950"
                : "rounded-bl-md border border-violet-100 bg-violet-50 text-violet-950"
            }`}
          >
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>

            <div className="mt-1 flex min-h-4 items-center justify-end gap-1.5">
              <span className={`text-[10px] font-semibold ${candidateMessage ? "text-emerald-700/70" : "text-violet-700/70"}`}>
                {formatTime(message.created_at)}
              </span>

              {mine && (
                <AnimatePresence initial={false} mode="wait">
                  {message.is_read ? (
                    <m.span
                      key="read"
                      initial={{ opacity: 0, scale: 0.78, y: 2 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 320, damping: 24, mass: 0.65 }}
                      className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#526B63]"
                      title="Read"
                      aria-label="Read"
                    >
                      <DoubleCheck />
                      <span className="sr-only">Read</span>
                    </m.span>
                  ) : (
                    <m.span
                      key="sent"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, y: -1 }}
                      transition={{ duration: 0.16 }}
                      className="text-[10px] font-semibold text-slate-400"
                      aria-label="Sent"
                    >
                      Sent
                    </m.span>
                  )}
                </AnimatePresence>
              )}
            </div>
          </div>
        </m.div>
      </MotionConfig>
    </LazyMotion>
  );
}
