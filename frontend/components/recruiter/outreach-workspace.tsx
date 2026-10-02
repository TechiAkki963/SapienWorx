"use client";

import { useMemo, useState } from "react";

import { apiRequest } from "@/lib/api";

type SequenceStep = {
  id?: string;
  step_order: number;
  delay_hours: number;
  subject_template: string;
  body_template: string;
};

type Sequence = {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "archived";
  stop_on_reply: boolean;
  steps: SequenceStep[];
  updated_at: string;
};

type Campaign = {
  id: string;
  sequence_id: string;
  job_id?: string | null;
  name: string;
  status: "launching" | "active" | "paused" | "completed" | "cancelled" | "failed";
  requested_count: number;
  enrolled_count: number;
  skipped_count: number;
  created_at: string;
};

type Template = {
  id: string;
  title: string;
  subject_template: string;
  body_template: string;
  updated_at: string;
};

type Candidate = {
  candidate_id: string;
  full_name: string;
  headline?: string;
  current_city?: string;
};

type Job = {
  id: string;
  title: string;
  status: string;
};

type Tab = "campaigns" | "sequences" | "templates";

const statusTone: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  completed: "border-blue-200 bg-blue-50 text-blue-800",
  paused: "border-amber-200 bg-amber-50 text-amber-800",
  draft: "border-slate-200 bg-slate-50 text-slate-700",
  archived: "border-slate-200 bg-slate-50 text-slate-600",
  cancelled: "border-slate-200 bg-slate-50 text-slate-600",
  failed: "border-rose-200 bg-rose-50 text-rose-800",
  launching: "border-indigo-200 bg-indigo-50 text-indigo-800",
};

