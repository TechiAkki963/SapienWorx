"use client";

import { AnimatePresence, motion } from "motion/react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { apiRequest } from "@/lib/api";

type MessageTemplate = {
  id: string;
  title: string;
  subject_template: string;
  body_template: string;
};

type RecruiterJob = {
  id: string;
  title: string;
  status: string;
};

type BulkAccepted = {
  requested_count: number;
  recipient_count: number;
  sent_count: number;
  skipped_count: number;
  skipped_candidate_ids: string[];
  cooldown_days: number;
  status: string;
};

type OpenBulkInMailDetail = {
  candidateIDs: string[];
};

const variablePattern = /(\{\{\s*(?:CandidateName|JobTitle)\s*\}\})/g;

function VariablePreview({ value, empty }: { value: string; empty: string }) {
  const parts = value ? value.split(variablePattern) : [empty];

  return (
    <div className="rounded-xl border border-[#dfe4f7] bg-[#f7f7fd] px-3.5 py-3 text-sm leading-6 text-navy">
      {parts.map((part, index) => {
        const isVariable = /^\{\{\s*(?:CandidateName|JobTitle)\s*\}\}$/.test(part);
        return isVariable ? (
          <strong key={`${part}-${index}`} className="rounded-md bg-[#e8e9ff] px-1.5 py-0.5 font-extrabold text-indigo">
            {part}
          </strong>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        );
      })}
    </div>
  );
}

function Spinner() {
  return <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/45 border-t-white" />;
}

