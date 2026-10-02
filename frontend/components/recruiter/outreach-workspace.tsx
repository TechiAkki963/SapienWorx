"use client";

import { useMemo, useState } from "react";

import { apiRequest } from "@/lib/api";
import type { TalentPoolCandidate } from "@/components/recruiter/talent-pool-selection";
import type { BulkMessageTemplate, BulkRecruiterJob } from "@/components/recruiter/bulk-inmail-drawer";

export type OutreachSequenceStep = {
  id: string;
  step_order: number;
  delay_hours: number;
  template_id: string;
  title: string;
  subject_template: string;
  body_template: string;
};

export type OutreachSequence = {
  id: string;
  name: string;
  status: string;
  steps: OutreachSequenceStep[];
  created_at: string;
  updated_at: string;
};

export type OutreachCampaign = {
  id: string;
  name: string;
  sequence_id: string;
  sequence_name: string;
  job_id?: string;
  job_title?: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  skipped_count: number;
  failed_count: number;
  launched_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
};

type Tab = "campaigns" | "sequences" | "templates";

type SequenceDraftStep = {
  template_id: string;
  delay_hours: number;
};

function statusTone(status: string) {
  if (status === "running" || status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "paused") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "completed") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "cancelled" || status === "archived") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-indigo-200 bg-indigo-50 text-indigo-700";
}

