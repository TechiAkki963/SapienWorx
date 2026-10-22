"use client";

import { useId } from "react";
import { humanize, jobLocation } from "@/lib/candidate";
import { usePublicJobShare, publicJobShareLinks } from "@/lib/use-public-job-share";
import { CareerIcon, SocialIcon } from "../candidate/career-icon";
import { RecruiterModal, recruiterPrimary, recruiterSecondary } from "./workspace-ui";

export function JobSharePanel({ jobId, title, onClose }: { jobId: string; title: string; onClose: () => void }) {
  const { url, job, state, copied, error, input, copy } = usePublicJobShare(jobId);
  const linkID = useId();
  const links = publicJobShareLinks(url, job?.title || title, job?.company_name || "");
  return <RecruiterModal open onClose={onClose} title="Share job" size="medium" protectChanges={false}>
    <div className="grid min-w-0 gap-5">
      <div className="border-b border-line pb-4"><h3 className="break-words text-base font-semibold text-navy">{job?.title || title}</h3>{job && <><p className="mt-1 text-sm font-medium text-ink">{job.company_name}</p><p className="mt-1 text-sm text-ink-muted">{[jobLocation(job), humanize(job.employment_type)].filter(Boolean).join(" · ")}</p><p className="mt-3 text-xs font-semibold text-ink">Active · Public</p></>}</div>
      {state === "loading" ? <p role="status" className="text-sm text-ink-muted">Checking public job availability…</p> : state !== "ready" ? <div role="alert" className="grid gap-2 text-sm text-ink"><p>{state === "unavailable" ? "This job is private, unavailable or no longer open. A public share link is not available." : "Public link is temporarily unavailable. Close this panel and try again."}</p></div> : <>
        <div><label htmlFor={linkID} className="mb-2 block text-sm font-semibold text-ink">Public job link</label><div className="flex min-w-0 flex-wrap gap-2 rounded-xl border border-line bg-slate-50/50 p-2"><input id={linkID} ref={input} value={url} readOnly type="url" className="min-h-11 min-w-0 flex-[1_1_8rem] rounded-lg bg-transparent px-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-indigo"/><button className={`${recruiterPrimary} shrink-0 whitespace-nowrap`} type="button" onClick={() => void copy()}><CareerIcon name={copied ? "check" : "copy"}/>{copied ? "Copied ✓" : "Copy link"}</button></div><p role="status" className="mt-2 text-sm text-ink-muted">{copied ? "Job link copied." : ""}</p>{error && <p role="alert" className="text-sm text-ink">{error}</p>}</div>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 w-fit items-center text-sm font-semibold text-indigo">Preview public listing ↗</a>
        <nav aria-label="Share via" className="grid grid-cols-2 gap-2 sm:grid-cols-3">{links.map(link => <a key={link.provider} href={link.href} target={link.provider === "email" ? undefined : "_blank"} rel={link.provider === "email" ? undefined : "noopener noreferrer"} className={`${recruiterSecondary} !justify-start !px-3`}>{["linkedin", "facebook", "x"].includes(link.provider) ? <SocialIcon provider={link.provider as "linkedin" | "facebook" | "x"}/> : link.provider === "email" ? <span aria-hidden="true" className="text-xl">✉</span> : <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19 2 22l5-1a9 9 0 1 0-3-2Z"/><path d="M8 7c-2 3 3 8 6 8l2-2-3-2-1 1-2-2 1-1-3-2Z"/></svg>}{link.label}</a>)}</nav>
      </>}
      <p className="flex gap-2 rounded-xl bg-indigo-soft p-3 text-sm leading-6 text-ink"><CareerIcon name="info"/>Sharing this job does not create a referral.</p>
    </div>
  </RecruiterModal>;
}