export function BulkInMailDrawer({ onSent }: { onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [candidateIDs, setCandidateIDs] = useState<string[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templateID, setTemplateID] = useState("");
  const [jobs, setJobs] = useState<RecruiterJob[]>([]);
  const [jobID, setJobID] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const recipientCount = candidateIDs.length;
  const selectedTemplate = useMemo(() => templates.find((template) => template.id === templateID), [templateID, templates]);
  const activeJobs = useMemo(() => jobs.filter((job) => job.status === "active"), [jobs]);
  const usesJobTitle = /\{\{\s*JobTitle\s*\}\}/.test(subject) || /\{\{\s*JobTitle\s*\}\}/.test(body);

  useEffect(() => {
    function handleOpen(event: Event) {
      const custom = event as CustomEvent<OpenBulkInMailDetail>;
      const ids = Array.from(new Set(custom.detail?.candidateIDs ?? [])).filter(Boolean);
      if (!ids.length) return;
      setCandidateIDs(ids);
      setError("");
      setSuccess("");
      setOpen(true);
    }

    window.addEventListener("sapienworx:open-bulk-inmail", handleOpen as EventListener);
    return () => window.removeEventListener("sapienworx:open-bulk-inmail", handleOpen as EventListener);
  }, []);

  useEffect(() => {
    if (!open || templatesLoaded || loadingTemplates) return;

    let cancelled = false;
    setLoadingTemplates(true);

    apiRequest<{ items: MessageTemplate[] }>("/api/v1/recruiter/message-templates")
      .then(({ items }) => {
        if (!cancelled) setTemplates(items ?? []);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load message templates.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingTemplates(false);
          setTemplatesLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadingTemplates, open, templatesLoaded]);

  useEffect(() => {
    if (!open || jobsLoaded || loadingJobs) return;

    let cancelled = false;
    setLoadingJobs(true);

    apiRequest<{ items: RecruiterJob[] }>("/api/v1/recruiter/jobs")
      .then(({ items }) => {
        if (!cancelled) setJobs(items ?? []);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load active jobs.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingJobs(false);
          setJobsLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [jobsLoaded, loadingJobs, open]);

  useEffect(() => {
    if (!selectedTemplate) return;
    setSubject(selectedTemplate.subject_template);
    setBody(selectedTemplate.body_template);
  }, [selectedTemplate]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !sending) setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, sending]);

  function closeDrawer() {
    if (sending) return;
    setOpen(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recipientCount || !subject.trim() || !body.trim()) {
      setError("Choose recipients and complete both the subject and message before sending.");
      return;
    }
    if (recipientCount > 200) {
      setError("Bulk InMail supports up to 200 candidates at a time.");
      return;
    }
    if (usesJobTitle && !jobID) {
      setError("Select an active job before using the {{JobTitle}} variable.");
      return;
    }

    setSending(true);
    setError("");
    setSuccess("");

    try {
      const payload: Record<string, unknown> = {
        candidate_ids: candidateIDs,
      };

      if (jobID) payload.job_id = jobID;
      if (templateID) payload.template_id = templateID;
      else {
        payload.subject = subject.trim();
        payload.body = body.trim();
      }

      const result = await apiRequest<BulkAccepted>("/api/v1/recruiter/inmail/bulk", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const sentCount = result.sent_count ?? result.recipient_count ?? 0;
      const skippedCount = result.skipped_count ?? 0;
      if (skippedCount > 0) {
        setSuccess(`Sent ${sentCount} InMail${sentCount === 1 ? "" : "s"}. ${skippedCount} candidate${skippedCount === 1 ? "" : "s"} skipped by the ${result.cooldown_days || 14}-day anti-spam cooldown.`);
      } else {
        setSuccess(`Sent ${sentCount} InMail${sentCount === 1 ? "" : "s"} successfully.`);
      }
      onSent();

      window.setTimeout(() => {
        setOpen(false);
        setCandidateIDs([]);
        setTemplateID("");
        setJobID("");
        setSubject("");
        setBody("");
        setSuccess("");
      }, 1200);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bulk InMail could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close Bulk InMail composer"
            className="fixed inset-0 z-[60] cursor-default bg-[#10213f]/28 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDrawer}
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-inmail-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.9 }}
            className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[38rem] flex-col border-l border-white/70 bg-[linear-gradient(165deg,#ffffff_0%,#f7f6ff_48%,#effaf6_100%)] shadow-[-24px_0_70px_rgba(16,33,63,0.16)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-line/70 bg-white/80 px-5 py-5 backdrop-blur-xl sm:px-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-indigo">Bulk outreach</p>
                  <span className="rounded-full border border-[#cfe8df] bg-[#ecf9f4] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.11em] text-[#18775e]">
                    {recipientCount} recipient{recipientCount === 1 ? "" : "s"}
                  </span>
                </div>
                <h2 id="bulk-inmail-title" className="mt-2 text-2xl font-extrabold tracking-[-0.035em] text-navy">Send Bulk InMail</h2>
                <p className="mt-1 max-w-lg text-sm leading-6 text-ink-muted">Personalise one message across your selected talent without creating repetitive manual work.</p>
              </div>

              <button type="button" onClick={closeDrawer} disabled={sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-xl text-ink-muted transition hover:bg-slate-50 hover:text-navy disabled:opacity-50" aria-label="Close drawer">
                ×
              </button>
            </div>

            <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                <section className="rounded-2xl border border-[#dfeee9] bg-white/85 p-4 shadow-[0_8px_24px_rgba(36,164,127,0.05)]">
                  <label htmlFor="bulk-template" className="text-xs font-extrabold uppercase tracking-[0.12em] text-navy">Message template</label>
                  <select
                    id="bulk-template"
                    value={templateID}
                    disabled={loadingTemplates || sending}
                    onChange={(event) => {
                      const value = event.target.value;
                      setTemplateID(value);
                      if (!value) {
                        setSubject("");
                        setBody("");
                      }
                    }}
                    className="mt-2 min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold text-navy outline-none transition focus:border-indigo/40 focus:ring-4 focus:ring-indigo-soft/70 disabled:opacity-60"
                  >
                    <option value="">Write a custom message</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>{template.title}</option>
                    ))}
                  </select>
                  <p className="mt-2 text-[11px] leading-5 text-ink-muted">
                    {loadingTemplates ? "Loading saved templates…" : templates.length ? "Saved templates keep outreach consistent while personalisation variables are resolved per candidate." : "No saved templates yet. You can still write a custom message."}
                  </p>

                  <div className="mt-4 border-t border-line/70 pt-4">
                    <label htmlFor="bulk-job" className="text-xs font-extrabold uppercase tracking-[0.12em] text-navy">Job context</label>
                    <select
                      id="bulk-job"
                      value={jobID}
                      disabled={loadingJobs || sending}
                      onChange={(event) => setJobID(event.target.value)}
                      className="mt-2 min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold text-navy outline-none transition focus:border-indigo/40 focus:ring-4 focus:ring-indigo-soft/70 disabled:opacity-60"
                    >
                      <option value="">{usesJobTitle ? "Select an active job (required)" : "No job context"}</option>
                      {activeJobs.map((job) => (
                        <option key={job.id} value={job.id}>{job.title}</option>
                      ))}
                    </select>
                    <p className="mt-2 text-[11px] leading-5 text-ink-muted">
                      {loadingJobs ? "Loading active jobs…" : usesJobTitle ? "Required because this message uses {{JobTitle}}." : "Optional unless the message uses {{JobTitle}}."}
                    </p>
                  </div>
                </section>

                <section className="space-y-4 rounded-2xl border border-[#e1e3f4] bg-white/88 p-4 shadow-[0_8px_24px_rgba(81,85,170,0.05)]">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="bulk-subject" className="text-xs font-extrabold uppercase tracking-[0.12em] text-navy">Subject</label>
                      <span className="text-[10px] font-semibold text-ink-muted">{subject.length}/255</span>
                    </div>
                    <textarea
                      id="bulk-subject"
                      rows={2}
                      maxLength={255}
                      value={subject}
                      disabled={sending}
                      onChange={(event) => {
                        setTemplateID("");
                        setSubject(event.target.value);
                      }}
                      placeholder="A role that could match your experience"
                      className="mt-2 w-full resize-none rounded-xl border border-line bg-white px-3.5 py-3 text-sm font-semibold text-navy outline-none transition placeholder:text-ink-muted/60 focus:border-indigo/40 focus:ring-4 focus:ring-indigo-soft/60 disabled:opacity-60"
                    />
                    <div className="mt-2">
                      <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-indigo">Personalisation preview</p>
                      <VariablePreview value={subject} empty="Your subject preview appears here." />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="bulk-body" className="text-xs font-extrabold uppercase tracking-[0.12em] text-navy">Message</label>
                      <span className="text-[10px] font-semibold text-ink-muted">{body.length}/5000</span>
                    </div>
                    <textarea
                      id="bulk-body"
                      rows={10}
                      maxLength={5000}
                      value={body}
                      disabled={sending}
                      onChange={(event) => {
                        setTemplateID("");
                        setBody(event.target.value);
                      }}
                      placeholder="Hi {{CandidateName}}, I came across your profile and would like to discuss our {{JobTitle}} opportunity."
                      className="mt-2 w-full resize-y rounded-xl border border-line bg-white px-3.5 py-3 text-sm leading-6 text-navy outline-none transition placeholder:text-ink-muted/60 focus:border-indigo/40 focus:ring-4 focus:ring-indigo-soft/60 disabled:opacity-60"
                    />
                    <div className="mt-2">
                      <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-indigo">Personalisation preview</p>
                      <VariablePreview value={body} empty="Your message preview appears here." />
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#dcebe6] bg-[#f4fbf8] px-3.5 py-3 text-xs leading-5 text-[#315f54]">
                    <strong className="font-extrabold text-[#18775e]">Supported variables:</strong> <span className="font-bold text-indigo">{"{{CandidateName}}"}</span> and <span className="font-bold text-indigo">{"{{JobTitle}}"}</span>. SapienWorx resolves these separately for every recipient.
                  </div>
                </section>

                {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-semibold text-red-700">{error}</p>}
              </div>

              <div className="border-t border-line/70 bg-white/90 px-5 py-4 backdrop-blur-xl sm:px-6">
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] leading-5 text-ink-muted">Up to 200 recipients per send. Candidates you contacted within the last 14 days are skipped automatically; messages and inbox notifications are committed atomically.</p>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={closeDrawer} disabled={sending} className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink-muted transition hover:bg-slate-50 hover:text-navy disabled:opacity-50">Cancel</button>
                    <button type="submit" disabled={sending || recipientCount === 0 || recipientCount > 200 || !subject.trim() || !body.trim() || (usesJobTitle && !jobID)} className="inline-flex min-h-11 min-w-[10.5rem] items-center justify-center gap-2 rounded-xl bg-[#24A47F] px-5 text-sm font-extrabold text-white shadow-[0_10px_26px_rgba(36,164,127,0.24)] transition hover:bg-[#1d8d6d] disabled:cursor-not-allowed disabled:opacity-50">
                      {sending && <Spinner />}
                      {sending ? "Sending…" : `Send to ${recipientCount}`}
                    </button>
                  </div>
                </div>
              </div>
            </form>

            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  className="pointer-events-none absolute bottom-24 left-5 right-5 rounded-2xl border border-[#bde3d7] bg-[#effbf6] px-4 py-3.5 shadow-[0_16px_40px_rgba(36,164,127,0.18)] sm:left-auto sm:right-6 sm:w-[22rem]"
                  role="status"
                >
                  <div className="flex items-center gap-3">
                    <motion.span initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 420, damping: 18 }} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#24A47F] text-base font-black text-white">✓</motion.span>
                    <div>
                      <p className="text-sm font-extrabold text-[#155f4b]">Bulk InMail processed</p>
                      <p className="mt-0.5 text-xs font-semibold text-[#397666]">{success}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