function StatusPill({ value }: { value: string }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] ${statusTone[value] ?? statusTone.draft}`}>{value}</span>;
}

function StepEditor({
  step,
  index,
  onChange,
  onRemove,
  removable,
}: {
  step: SequenceStep;
  index: number;
  onChange: (next: SequenceStep) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-[0_1px_3px_rgba(16,33,63,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-navy">Step {index + 1}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{index === 0 ? "Initial outreach · sends immediately" : "Follow-up on the same conversation"}</p>
        </div>
        {removable && <button type="button" onClick={onRemove} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50">Remove</button>}
      </div>
      {index > 0 && (
        <label className="mt-4 block text-xs font-bold text-ink-muted">
          Wait after previous step
          <div className="mt-1.5 flex items-center gap-2">
            <input
              aria-label={`Step ${index + 1} delay hours`}
              type="number"
              min={1}
              max={720}
              value={step.delay_hours}
              onChange={(event) => onChange({ ...step, delay_hours: Number(event.target.value) })}
              className="h-10 w-28 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-indigo"
            />
            <span className="text-xs text-ink-muted">hours</span>
          </div>
        </label>
      )}
      <label className="mt-4 block text-xs font-bold text-ink-muted">
        Subject
        <input
          aria-label={`Step ${index + 1} subject`}
          value={step.subject_template}
          onChange={(event) => onChange({ ...step, subject_template: event.target.value })}
          placeholder="{{JobTitle}} opportunity"
          className="mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-indigo"
        />
      </label>
      <label className="mt-4 block text-xs font-bold text-ink-muted">
        Message
        <textarea
          aria-label={`Step ${index + 1} message`}
          value={step.body_template}
          onChange={(event) => onChange({ ...step, body_template: event.target.value })}
          placeholder="Hi {{CandidateName}}, I wanted to follow up about {{JobTitle}}."
          rows={4}
          className="mt-1.5 w-full resize-y rounded-xl border border-line bg-white px-3 py-2.5 text-sm leading-6 text-ink outline-none focus:border-indigo"
        />
      </label>
      <p className="mt-2 text-[11px] text-ink-muted">Supported variables: <strong>{"{{CandidateName}}"}</strong> and <strong>{"{{JobTitle}}"}</strong>.</p>
    </div>
  );
}

export function OutreachWorkspace({
  initialSequences,
  initialCampaigns,
  initialTemplates,
  candidates,
  jobs,
}: {
  initialSequences: Sequence[];
  initialCampaigns: Campaign[];
  initialTemplates: Template[];
  candidates: Candidate[];
  jobs: Job[];
}) {
  const [tab, setTab] = useState<Tab>("campaigns");
  const [sequences, setSequences] = useState(initialSequences);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [templates, setTemplates] = useState(initialTemplates);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const [sequenceName, setSequenceName] = useState("");
  const [sequenceDescription, setSequenceDescription] = useState("");
  const [stopOnReply, setStopOnReply] = useState(true);
  const [steps, setSteps] = useState<SequenceStep[]>([{ step_order: 1, delay_hours: 0, subject_template: "", body_template: "" }]);

  const [campaignName, setCampaignName] = useState("");
  const [campaignSequenceID, setCampaignSequenceID] = useState("");
  const [campaignJobID, setCampaignJobID] = useState("");
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(() => new Set());

  const [templateTitle, setTemplateTitle] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateBody, setTemplateBody] = useState("");

  const activeSequences = useMemo(() => sequences.filter((item) => item.status === "active"), [sequences]);

  async function refreshSequences() {
    const response = await apiRequest<{ items: Sequence[] }>("/api/v1/recruiter/outreach/sequences");
    setSequences(response.items ?? []);
  }

  async function refreshCampaigns() {
    const response = await apiRequest<{ items: Campaign[] }>("/api/v1/recruiter/outreach/campaigns");
    setCampaigns(response.items ?? []);
  }

  async function refreshTemplates() {
    const response = await apiRequest<{ items: Template[] }>("/api/v1/recruiter/message-templates");
    setTemplates(response.items ?? []);
  }

  async function createSequence() {
    if (!sequenceName.trim() || steps.some((step) => !step.subject_template.trim() || !step.body_template.trim())) {
      setNotice("Add a sequence name and complete every step.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      await apiRequest("/api/v1/recruiter/outreach/sequences", {
        method: "POST",
        body: JSON.stringify({
          name: sequenceName,
          description: sequenceDescription,
          stop_on_reply: stopOnReply,
          steps: steps.map((step, index) => ({ ...step, step_order: index + 1 })),
        }),
      });
      await refreshSequences();
      setSequenceName("");
      setSequenceDescription("");
      setSteps([{ step_order: 1, delay_hours: 0, subject_template: "", body_template: "" }]);
      setNotice("Sequence saved as draft.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save the sequence.");
    } finally {
      setBusy(false);
    }
  }

  async function setSequenceStatus(id: string, status: "active" | "archived") {
    setBusy(true);
    try {
      await apiRequest(`/api/v1/recruiter/outreach/sequences/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refreshSequences();
      setNotice(status === "active" ? "Sequence activated." : "Sequence archived.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update the sequence.");
    } finally {
      setBusy(false);
    }
  }

  async function launchCampaign() {
    if (!campaignName.trim() || !campaignSequenceID || selectedCandidates.size === 0) {
      setNotice("Choose an active sequence, campaign name, and at least one candidate.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const key = window.crypto.randomUUID();
      const response = await apiRequest<{ campaign: Campaign }>("/api/v1/recruiter/outreach/campaigns", {
        method: "POST",
        headers: { "X-Idempotency-Key": key },
        body: JSON.stringify({
          sequence_id: campaignSequenceID,
          job_id: campaignJobID || undefined,
          name: campaignName,
          candidate_ids: Array.from(selectedCandidates),
        }),
      });
      await refreshCampaigns();
      setSelectedCandidates(new Set());
      setCampaignName("");
      setNotice(`Campaign launched: ${response.campaign.enrolled_count} enrolled, ${response.campaign.skipped_count} skipped by safeguards.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not launch the campaign.");
    } finally {
      setBusy(false);
    }
  }

  async function campaignAction(id: string, action: "pause" | "resume" | "cancel") {
    setBusy(true);
    try {
      await apiRequest(`/api/v1/recruiter/outreach/campaigns/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      await refreshCampaigns();
      setNotice(`Campaign ${action === "pause" ? "paused" : action === "resume" ? "resumed" : "cancelled"}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update the campaign.");
    } finally {
      setBusy(false);
    }
  }

  async function createTemplate() {
    if (!templateTitle.trim() || !templateSubject.trim() || !templateBody.trim()) {
      setNotice("Complete the template title, subject, and message.");
      return;
    }
    setBusy(true);
    try {
      await apiRequest("/api/v1/recruiter/message-templates", {
        method: "POST",
        body: JSON.stringify({
          title: templateTitle,
          subject_template: templateSubject,
          body_template: templateBody,
        }),
      });
      await refreshTemplates();
      setTemplateTitle("");
      setTemplateSubject("");
      setTemplateBody("");
      setNotice("Message template saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save the template.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTemplate(id: string) {
    setBusy(true);
    try {
      await apiRequest(`/api/v1/recruiter/message-templates/${id}`, { method: "DELETE" });
      await refreshTemplates();
      setNotice("Template removed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not remove the template.");
    } finally {
      setBusy(false);
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

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "campaigns", label: "Campaigns", count: campaigns.length },
    { id: "sequences", label: "Sequences", count: sequences.length },
    { id: "templates", label: "Templates", count: templates.length },
  ];

  return (
    <div className="min-w-0 max-w-full grid gap-5 pb-28 sm:pb-24">
      <header className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo">Governed recruiter outreach</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em] text-navy sm:text-3xl">Outreach</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">Build reusable sequences and run targeted campaigns on top of SapienWorx anti-spam, consent, cooldown, quota, and realtime messaging controls.</p>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs leading-5 text-indigo-900">
          <strong>Safety stays central.</strong> Replies stop sequences automatically when enabled. Candidate eligibility and sending limits are rechecked at delivery time.
        </div>
      </header>

      <div className="flex min-w-0 max-w-full overflow-x-auto rounded-2xl border border-line bg-white p-1.5 shadow-[0_1px_3px_rgba(16,33,63,0.04)]" role="tablist" aria-label="Outreach workspace sections">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => { setTab(item.id); setNotice(""); }}
            className={`min-h-10 shrink-0 whitespace-nowrap rounded-xl px-3 text-sm font-extrabold transition sm:flex-1 sm:px-4 ${tab === item.id ? "bg-navy text-white shadow-sm" : "text-ink-muted hover:bg-slate-50 hover:text-ink"}`}
          >
            {item.label} <span className="ml-1 opacity-70">{item.count}</span>
          </button>
        ))}
      </div>

      {notice && <div role="status" className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-900">{notice}</div>}

      {tab === "campaigns" && (
        <div className="min-w-0 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,.85fr)]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_4px_18px_rgba(16,33,63,0.05)]">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-lg font-extrabold text-navy">Campaign activity</h2>
              <p className="mt-1 text-xs text-ink-muted">Pause, resume, or cancel without bypassing scheduled delivery safeguards.</p>
            </div>
            <div className="divide-y divide-line">
              {campaigns.length === 0 ? (
                <div className="p-8 text-center text-sm text-ink-muted">No campaigns yet. Launch your first sequence from the panel on the right.</div>
              ) : campaigns.map((campaign) => (
                <article key={campaign.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-navy">{campaign.name}</h3>
                      <p className="mt-1 text-xs text-ink-muted">Started {new Date(campaign.created_at).toLocaleString("en-IN")}</p>
                    </div>
                    <StatusPill value={campaign.status} />
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      ["Requested", campaign.requested_count],
                      ["Enrolled", campaign.enrolled_count],
                      ["Skipped", campaign.skipped_count],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                        <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted">{label}</dt>
                        <dd className="mt-1 text-lg font-extrabold text-navy">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {(campaign.status === "active" || campaign.status === "paused") && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {campaign.status === "active" ? (
                        <button disabled={busy} onClick={() => campaignAction(campaign.id, "pause")} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink hover:bg-slate-50">Pause</button>
                      ) : (
                        <button disabled={busy} onClick={() => campaignAction(campaign.id, "resume")} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink hover:bg-slate-50">Resume</button>
                      )}
                      <button disabled={busy} onClick={() => campaignAction(campaign.id, "cancel")} className="rounded-lg px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">Cancel campaign</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="h-fit rounded-2xl border border-line bg-white p-5 shadow-[0_4px_18px_rgba(16,33,63,0.05)]">
            <h2 className="text-lg font-extrabold text-navy">Launch campaign</h2>
            <p className="mt-1 text-xs leading-5 text-ink-muted">Only active sequences can launch. Recipients must already be in your Talent Pool and eligible for outreach.</p>
            <label className="mt-5 block text-xs font-bold text-ink-muted">Campaign name
              <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Senior operations follow-up" className="mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-indigo" />
            </label>
            <label className="mt-4 block text-xs font-bold text-ink-muted">Sequence
              <select value={campaignSequenceID} onChange={(event) => setCampaignSequenceID(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-indigo">
                <option value="">Choose active sequence</option>
                {activeSequences.map((sequence) => <option key={sequence.id} value={sequence.id}>{sequence.name} · {sequence.steps.length} step{sequence.steps.length === 1 ? "" : "s"}</option>)}
              </select>
            </label>
            <label className="mt-4 block text-xs font-bold text-ink-muted">Job context <span className="font-normal">(optional unless template uses JobTitle)</span>
              <select value={campaignJobID} onChange={(event) => setCampaignJobID(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-indigo">
                <option value="">No job context</option>
                {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
              </select>
            </label>
            <fieldset className="mt-4">
              <legend className="text-xs font-bold text-ink-muted">Recipients · {selectedCandidates.size} selected</legend>
              <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-line">
                {candidates.map((candidate) => (
                  <label key={candidate.candidate_id} className="flex cursor-pointer items-start gap-3 border-b border-line/60 px-3 py-3 last:border-b-0 hover:bg-slate-50">
                    <input aria-label={`Select ${candidate.full_name}`} type="checkbox" checked={selectedCandidates.has(candidate.candidate_id)} onChange={() => toggleCandidate(candidate.candidate_id)} className="mt-1 h-4 w-4 accent-indigo" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-ink">{candidate.full_name}</span>
                      <span className="mt-0.5 block truncate text-xs text-ink-muted">{candidate.headline ?? "Candidate"}{candidate.current_city ? ` · ${candidate.current_city}` : ""}</span>
                    </span>
                  </label>
                ))}
                {candidates.length === 0 && <p className="p-4 text-sm text-ink-muted">Your Talent Pool is empty.</p>}
              </div>
            </fieldset>
            <button disabled={busy || !activeSequences.length} onClick={launchCampaign} className="mt-5 min-h-11 w-full rounded-xl bg-indigo px-4 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(79,70,229,0.22)] transition hover:bg-indigo/90 disabled:cursor-not-allowed disabled:opacity-50">Launch governed campaign</button>
          </section>
        </div>
      )}

      {tab === "sequences" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(22rem,.8fr)_minmax(0,1.2fr)]">
          <section className="h-fit rounded-2xl border border-line bg-white p-5 shadow-[0_4px_18px_rgba(16,33,63,0.05)]">
            <h2 className="text-lg font-extrabold text-navy">New sequence</h2>
            <p className="mt-1 text-xs text-ink-muted">Up to five steps. Step one sends immediately; later delays are measured from the previous step.</p>
            <label className="mt-5 block text-xs font-bold text-ink-muted">Sequence name
              <input value={sequenceName} onChange={(event) => setSequenceName(event.target.value)} placeholder="Qualified candidate follow-up" className="mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-indigo" />
            </label>
            <label className="mt-4 block text-xs font-bold text-ink-muted">Description
              <textarea value={sequenceDescription} onChange={(event) => setSequenceDescription(event.target.value)} rows={3} placeholder="Optional internal context for recruiters." className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-indigo" />
            </label>
            <label className="mt-4 flex items-start gap-3 rounded-xl border border-line bg-slate-50 p-3">
              <input type="checkbox" checked={stopOnReply} onChange={(event) => setStopOnReply(event.target.checked)} className="mt-1 h-4 w-4 accent-indigo" />
              <span><span className="block text-sm font-bold text-ink">Stop after candidate reply</span><span className="mt-0.5 block text-xs leading-5 text-ink-muted">Recommended. A candidate response automatically stops pending automated follow-ups.</span></span>
            </label>
            <div className="mt-5 grid gap-3">
              {steps.map((step, index) => (
                <StepEditor
                  key={index}
                  step={step}
                  index={index}
                  removable={steps.length > 1}
                  onRemove={() => setSteps((current) => current.filter((_, position) => position !== index).map((item, position) => ({ ...item, step_order: position + 1 })))}
                  onChange={(next) => setSteps((current) => current.map((item, position) => position === index ? next : item))}
                />
              ))}
            </div>
            {steps.length < 5 && <button type="button" onClick={() => setSteps((current) => [...current, { step_order: current.length + 1, delay_hours: 48, subject_template: current[0]?.subject_template ?? "", body_template: "" }])} className="mt-3 w-full rounded-xl border border-dashed border-indigo-200 px-4 py-3 text-sm font-bold text-indigo hover:bg-indigo-50">+ Add follow-up step</button>}
            <button disabled={busy} onClick={createSequence} className="mt-4 min-h-11 w-full rounded-xl bg-indigo px-4 text-sm font-extrabold text-white disabled:opacity-50">Save sequence draft</button>
          </section>

          <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_4px_18px_rgba(16,33,63,0.05)]">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-lg font-extrabold text-navy">Sequence library</h2>
              <p className="mt-1 text-xs text-ink-muted">Campaigns snapshot active sequences so later edits cannot silently change messages already scheduled.</p>
            </div>
            <div className="divide-y divide-line">
              {sequences.length === 0 ? <p className="p-8 text-center text-sm text-ink-muted">No sequences yet.</p> : sequences.map((sequence) => (
                <article key={sequence.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-navy">{sequence.name}</h3>
                      <p className="mt-1 max-w-2xl text-xs leading-5 text-ink-muted">{sequence.description || "No internal description."}</p>
                    </div>
                    <StatusPill value={sequence.status} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {sequence.steps.map((step) => <span key={step.step_order} className="rounded-full border border-line bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-ink-muted">Step {step.step_order}{step.step_order > 1 ? ` · +${step.delay_hours}h` : " · now"}</span>)}
                  </div>
                  <p className="mt-3 text-xs text-ink-muted">{sequence.stop_on_reply ? "Stops on candidate reply" : "Continues after replies"}</p>
                  <div className="mt-4 flex gap-2">
                    {sequence.status === "draft" && <button disabled={busy} onClick={() => setSequenceStatus(sequence.id, "active")} className="rounded-lg bg-indigo px-3 py-2 text-xs font-extrabold text-white">Activate</button>}
                    {sequence.status !== "archived" && <button disabled={busy} onClick={() => setSequenceStatus(sequence.id, "archived")} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-muted hover:bg-slate-50">Archive</button>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "templates" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(22rem,.8fr)_minmax(0,1.2fr)]">
          <section className="h-fit rounded-2xl border border-line bg-white p-5 shadow-[0_4px_18px_rgba(16,33,63,0.05)]">
            <h2 className="text-lg font-extrabold text-navy">New message template</h2>
            <p className="mt-1 text-xs text-ink-muted">Reusable copy for one-off and bulk InMail. Sequence steps keep their own snapshots.</p>
            <label className="mt-5 block text-xs font-bold text-ink-muted">Template title
              <input value={templateTitle} onChange={(event) => setTemplateTitle(event.target.value)} placeholder="Role introduction" className="mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-indigo" />
            </label>
            <label className="mt-4 block text-xs font-bold text-ink-muted">Subject
              <input value={templateSubject} onChange={(event) => setTemplateSubject(event.target.value)} placeholder="{{JobTitle}} opportunity" className="mt-1.5 h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-indigo" />
            </label>
            <label className="mt-4 block text-xs font-bold text-ink-muted">Message
              <textarea value={templateBody} onChange={(event) => setTemplateBody(event.target.value)} rows={6} placeholder="Hi {{CandidateName}}, ..." className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm leading-6 text-ink outline-none focus:border-indigo" />
            </label>
            <button disabled={busy} onClick={createTemplate} className="mt-5 min-h-11 w-full rounded-xl bg-indigo px-4 text-sm font-extrabold text-white disabled:opacity-50">Save template</button>
          </section>

          <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_4px_18px_rgba(16,33,63,0.05)]">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-lg font-extrabold text-navy">Template library</h2>
              <p className="mt-1 text-xs text-ink-muted">Available in the Bulk InMail composer and for recruiter-authored messaging.</p>
            </div>
            <div className="divide-y divide-line">
              {templates.length === 0 ? <p className="p-8 text-center text-sm text-ink-muted">No saved templates yet.</p> : templates.map((template) => (
                <article key={template.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-navy">{template.title}</h3>
                      <p className="mt-2 text-sm font-bold text-ink">{template.subject_template}</p>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{template.body_template}</p>
                    </div>
                    <button disabled={busy} onClick={() => deleteTemplate(template.id)} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50">Delete</button>
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
