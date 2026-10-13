"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RecruiterModal, RecruiterModalClose, recruiterPrimary } from "./workspace-ui";
import Link from "next/link";

import { apiRequest } from "@/lib/api";

type Template = {
  id: string;
  title: string;
  subject_template: string;
  body_template: string;
};

type RecruiterJobOption = {
  id: string;
  title: string;
  status: string;
};

type InMailResponse = {
  thread: { id: string; subject: string; status: string };
  message: { id: string; content: string; created_at: string };
};

type Props = {
  candidateID: string;
  candidateName: string;
  candidateHeadline?: string;
  jobs: RecruiterJobOption[];
  children: ReactNode;
  composeOnOpen?: boolean;
  initialJobID?: string;
  requestContact?: boolean;
  toolbarStart?: ReactNode;
  applicant?: boolean;
};

function applyVariables(value: string, candidateName: string, jobTitle: string) {
  return value
    .replaceAll("{{CandidateName}}", candidateName)
    .replaceAll("{{JobTitle}}", jobTitle || "{{JobTitle}}");
}

export function CandidateProfileView({ candidateID, candidateName, candidateHeadline, jobs, children, composeOnOpen = false, initialJobID = "", requestContact = false, toolbarStart, applicant = false }: Props) {
  const [composerOpen, setComposerOpen] = useState(composeOnOpen);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [selectedTemplateID, setSelectedTemplateID] = useState("");
  const [selectedJobID, setSelectedJobID] = useState(initialJobID);
  const [subject, setSubject] = useState(requestContact ? "Request to speak about your application" : "");
  const [body, setBody] = useState(requestContact ? "Would you be comfortable sharing a phone number so we can discuss your application? You can reply here if you prefer to keep the conversation in SapienWorx." : "");
  const [subjectDirty, setSubjectDirty] = useState(false);
  const [bodyDirty, setBodyDirty] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sentThreadID, setSentThreadID] = useState("");
  const sendLock = useRef(false);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateID),
    [selectedTemplateID, templates],
  );
  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobID), [jobs, selectedJobID]);
  const unresolvedJobVariable = subject.includes("{{JobTitle}}") || body.includes("{{JobTitle}}");
  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !unresolvedJobVariable && !sending;

  useEffect(() => {
    const openComposer = () => {
      setComposerOpen(true);
    };
    window.addEventListener("sapienworx:open-candidate-inmail", openComposer);
    return () => window.removeEventListener("sapienworx:open-candidate-inmail", openComposer);
  }, []);

  useEffect(() => {
    if (!composerOpen || templatesLoaded) return;
    let active = true;
    setTemplatesLoading(true);
    apiRequest<{ items: Template[] }>("/api/v1/recruiter/message-templates")
      .then((result) => {
        if (!active) return;
        setTemplates(result.items ?? []);
        setTemplatesLoaded(true);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load message templates.");
      })
      .finally(() => {
        if (active) setTemplatesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [composerOpen, templatesLoaded]);

  function renderSelectedTemplate(template: Template | undefined, jobTitle: string) {
    if (!template) return;
    setSubject(applyVariables(template.subject_template, candidateName, jobTitle));
    setBody(applyVariables(template.body_template, candidateName, jobTitle));
    setSubjectDirty(false);
    setBodyDirty(false);
  }

  function chooseTemplate(templateID: string) {
    setSelectedTemplateID(templateID);
    setSentThreadID("");
    setError("");
    if (!templateID) {
      setSubject("");
      setBody("");
      setSubjectDirty(false);
      setBodyDirty(false);
      return;
    }
    renderSelectedTemplate(templates.find((template) => template.id === templateID), selectedJob?.title ?? "");
  }

  function chooseJob(jobID: string) {
    setSelectedJobID(jobID);
    setSentThreadID("");
    setError("");
    const jobTitle = jobs.find((job) => job.id === jobID)?.title ?? "";
    if (selectedTemplate) {
      if (!subjectDirty) setSubject(applyVariables(selectedTemplate.subject_template, candidateName, jobTitle));
      if (!bodyDirty) setBody(applyVariables(selectedTemplate.body_template, candidateName, jobTitle));
    }
  }

  function closeComposer() {
    setComposerOpen(false);
    setError("");
    setSentThreadID("");
    setSubject("");
    setBody("");
    setSelectedTemplateID("");
    setSelectedJobID(initialJobID);
    setSubjectDirty(false);
    setBodyDirty(false);
  }

  async function sendInMail() {
    if (!canSend || sendLock.current) return;
    sendLock.current = true;
    setSending(true);
    setError("");
    try {
      const result = await apiRequest<InMailResponse>("/api/v1/recruiter/inmail", {
        method: "POST",
        body: JSON.stringify({
          candidate_id: candidateID,
          ...(selectedJobID ? { job_id: selectedJobID } : {}),
          subject: subject.trim(),
          content: body.trim(),
        }),
      });
      setSentThreadID(result.thread.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send InMail.");
    } finally {
      setSending(false);
      sendLock.current = false;
    }
  }

  return <div className="grid gap-4">{toolbarStart&&<div className="min-w-0">{toolbarStart}</div>}<section className="min-w-0" aria-label="Candidate profile context">{children}</section>
 <RecruiterModal open={composerOpen} onClose={closeComposer} title={applicant?"Message candidate":"InMail composer"} size="medium" busy={sending} protectChanges={!sentThreadID} resetKey={sentThreadID} initialFocus="input" footer={sentThreadID?<RecruiterModalClose>Return to profile</RecruiterModalClose>:<><RecruiterModalClose disabled={sending}>Cancel</RecruiterModalClose><button type="button" disabled={!canSend} onClick={()=>void sendInMail()} className={recruiterPrimary}>{sending?"Sending…":applicant?"Send message":"Send InMail"}</button></>}>
 <p className="text-sm leading-6 text-ink-muted">{candidateName}{candidateHeadline?` · ${candidateHeadline}`:""}</p><fieldset disabled={sending} className="min-w-0">                    {sentThreadID ? (
                      <div className="mt-6 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-5 shadow-[0_12px_28px_rgba(16,185,129,0.08)]">
                        <p className="text-sm font-extrabold text-emerald-800">{applicant ? "Message sent" : "InMail sent"}</p>
                        <p className="mt-1 text-sm leading-6 text-emerald-700">A two-way conversation has been created. Replies will continue in this thread.</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link href={`/recruiter/messages?thread=${encodeURIComponent(sentThreadID)}`} className="inline-flex h-10 items-center rounded-xl bg-indigo px-4 text-sm font-bold text-white hover:bg-indigo/90">Open conversation</Link>

                        </div>
                      </div>
                    ) : (
                      <div className="mt-6 grid gap-4">
                        <label className="grid gap-1.5 text-xs font-bold text-ink">
                          Saved template
                          <select
                            value={selectedTemplateID}
                            onChange={(event) => chooseTemplate(event.target.value)}
                            className="h-11 rounded-xl border border-indigo-100 bg-white/85 px-3 text-sm font-semibold text-ink outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100/70"
                          >
                            <option value="">Write from scratch</option>
                            {templates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}
                          </select>
                          {templatesLoading && <span className="font-medium text-ink-muted">Loading templates…</span>}
                          {templatesLoaded && templates.length === 0 && <span className="font-medium text-ink-muted">No saved templates yet. You can write this message from scratch.</span>}
                        </label>

                        <label className="grid gap-1.5 text-xs font-bold text-ink">
                          Related role <span className="font-medium text-ink-muted">Optional</span>
                          <select
                            value={selectedJobID}
                            onChange={(event) => chooseJob(event.target.value)}
                            className="h-11 rounded-xl border border-indigo-100 bg-white/85 px-3 text-sm font-semibold text-ink outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100/70"
                          >
                            <option value="">No role selected</option>
                            {jobs.map((job) => <option key={job.id} value={job.id}>{job.title} · {job.status}</option>)}
                          </select>
                        </label>

                        <label className="grid gap-1.5 text-xs font-bold text-ink">
                          Subject
                          <input
                            value={subject}
                            onChange={(event) => { setSubject(event.target.value); setSubjectDirty(true); setSentThreadID(""); }}
                            maxLength={255}
                            placeholder="A role worth discussing"
                            className="h-11 rounded-xl border border-indigo-100 bg-white/90 px-3 text-sm font-semibold text-ink outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100/70"
                          />
                        </label>

                        <label className="grid gap-1.5 text-xs font-bold text-ink">
                          Message
                          <textarea
                            value={body}
                            onChange={(event) => { setBody(event.target.value); setBodyDirty(true); setSentThreadID(""); }}
                            maxLength={10000}
                            rows={13}
                            placeholder={`Hi ${candidateName},\n\nI came across your profile and wanted to connect…`}
                            className="min-h-64 resize-y rounded-2xl border border-indigo-100 bg-white/90 px-4 py-3 text-[15px] leading-7 text-ink outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100/70"
                          />
                        </label>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-semibold text-ink-muted">
                          <span>{body.length.toLocaleString("en-IN")} / 10,000 characters</span>
                          <span>Variables: {"{{CandidateName}}"} · {"{{JobTitle}}"}</span>
                        </div>

                        {unresolvedJobVariable && (
                          <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">Choose a related role to resolve {"{{JobTitle}}"} before sending.</p>
                        )}
                        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold leading-5 text-rose-700">{error}</p>}


                      </div>
                    )}
</fieldset></RecruiterModal></div>;
}
