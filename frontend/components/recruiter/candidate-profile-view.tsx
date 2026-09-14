"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from "motion/react";

import { Button } from "@/components/ui/button";
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
};

const spring = { type: "spring" as const, stiffness: 245, damping: 28, mass: 0.85 };

function applyVariables(value: string, candidateName: string, jobTitle: string) {
  return value
    .replaceAll("{{CandidateName}}", candidateName)
    .replaceAll("{{JobTitle}}", jobTitle || "{{JobTitle}}");
}

export function CandidateProfileView({ candidateID, candidateName, candidateHeadline, jobs, children }: Props) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateID, setSelectedTemplateID] = useState("");
  const [selectedJobID, setSelectedJobID] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [subjectDirty, setSubjectDirty] = useState(false);
  const [bodyDirty, setBodyDirty] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sentThreadID, setSentThreadID] = useState("");

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateID),
    [selectedTemplateID, templates],
  );
  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobID), [jobs, selectedJobID]);
  const unresolvedJobVariable = subject.includes("{{JobTitle}}") || body.includes("{{JobTitle}}");
  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !unresolvedJobVariable && !sending;

  useEffect(() => {
    if (!composerOpen || templates.length > 0 || templatesLoading) return;
    let active = true;
    setTemplatesLoading(true);
    apiRequest<{ items: Template[] }>("/api/v1/recruiter/message-templates")
      .then((result) => {
        if (active) setTemplates(result.items ?? []);
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
  }, [composerOpen, templates.length, templatesLoading]);

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
  }

  async function sendInMail() {
    if (!canSend) return;
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
    }
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!composerOpen && (
              <Button type="button" onClick={() => setComposerOpen(true)} className="shadow-[0_12px_28px_rgba(79,70,229,0.18)]">
                Send InMail
              </Button>
            )}
          </div>

          <m.div
            layout
            transition={spring}
            className={composerOpen ? "grid gap-5 lg:grid-cols-2 lg:items-start" : "grid grid-cols-1"}
            data-inmail-layout={composerOpen ? "split" : "profile"}
          >
            <m.section
              layout
              transition={spring}
              className={composerOpen ? "min-w-0 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pr-1" : "min-w-0"}
              aria-label="Candidate profile context"
            >
              {children}
            </m.section>

            <AnimatePresence initial={false} mode="popLayout">
              {composerOpen && (
                <m.aside
                  key="inmail-composer"
                  layout
                  initial={{ opacity: 0, x: 42, scale: 0.985 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 36, scale: 0.985 }}
                  transition={spring}
                  className="relative min-w-0 overflow-hidden rounded-[2rem] border border-indigo-100/80 bg-[linear-gradient(145deg,#fbfaff_0%,#f5f2ff_48%,#eef4ff_100%)] p-5 shadow-[0_28px_70px_rgba(74,65,140,0.16),0_4px_16px_rgba(72,67,117,0.08)] sm:p-6 lg:sticky lg:top-4 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto"
                  aria-label="InMail composer"
                >
                  <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-[42%_58%_64%_36%] bg-indigo-200/25 blur-2xl" />
                  <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-20 h-52 w-52 rounded-[61%_39%_42%_58%] bg-sky-200/25 blur-2xl" />

                  <div className="relative">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-indigo">Direct conversation</p>
                        <h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-navy">Send InMail</h2>
                        <p className="mt-1 text-sm leading-5 text-ink-muted">Message {candidateName}{candidateHeadline ? ` · ${candidateHeadline}` : ""}</p>
                      </div>
                      <button type="button" onClick={closeComposer} className="grid h-9 w-9 place-items-center rounded-full border border-white/80 bg-white/75 text-lg text-ink-muted shadow-sm transition hover:bg-white hover:text-navy" aria-label="Close InMail composer">×</button>
                    </div>

                    {sentThreadID ? (
                      <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-5 shadow-[0_12px_28px_rgba(16,185,129,0.08)]">
                        <p className="text-sm font-extrabold text-emerald-800">InMail sent</p>
                        <p className="mt-1 text-sm leading-6 text-emerald-700">A two-way conversation has been created. Replies will continue in this thread.</p>
                        <p className="mt-3 break-all text-[11px] font-semibold text-emerald-700/80">Thread {sentThreadID}</p>
                        <Button type="button" variant="secondary" onClick={closeComposer} className="mt-4">Return to profile</Button>
                      </m.div>
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

                        <div className="flex items-center justify-end gap-2 border-t border-indigo-100/80 pt-4">
                          <Button type="button" variant="secondary" onClick={closeComposer}>Cancel</Button>
                          <Button type="button" onClick={sendInMail} disabled={!canSend} className="min-w-28 shadow-[0_12px_24px_rgba(79,70,229,0.16)]">
                            {sending ? "Sending…" : "Send InMail"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </m.aside>
              )}
            </AnimatePresence>
          </m.div>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