function humanDelay(hours: number) {
  if (hours === 0) return "Immediately";
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${days} day${days === 1 ? "" : "s"} later`;
  }
  return `${hours} hour${hours === 1 ? "" : "s"} later`;
}

export function OutreachWorkspace({
  initialTemplates,
  initialSequences,
  initialCampaigns,
  candidates,
  activeJobs,
}: {
  initialTemplates: BulkMessageTemplate[];
  initialSequences: OutreachSequence[];
  initialCampaigns: OutreachCampaign[];
  candidates: TalentPoolCandidate[];
  activeJobs: BulkRecruiterJob[];
}) {
  const [tab, setTab] = useState<Tab>("campaigns");
  const [templates, setTemplates] = useState(initialTemplates);
  const [sequences, setSequences] = useState(initialSequences);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [templateTitle, setTemplateTitle] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateBody, setTemplateBody] = useState("");

  const [sequenceName, setSequenceName] = useState("");
  const [sequenceSteps, setSequenceSteps] = useState<SequenceDraftStep[]>([
    { template_id: initialTemplates[0]?.id ?? "", delay_hours: 0 },
  ]);

  const [campaignName, setCampaignName] = useState("");
  const [campaignSequenceID, setCampaignSequenceID] = useState(initialSequences[0]?.id ?? "");
  const [campaignJobID, setCampaignJobID] = useState("");
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(() => new Set());

  const selectedCount = selectedCandidates.size;
  const runningCount = useMemo(() => campaigns.filter((item) => item.status === "running").length, [campaigns]);
  const totalSent = useMemo(() => campaigns.reduce((sum, item) => sum + item.sent_count, 0), [campaigns]);

  async function createTemplate(event: React.FormEvent) {
    event.preventDefault();
    setBusy("template");
    setNotice(null);
    try {
      const item = await apiRequest<BulkMessageTemplate>("/api/v1/recruiter/message-templates", {
        method: "POST",
        body: JSON.stringify({
          title: templateTitle,
          subject_template: templateSubject,
          body_template: templateBody,
        }),
      });
      setTemplates((current) => [item, ...current]);
      setTemplateTitle("");
      setTemplateSubject("");
      setTemplateBody("");
      setNotice("Template created.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Template could not be created.");
    } finally {
      setBusy(null);
    }
  }

  async function createSequence(event: React.FormEvent) {
    event.preventDefault();
    setBusy("sequence");
    setNotice(null);
    try {
      const item = await apiRequest<OutreachSequence>("/api/v1/recruiter/outreach/sequences", {
        method: "POST",
        body: JSON.stringify({ name: sequenceName, steps: sequenceSteps }),
      });
      const complete = {
        ...item,
        steps: sequenceSteps.map((step, index) => {
          const template = templates.find((candidate) => candidate.id === step.template_id);
          return {
            id: `local-${index}`,
            step_order: index + 1,
            delay_hours: step.delay_hours,
            template_id: step.template_id,
            title: template?.title ?? "Template",
            subject_template: template?.subject_template ?? "",
            body_template: template?.body_template ?? "",
          };
        }),
      };
      setSequences((current) => [complete, ...current]);
      setSequenceName("");
      setSequenceSteps([{ template_id: templates[0]?.id ?? "", delay_hours: 0 }]);
      setCampaignSequenceID((current) => current || item.id);
      setNotice("Sequence created and ready for campaigns.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Sequence could not be created.");
    } finally {
      setBusy(null);
    }
  }

  async function createCampaign(event: React.FormEvent) {
    event.preventDefault();
    setBusy("campaign");
    setNotice(null);
    try {
      const item = await apiRequest<OutreachCampaign>("/api/v1/recruiter/outreach/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: campaignName,
          sequence_id: campaignSequenceID,
          job_id: campaignJobID || undefined,
          candidate_ids: Array.from(selectedCandidates),
        }),
      });
      setCampaigns((current) => [item, ...current]);
      setCampaignName("");
      setSelectedCandidates(new Set());
      setNotice("Campaign saved as draft. Review it before launch.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Campaign could not be created.");
    } finally {
      setBusy(null);
    }
  }

  async function launchCampaign(id: string) {
    setBusy(id);
    setNotice(null);
    try {
      const response = await apiRequest<{ campaign: OutreachCampaign }>("/api/v1/recruiter/outreach/campaigns/" + id + "/launch", {
        method: "POST",
        headers: { "X-Idempotency-Key": window.crypto.randomUUID() },
      });
      setCampaigns((current) => current.map((item) => item.id === id ? response.campaign : item));
      setNotice("Campaign launched through the protected InMail delivery path.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Campaign could not be launched.");
    } finally {
      setBusy(null);
    }
  }

  async function changeCampaignStatus(id: string, status: "paused" | "running" | "cancelled") {
    setBusy(id);
    setNotice(null);
    try {
      const item = await apiRequest<OutreachCampaign>("/api/v1/recruiter/outreach/campaigns/" + id, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setCampaigns((current) => current.map((campaign) => campaign.id === id ? item : campaign));
      setNotice(status === "running" ? "Campaign resumed." : status === "paused" ? "Campaign paused." : "Campaign cancelled.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Campaign status could not be changed.");
    } finally {
      setBusy(null);
    }
  }

  function toggleCandidate(id: string) {
    setSelectedCandidates((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="grid gap-5 pb-24">
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line/70 bg-white p-4 shadow-[0_6px_18px_rgba(16,33,63,0.04)]">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">Running</p>
          <p className="mt-1 text-2xl font-black text-navy">{runningCount}</p>
          <p className="mt-1 text-xs text-ink-muted">Sequences currently delivering follow-ups.</p>
        </div>
        <div className="rounded-2xl border border-line/70 bg-white p-4 shadow-[0_6px_18px_rgba(16,33,63,0.04)]">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">Messages sent</p>
          <p className="mt-1 text-2xl font-black text-navy">{totalSent}</p>
          <p className="mt-1 text-xs text-ink-muted">Campaign sends recorded through protected messaging.</p>
        </div>
        <div className="rounded-2xl border border-line/70 bg-white p-4 shadow-[0_6px_18px_rgba(16,33,63,0.04)]">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">Safeguards</p>
          <p className="mt-1 text-sm font-extrabold text-navy">Anti-spam inherited</p>
          <p className="mt-1 text-xs leading-5 text-ink-muted">Consent, cooldown, idempotency and recruiter/company budgets stay enforced.</p>
        </div>
      </section>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-line/70 bg-white p-1.5" role="tablist" aria-label="Outreach workspace">
        {(["campaigns", "sequences", "templates"] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className={`min-h-10 flex-1 rounded-xl px-4 text-sm font-bold capitalize transition ${tab === item ? "bg-navy text-white shadow-sm" : "text-ink-muted hover:bg-slate-50 hover:text-navy"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {notice && (
        <div role="status" className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800">
          {notice}
        </div>
      )}

      {tab === "templates" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <form onSubmit={createTemplate} className="rounded-2xl border border-line/70 bg-white p-5 shadow-[0_8px_24px_rgba(16,33,63,0.05)]">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-indigo">Reusable copy</p>
            <h2 className="mt-1 text-xl font-bold text-navy">Create message template</h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">Use CandidateName and JobTitle variables. Every sequence step references one saved template.</p>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-1.5 text-xs font-bold text-ink-muted">Template name
                <input value={templateTitle} onChange={(e) => setTemplateTitle(e.target.value)} required maxLength={160} className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-indigo focus:ring-2 focus:ring-indigo-100" />
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-ink-muted">Subject
                <input value={templateSubject} onChange={(e) => setTemplateSubject(e.target.value)} required maxLength={255} placeholder="{{JobTitle}} opportunity" className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-indigo focus:ring-2 focus:ring-indigo-100" />
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-ink-muted">Message
                <textarea value={templateBody} onChange={(e) => setTemplateBody(e.target.value)} required rows={7} placeholder="Hi {{CandidateName}}, ..." className="rounded-xl border border-line bg-white px-3 py-3 text-sm leading-6 text-ink outline-none focus:border-indigo focus:ring-2 focus:ring-indigo-100" />
              </label>
              <button disabled={busy === "template"} className="min-h-11 rounded-xl bg-indigo px-4 text-sm font-extrabold text-white disabled:opacity-50">{busy === "template" ? "Creating…" : "Create template"}</button>
            </div>
          </form>

          <section className="rounded-2xl border border-line/70 bg-white p-5">
            <h2 className="text-lg font-bold text-navy">Saved templates</h2>
            <div className="mt-4 grid gap-3">
              {templates.length === 0 ? <p className="rounded-xl border border-dashed border-line p-5 text-sm text-ink-muted">Create your first template to build a sequence.</p> : templates.map((template) => (
                <article key={template.id} className="rounded-xl border border-line/70 bg-slate-50/60 p-4">
                  <p className="font-extrabold text-navy">{template.title}</p>
                  <p className="mt-1 text-xs font-semibold text-indigo">{template.subject_template}</p>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{template.body_template}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "sequences" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <form onSubmit={createSequence} className="rounded-2xl border border-line/70 bg-white p-5">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-indigo">Follow-up logic</p>
            <h2 className="mt-1 text-xl font-bold text-navy">Build a sequence</h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">The first step sends immediately. Later steps run server-side and stop automatically after a candidate replies.</p>
            <label className="mt-5 grid gap-1.5 text-xs font-bold text-ink-muted">Sequence name
              <input value={sequenceName} onChange={(e) => setSequenceName(e.target.value)} required maxLength={160} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold text-ink outline-none focus:border-indigo focus:ring-2 focus:ring-indigo-100" />
            </label>
            <div className="mt-4 grid gap-3">
              {sequenceSteps.map((step, index) => (
                <div key={index} className="rounded-xl border border-line/70 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-extrabold text-navy">Step {index + 1}</p>
                    {index > 0 && <button type="button" onClick={() => setSequenceSteps((current) => current.filter((_, i) => i !== index))} className="text-xs font-bold text-rose-600">Remove</button>}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_10rem]">
                    <label className="grid gap-1.5 text-xs font-bold text-ink-muted">Template
                      <select value={step.template_id} required onChange={(e) => setSequenceSteps((current) => current.map((candidate, i) => i === index ? { ...candidate, template_id: e.target.value } : candidate))} className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm text-ink">
                        <option value="">Select template</option>
                        {templates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-xs font-bold text-ink-muted">Delay hours
                      <input type="number" min={index === 0 ? 0 : 1} max={720} disabled={index === 0} value={step.delay_hours} onChange={(e) => setSequenceSteps((current) => current.map((candidate, i) => i === index ? { ...candidate, delay_hours: Number(e.target.value) } : candidate))} className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm text-ink disabled:bg-slate-100" />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button type="button" disabled={sequenceSteps.length >= 12 || templates.length === 0} onClick={() => setSequenceSteps((current) => [...current, { template_id: templates[0]?.id ?? "", delay_hours: 24 }])} className="min-h-11 flex-1 rounded-xl border border-line bg-white px-4 text-sm font-bold text-indigo disabled:opacity-40">+ Add follow-up</button>
              <button disabled={busy === "sequence" || templates.length === 0} className="min-h-11 flex-1 rounded-xl bg-indigo px-4 text-sm font-extrabold text-white disabled:opacity-50">{busy === "sequence" ? "Creating…" : "Save sequence"}</button>
            </div>
          </form>

          <section className="rounded-2xl border border-line/70 bg-white p-5">
            <h2 className="text-lg font-bold text-navy">Active sequences</h2>
            <div className="mt-4 grid gap-3">
              {sequences.length === 0 ? <p className="rounded-xl border border-dashed border-line p-5 text-sm text-ink-muted">No sequences yet.</p> : sequences.map((sequence) => (
                <article key={sequence.id} className="rounded-xl border border-line/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-extrabold text-navy">{sequence.name}</p><p className="mt-1 text-xs text-ink-muted">{sequence.steps.length} step{sequence.steps.length === 1 ? "" : "s"}</p></div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] ${statusTone(sequence.status)}`}>{sequence.status}</span>
                  </div>
                  <ol className="mt-4 grid gap-2">
                    {sequence.steps.map((step) => <li key={step.id} className="flex gap-3 rounded-lg bg-slate-50 px-3 py-2.5"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-soft text-xs font-black text-indigo">{step.step_order}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-ink">{step.title || templates.find((template) => template.id === step.template_id)?.title || "Template"}</p><p className="text-[11px] text-ink-muted">{humanDelay(step.delay_hours)}</p></div></li>)}
                  </ol>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "campaigns" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <form onSubmit={createCampaign} className="rounded-2xl border border-line/70 bg-white p-5">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-indigo">Targeted outreach</p>
            <h2 className="mt-1 text-xl font-bold text-navy">Create campaign</h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">Campaigns start as drafts so you can verify the sequence, job context and recipients before launch.</p>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-1.5 text-xs font-bold text-ink-muted">Campaign name
                <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} required maxLength={160} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold text-ink" />
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-ink-muted">Sequence
                <select value={campaignSequenceID} onChange={(e) => setCampaignSequenceID(e.target.value)} required className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm text-ink">
                  <option value="">Select sequence</option>
                  {sequences.filter((sequence) => sequence.status === "active").map((sequence) => <option key={sequence.id} value={sequence.id}>{sequence.name}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-ink-muted">Job context <span className="font-medium">(optional)</span>
                <select value={campaignJobID} onChange={(e) => setCampaignJobID(e.target.value)} className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm text-ink">
                  <option value="">No job context</option>
                  {activeJobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
                </select>
              </label>
              <fieldset className="rounded-xl border border-line/70">
                <legend className="ml-3 px-2 text-xs font-bold text-ink-muted">Recipients · {selectedCount} selected</legend>
                <div className="max-h-72 overflow-y-auto p-2">
                  {candidates.length === 0 ? <p className="p-3 text-sm text-ink-muted">Save candidates to Talent Pools before creating a campaign.</p> : candidates.map((candidate) => (
                    <label key={candidate.candidate_id} className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50">
                      <input type="checkbox" checked={selectedCandidates.has(candidate.candidate_id)} onChange={() => toggleCandidate(candidate.candidate_id)} className="mt-0.5 h-4 w-4 rounded border-line" />
                      <span className="min-w-0"><span className="block truncate text-sm font-bold text-ink">{candidate.full_name}</span><span className="block truncate text-xs text-ink-muted">{candidate.headline ?? candidate.current_city ?? "Candidate"}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button disabled={busy === "campaign" || selectedCount === 0 || !campaignSequenceID} className="min-h-11 rounded-xl bg-indigo px-4 text-sm font-extrabold text-white disabled:opacity-50">{busy === "campaign" ? "Creating…" : "Create draft campaign"}</button>
            </div>
          </form>

          <section className="rounded-2xl border border-line/70 bg-white p-5">
            <h2 className="text-lg font-bold text-navy">Campaigns</h2>
            <div className="mt-4 grid gap-3">
              {campaigns.length === 0 ? <p className="rounded-xl border border-dashed border-line p-5 text-sm text-ink-muted">No campaigns yet. Create a sequence first, then target candidates from your talent pool.</p> : campaigns.map((campaign) => (
                <article key={campaign.id} className="rounded-xl border border-line/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate font-extrabold text-navy">{campaign.name}</p><p className="mt-1 text-xs text-ink-muted">{campaign.sequence_name}{campaign.job_title ? ` · ${campaign.job_title}` : ""}</p></div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] ${statusTone(campaign.status)}`}>{campaign.status}</span>
                  </div>
                  <dl className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-slate-50 p-3 text-center">
                    <div><dt className="text-[10px] text-ink-muted">Recipients</dt><dd className="mt-1 text-sm font-black text-navy">{campaign.total_recipients}</dd></div>
                    <div><dt className="text-[10px] text-ink-muted">Sent</dt><dd className="mt-1 text-sm font-black text-navy">{campaign.sent_count}</dd></div>
                    <div><dt className="text-[10px] text-ink-muted">Skipped</dt><dd className="mt-1 text-sm font-black text-navy">{campaign.skipped_count}</dd></div>
                    <div><dt className="text-[10px] text-ink-muted">Failed</dt><dd className="mt-1 text-sm font-black text-navy">{campaign.failed_count}</dd></div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {campaign.status === "draft" && <button type="button" disabled={busy === campaign.id} onClick={() => launchCampaign(campaign.id)} className="min-h-9 rounded-lg bg-indigo px-3.5 text-xs font-extrabold text-white disabled:opacity-50">Launch campaign</button>}
                    {campaign.status === "running" && <button type="button" disabled={busy === campaign.id} onClick={() => changeCampaignStatus(campaign.id, "paused")} className="min-h-9 rounded-lg border border-amber-200 bg-amber-50 px-3.5 text-xs font-extrabold text-amber-700">Pause</button>}
                    {campaign.status === "paused" && <button type="button" disabled={busy === campaign.id} onClick={() => changeCampaignStatus(campaign.id, "running")} className="min-h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 text-xs font-extrabold text-emerald-700">Resume</button>}
                    {(campaign.status === "draft" || campaign.status === "running" || campaign.status === "paused") && <button type="button" disabled={busy === campaign.id} onClick={() => changeCampaignStatus(campaign.id, "cancelled")} className="min-h-9 rounded-lg border border-line bg-white px-3.5 text-xs font-bold text-ink-muted hover:text-rose-600">Cancel</button>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
