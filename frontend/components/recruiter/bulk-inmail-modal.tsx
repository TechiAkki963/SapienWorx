"use client";

import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import {RecruiterModal,RecruiterModalClose,recruiterPrimary} from "./workspace-ui";

import { apiRequest } from "@/lib/api";

export type BulkMessageTemplate = {
  id: string;
  title: string;
  subject_template: string;
  body_template: string;
};

export type BulkRecruiterJob = {
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

export function BulkInMailModal({
  onSent,
  applicant = false,
  initialTemplates,
  initialJobs,
}: {
  onSent: () => void;
  applicant?: boolean;
  initialTemplates?: BulkMessageTemplate[];
  initialJobs?: BulkRecruiterJob[];
}) {
  const formID=useId(),sendLock=useRef(false),retryRequest=useRef<{fingerprint:string;key:string}|null>(null);
  const [open, setOpen] = useState(false);
  const [candidateIDs, setCandidateIDs] = useState<string[]>([]);
  const [templates, setTemplates] = useState<BulkMessageTemplate[]>(initialTemplates ?? []);
  const [templateID, setTemplateID] = useState("");
  const [jobs, setJobs] = useState<BulkRecruiterJob[]>(initialJobs ?? []);
  const [jobID, setJobID] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesLoaded, setTemplatesLoaded] = useState(initialTemplates !== undefined);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobsLoaded, setJobsLoaded] = useState(initialJobs !== undefined);
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
    if (!open || templatesLoaded) return;

    let cancelled = false;
    setLoadingTemplates(true);

    apiRequest<{ items: BulkMessageTemplate[] }>("/api/v1/recruiter/message-templates")
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
  }, [open, templatesLoaded]);

  useEffect(() => {
    if (!open || jobsLoaded) return;

    let cancelled = false;
    setLoadingJobs(true);

    apiRequest<{ items: BulkRecruiterJob[] }>("/api/v1/recruiter/jobs")
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
  }, [jobsLoaded, open]);

  useEffect(() => {
    if (!selectedTemplate) return;
    setSubject(selectedTemplate.subject_template);
    setBody(selectedTemplate.body_template);
  }, [selectedTemplate]);

  function closeModal() {
    if (sending) return;
    retryRequest.current=null;setOpen(false);setSubject("");setBody("");setTemplateID("");setJobID("");setSuccess("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(sendLock.current)return;
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

    sendLock.current=true;setSending(true);
    setError("");
    setSuccess("");

    try {
      const payload: Record<string, unknown> = {
        candidate_ids: candidateIDs,
      };

      if (jobID) payload.job_id = jobID;
      if (templateID && selectedTemplate && subject === selectedTemplate.subject_template && body === selectedTemplate.body_template) payload.template_id = templateID;
      else {
        payload.subject = subject.trim();
        payload.body = body.trim();
      }

      const fingerprint=JSON.stringify(payload);
      if(retryRequest.current?.fingerprint!==fingerprint)retryRequest.current={fingerprint,key:window.crypto.randomUUID()};
      const idempotencyKey = retryRequest.current.key;
      const result = await apiRequest<BulkAccepted>("/api/v1/recruiter/inmail/bulk", {
        method: "POST",
        headers: { "X-Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
      });

      const sentCount = result.sent_count ?? result.recipient_count ?? 0;
      const skippedCount = result.skipped_count ?? 0;
      if (skippedCount > 0) {
        setSuccess(`Sent ${sentCount} ${applicant?"message":"InMail"}${sentCount === 1 ? "" : "s"}. ${skippedCount} candidate${skippedCount === 1 ? "" : "s"} skipped by the ${result.cooldown_days || 14}-day anti-spam cooldown.`);
      } else {
        setSuccess(`Sent ${sentCount} ${applicant?"message":"InMail"}${sentCount === 1 ? "" : "s"} successfully.`);
      }
      onSent();


    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bulk InMail could not be sent.");
    } finally {
      setSending(false);sendLock.current=false;
    }
  }

  return <RecruiterModal open={open} onClose={closeModal} title={applicant?"Message selected applicants":"Send Bulk InMail"} size="medium" busy={sending} protectChanges={!success} resetKey={success} initialFocus="select" returnFocus={applicant?'input[aria-label="Select all visible applicants"]':"#main-content"} footer={<><RecruiterModalClose disabled={sending}>Cancel</RecruiterModalClose><button type="submit" form={formID} disabled={sending||Boolean(success)||recipientCount===0||recipientCount>200||!subject.trim()||!body.trim()||(usesJobTitle&&!jobID)} className={recruiterPrimary}>{sending&&<Spinner/>}{sending?"Sending…":`Send to ${recipientCount}`}</button></>}>
 <p className="mb-4 text-sm text-ink-muted">{recipientCount} selected recipient{recipientCount===1?"":"s"}. Messages use the existing consent and anti-spam safeguards.</p><form id={formID} onSubmit={submit}><fieldset disabled={sending||Boolean(success)} className="min-w-0 space-y-5">                <section className="rounded-2xl border border-[#dfeee9] bg-white/85 p-4 shadow-[0_8px_24px_rgba(36,164,127,0.05)]">
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
                      <span className="text-[13px] font-semibold text-ink-muted">{subject.length}/255</span>
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
                      <p className="mb-1.5 text-[13px] font-extrabold uppercase tracking-[0.12em] text-indigo">Personalisation preview</p>
                      <VariablePreview value={subject} empty="Your subject preview appears here." />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="bulk-body" className="text-xs font-extrabold uppercase tracking-[0.12em] text-navy">Message</label>
                      <span className="text-[13px] font-semibold text-ink-muted">{body.length}/5000</span>
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
                      <p className="mb-1.5 text-[13px] font-extrabold uppercase tracking-[0.12em] text-indigo">Personalisation preview</p>
                      <VariablePreview value={body} empty="Your message preview appears here." />
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#dcebe6] bg-[#f4fbf8] px-3.5 py-3 text-xs leading-5 text-[#315f54]">
                    <strong className="font-extrabold text-[#18775e]">Supported variables:</strong> <span className="font-bold text-indigo">{"{{CandidateName}}"}</span> and <span className="font-bold text-indigo">{"{{JobTitle}}"}</span>. SapienWorx resolves these separately for every recipient.
                  </div>
                </section>

                <div className="rounded-xl border border-[#dfe4f7] bg-[#f7f8ff] px-3.5 py-3 text-[11px] leading-5 text-ink-muted">
                  Up to 200 recipients per send. Company-wide 14-day cooldown and hourly/daily outreach safeguards are applied automatically; messages and inbox notifications are committed atomically.
                </div>

                {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-semibold text-red-700">{error}</p>}
</fieldset></form>{success&&<p role="status" className="mt-4 rounded-lg border border-line p-4 text-sm text-ink">{success}</p>}</RecruiterModal>;
}
