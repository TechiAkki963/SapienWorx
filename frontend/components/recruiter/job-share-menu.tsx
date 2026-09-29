"use client";

import { useEffect, useId, useRef, useState } from "react";

export function JobShareMenu({ jobId, title, active }: { jobId: string; title: string; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => firstActionRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  function jobURL() {
    return `${window.location.origin}/jobs/${jobId}`;
  }

  async function nativeShare() {
    const url = jobURL();
    if (navigator.share) {
      await navigator.share({ title, text: `We're hiring: ${title}`, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    setMessage("Link copied");
    setOpen(false);
  }

  function openShare(provider: "linkedin" | "whatsapp" | "x") {
    const url = encodeURIComponent(jobURL());
    const text = encodeURIComponent(`We're hiring: ${title}`);
    const target = provider === "linkedin"
      ? `https://www.linkedin.com/sharing/share-offsite/?url=${url}`
      : provider === "whatsapp"
        ? `https://wa.me/?text=${text}%20${url}`
        : `https://x.com/intent/post?text=${text}&url=${url}`;
    window.open(target, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  if (!active) return <span className="text-xs font-semibold text-ink-muted/60">Publish to share</span>;

  return (
    <div className="relative">
      <button ref={triggerRef} type="button" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((value) => !value)} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink transition hover:border-indigo/25 hover:text-indigo">Share</button>
      {open && (
        <div id={menuId} aria-label={`Share ${title}`} className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-line bg-white p-1.5 shadow-xl">
          <button ref={firstActionRef} type="button" onClick={nativeShare} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-slate-50">Share / copy link</button>
          <button type="button" onClick={() => openShare("linkedin")} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-slate-50">LinkedIn</button>
          <button type="button" onClick={() => openShare("whatsapp")} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-slate-50">WhatsApp</button>
          <button type="button" onClick={() => openShare("x")} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-slate-50">X / Twitter</button>
        </div>
      )}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{message}</p>
    </div>
  );
}
