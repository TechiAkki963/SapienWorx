"use client";

import { useState } from "react";

export function JobShareMenu({ jobId, title, active }: { jobId: string; title: string; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

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
  }

  if (!active) return <span className="text-xs font-semibold text-ink-muted/60">Publish to share</span>;

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink transition hover:border-indigo/25 hover:text-indigo">Share</button>
      {open && (
        <div className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-line bg-white p-1.5 shadow-xl">
          <button type="button" onClick={nativeShare} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-slate-50">Share / copy link</button>
          <button type="button" onClick={() => openShare("linkedin")} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-slate-50">LinkedIn</button>
          <button type="button" onClick={() => openShare("whatsapp")} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-slate-50">WhatsApp</button>
          <button type="button" onClick={() => openShare("x")} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-slate-50">X / Twitter</button>
          {message && <p className="px-3 py-1 text-[10px] font-bold text-emerald-700">{message}</p>}
        </div>
      )}
    </div>
  );
}
