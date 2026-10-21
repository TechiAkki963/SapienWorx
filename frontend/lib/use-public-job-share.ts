"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest, APIRequestError } from "./api";
import { type CandidateJob } from "./candidate";
import { canonicalJobPath, safeCanonicalJobURL } from "./job-public-path";

// Both portals recheck the anonymous endpoint before displaying any share URL.
export function usePublicJobShare(jobId: string, canonicalUrl?: string) {
  const [url, setUrl] = useState("");
  const [job, setJob] = useState<CandidateJob | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const [copied, setCopied] = useState(false), [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null), alive = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); alive.current = true;
    setState("loading"); setUrl(""); setJob(null); setCopied(false); setError("");
    void apiRequest<CandidateJob>("/api/v1/jobs/" + encodeURIComponent(jobId), { signal: controller.signal }).then(publicJob => {
      if (controller.signal.aborted) return;
      const path = canonicalJobPath(publicJob.job_reference);
      const origin = ["beta.sapienworx.com", "www.sapienworx.com", "sapienworx.com", "localhost", "127.0.0.1"].includes(location.hostname) ? location.origin : "https://beta.sapienworx.com";
      const provided = canonicalUrl && safeCanonicalJobURL(canonicalUrl);
      const resolved = path && (provided && new URL(provided).origin === origin && new URL(provided).pathname === path ? provided : safeCanonicalJobURL(origin + path));
      if (!resolved) { setState("unavailable"); return; }
      setJob(publicJob); setUrl(resolved); setState("ready");
    }).catch(cause => {
      if (!controller.signal.aborted) setState(cause instanceof APIRequestError && [403, 404, 410].includes(cause.status) ? "unavailable" : "error");
    });
    return () => { alive.current = false; controller.abort(); if (timer.current) clearTimeout(timer.current); };
  }, [jobId, canonicalUrl]);
  async function copy() {
    if (state !== "ready" || !url) return;
    setError("");
    try {
      await navigator.clipboard.writeText(url);
      if (!alive.current) return;
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      if (!alive.current) return;
      setError("Clipboard access was denied or unavailable. Select the job link and copy it manually.");
      input.current?.focus(); input.current?.select();
    }
  }
  return { url, job, state, copied, error, input, copy };
}

export function publicJobShareLinks(url: string, title: string, company: string) {
  if (!safeCanonicalJobURL(url)) return [];
  const role = title.replace(/[\r\n]+/g, " ");
  const organization = company.replace(/[\r\n]+/g, " ");
  return [
    { provider: "linkedin" as const, label: "LinkedIn", href: "https://www.linkedin.com/sharing/share-offsite/?" + new URLSearchParams({ url }) },
    { provider: "whatsapp" as const, label: "WhatsApp", href: "https://wa.me/?" + new URLSearchParams({ text: `We’re hiring: ${role} at ${organization}.\n\nView the role and apply:\n${url}` }) },
    { provider: "email" as const, label: "Email", href: "mailto:?" + new URLSearchParams({ subject: `We’re hiring — ${role}`, body: `We’re hiring for a ${role} at ${organization}.\n\nView the full job description and apply here:\n${url}` }).toString().replace(/\+/g, "%20") },
    { provider: "facebook" as const, label: "Facebook", href: "https://www.facebook.com/sharer/sharer.php?" + new URLSearchParams({ u: url }) },
    { provider: "x" as const, label: "X / Twitter", href: "https://twitter.com/intent/tweet?" + new URLSearchParams({ text: role + " at " + organization, url }) },
  ];
}
