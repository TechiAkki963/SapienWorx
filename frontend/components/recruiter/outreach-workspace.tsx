"use client";

import { useId, useMemo, useRef, useState } from "react";

import { RecruiterDataTable, WorkspaceState, RecruiterDrawer, recruiterPrimary, recruiterSecondary } from "./workspace-ui";
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
  const formID = useId();
  const launchKeys = useRef(new Map<string, string>());
  const [tab, setTab] = useState<Tab>("campaigns");
  const [editor,setEditor]=useState<Tab|null>(null);
  const [campaignStep,setCampaignStep]=useState(0);
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
      setEditor(null);
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
      setEditor(null);setNotice("Sequence created and ready for campaigns.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Sequence could not be created.");
    } finally {
      setBusy(null);
    }
  }

  async function createCampaign(event: React.FormEvent) {
    event.preventDefault();
    if (campaignStep !== 3 || busy === "campaign") return;
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
      setEditor(null);setCampaignStep(0);setNotice("Campaign saved as draft. Review it before launch.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Campaign could not be created.");
    } finally {
      setBusy(null);
    }
  }

  async function launchCampaign(id: string) {
    if (!launchKeys.current.has(id)) launchKeys.current.set(id, window.crypto.randomUUID());
    setBusy(id);
    setNotice(null);
    try {
      const response = await apiRequest<{ campaign: OutreachCampaign }>("/api/v1/recruiter/outreach/campaigns/" + id + "/launch", {
        method: "POST",
        headers: { "X-Idempotency-Key": launchKeys.current.get(id)! },
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

  function campaignActions(campaign:OutreachCampaign) {
    return <div className="flex flex-wrap gap-2">
      {campaign.status==="draft" && <button type="button" disabled={busy===campaign.id} onClick={()=>launchCampaign(campaign.id)} className={recruiterPrimary}>Launch campaign</button>}
      {campaign.status==="running" && <button type="button" disabled={busy===campaign.id} onClick={()=>changeCampaignStatus(campaign.id,"paused")} className={recruiterSecondary}>Pause</button>}
      {campaign.status==="paused" && <button type="button" disabled={busy===campaign.id} onClick={()=>changeCampaignStatus(campaign.id,"running")} className={recruiterSecondary}>Resume</button>}
      {["draft","running","paused"].includes(campaign.status) && <button type="button" disabled={busy===campaign.id} onClick={()=>changeCampaignStatus(campaign.id,"cancelled")} className={recruiterSecondary}>Cancel</button>}
    </div>;
  }

  return (
    <div className="min-w-0 max-w-full grid gap-5 pb-24">
      <dl className="grid grid-cols-2 rounded-xl border border-line bg-white"><div className="p-4"><dt className="text-xs text-ink-muted">Running campaigns</dt><dd className="mt-1 text-2xl font-semibold text-navy">{runningCount}</dd></div><div className="p-4"><dt className="text-xs text-ink-muted">Messages sent</dt><dd className="mt-1 text-2xl font-semibold text-navy">{totalSent}</dd></div></dl>
      <p className="text-xs leading-6 text-ink-muted">Outreach respects candidate consent, recipient preferences and delivery limits.</p>

      <div className="flex min-w-0 max-w-full gap-1 overflow-x-auto rounded-2xl border border-line/70 bg-white p-1.5" role="tablist" aria-label="Outreach workspace">
        {(["campaigns", "sequences", "templates"] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            id={`outreach-tab-${item}`}
            aria-controls={`outreach-panel-${item}`}
            tabIndex={tab === item ? 0 : -1}
            onKeyDown={event => {
              const tabs: Tab[] = ["campaigns", "sequences", "templates"];
              const index = tabs.indexOf(item);
              const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1;
              if (next >= 0) { event.preventDefault(); setTab(tabs[next]); document.getElementById(`outreach-tab-${tabs[next]}`)?.focus(); }
            }}
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className={`min-h-11 min-w-0 flex-1 rounded-xl px-2 text-sm font-bold capitalize transition sm:px-4 ${tab === item ? "bg-navy text-white shadow-sm" : "text-ink-muted hover:bg-slate-50 hover:text-navy"}`}
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
        <div role="tabpanel" id="outreach-panel-templates" aria-labelledby="outreach-tab-templates" className="min-w-0 grid gap-5 ">
          <div><button type="button" className={recruiterPrimary} onClick={()=>{setEditor("templates");setCampaignStep(0);}}>Create message template</button><RecruiterDrawer open={editor==="templates"} onClose={()=>{if(!busy)setEditor(null);}} title="Create message template" footer={<><button type="button" disabled={Boolean(busy)} className={recruiterSecondary} onClick={()=>setEditor(null)}>Cancel</button><button type="submit" form={`${formID}-template`} disabled={busy === "template"} className={recruiterPrimary}>{busy === "template" ? "Creating…" : "Create template"}</button></>}><form id={`${formID}-template`} onSubmit={createTemplate} className="min-w-0 max-w-full rounded-2xl border border-line/70 bg-white p-5 shadow-[0_8px_24px_rgba(16,33,63,0.05)]">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-indigo">Reusable copy</p>
            <h2 className="mt-1 text-xl font-bold text-navy">Create message template</h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">Use CandidateName and JobTitle variables. Every sequence step references one saved template.</p>
            <div className="mt-5 grid gap-4">
              <label className="min-w-0 grid gap-1.5 text-xs font-bold text-ink-muted">Template name
                <input value={templateTitle} onChange={(e) => setTemplateTitle(e.target.value)} required maxLength={160} className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-indigo focus:ring-2 focus:ring-indigo-100" />
              </label>
              <label className="min-w-0 grid gap-1.5 text-xs font-bold text-ink-muted">Subject
                <input value={templateSubject} onChange={(e) => setTemplateSubject(e.target.value)} required maxLength={255} placeholder="{{JobTitle}} opportunity" className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-indigo focus:ring-2 focus:ring-indigo-100" />
              </label>
              <label className="min-w-0 grid gap-1.5 text-xs font-bold text-ink-muted">Message
                <textarea value={templateBody} onChange={(e) => setTemplateBody(e.target.value)} required rows={7} placeholder="Hi {{CandidateName}}, ..." className="w-full min-w-0 rounded-xl border border-line bg-white px-3 py-3 text-sm leading-6 text-ink outline-none focus:border-indigo focus:ring-2 focus:ring-indigo-100" />
              </label>
            </div>
          </form>{notice&&<p role="status" className="mt-3 text-sm text-ink">{notice}</p>}</RecruiterDrawer></div>

          <section><h2 className="mb-3 text-lg font-semibold text-navy">Saved templates</h2>{templates.length ? <RecruiterDataTable label="Message templates" rows={templates} rowKey={item=>item.id} columns={[
            {key:"name",title:"Template",width:"30%",render:item=><p className="font-semibold text-navy">{item.title}</p>},
            {key:"subject",title:"Subject",width:"40%",render:item=><p className="text-sm text-ink-muted">{item.subject_template}</p>},
            {key:"preview",title:"Message",width:"30%",render:item=><details><summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-indigo">Preview message</summary><p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-ink-muted">{item.body_template}</p></details>},
          ]} mobileRow={item=><div className="grid gap-2"><p className="font-semibold text-navy">{item.title}</p><p className="text-sm text-ink-muted">{item.subject_template}</p><details><summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-indigo">Preview message</summary><p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-ink-muted">{item.body_template}</p></details></div>}/> : <WorkspaceState title="No saved templates" description="Create reusable messages before building a follow-up sequence."/>}</section>
        </div>
      )}

      {tab === "sequences" && (
        <div role="tabpanel" id="outreach-panel-sequences" aria-labelledby="outreach-tab-sequences" className="min-w-0 grid gap-5 ">
          <div><button type="button" className={recruiterPrimary} onClick={()=>{setEditor("sequences");setCampaignStep(0);}}>Create sequence</button><RecruiterDrawer open={editor==="sequences"} onClose={()=>{if(!busy)setEditor(null);}} title="Create sequence" footer={<><button type="button" disabled={Boolean(busy)} className={recruiterSecondary} onClick={()=>setEditor(null)}>Cancel</button><button type="submit" form={`${formID}-sequence`} disabled={busy === "sequence" || templates.length === 0} className={recruiterPrimary}>{busy === "sequence" ? "Creating…" : "Save sequence"}</button></>}><form id={`${formID}-sequence`} onSubmit={createSequence} className="min-w-0 max-w-full rounded-2xl border border-line/70 bg-white p-5">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-indigo">Follow-up logic</p>
            <h2 className="mt-1 text-xl font-bold text-navy">Build a sequence</h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">The first step sends immediately. Later steps run server-side and stop automatically after a candidate replies.</p>
            <label className="mt-5 grid gap-1.5 text-xs font-bold text-ink-muted">Sequence name
              <input value={sequenceName} onChange={(e) => setSequenceName(e.target.value)} required maxLength={160} className="min-h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm font-semibold text-ink outline-none focus:border-indigo focus:ring-2 focus:ring-indigo-100" />
            </label>
            <div className="mt-4 grid gap-3">
              {sequenceSteps.map((step, index) => (
                <div key={index} className="rounded-xl border border-line/70 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-extrabold text-navy">Step {index + 1}</p>
                    {index > 0 && <button type="button" onClick={() => setSequenceSteps((current) => current.filter((_, i) => i !== index))} className="text-xs font-bold text-rose-600">Remove</button>}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_10rem]">
                    <label className="min-w-0 grid gap-1.5 text-xs font-bold text-ink-muted">Template
                      <select value={step.template_id} required onChange={(e) => setSequenceSteps((current) => current.map((candidate, i) => i === index ? { ...candidate, template_id: e.target.value } : candidate))} className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm text-ink">
                        <option value="">Select template</option>
                        {templates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}
                      </select>
                    </label>
                    <label className="min-w-0 grid gap-1.5 text-xs font-bold text-ink-muted">Delay hours
                      <input type="number" min={index === 0 ? 0 : 1} max={720} disabled={index === 0} value={step.delay_hours} onChange={(e) => setSequenceSteps((current) => current.map((candidate, i) => i === index ? { ...candidate, delay_hours: Number(e.target.value) } : candidate))} className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm text-ink disabled:bg-slate-100" />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button type="button" disabled={sequenceSteps.length >= 12 || templates.length === 0} onClick={() => setSequenceSteps((current) => [...current, { template_id: templates[0]?.id ?? "", delay_hours: 24 }])} className="min-h-11 flex-1 rounded-xl border border-line bg-white px-4 text-sm font-bold text-indigo disabled:opacity-40">+ Add follow-up</button>
            </div>
          </form>{notice&&<p role="status" className="mt-3 text-sm text-ink">{notice}</p>}</RecruiterDrawer></div>

          <section><h2 className="mb-3 text-lg font-semibold text-navy">Active sequences</h2>{sequences.length ? <RecruiterDataTable label="Outreach sequences" rows={sequences} rowKey={item=>item.id} columns={[
            {key:"name",title:"Sequence",width:"40%",render:item=><p className="font-semibold text-navy">{item.name}</p>},
            {key:"status",title:"Status",width:"20%",render:item=><span className={`rounded-full border px-2 py-1 text-xs ${statusTone(item.status)}`}>{item.status}</span>},
            {key:"steps",title:"Follow-up steps",width:"40%",render:item=><details><summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-indigo">{item.steps.length} steps · View timing</summary><ol className="mt-2 grid gap-2">{item.steps.map(step=><li key={step.id} className="text-xs leading-6 text-ink-muted">{step.step_order}. {step.title || templates.find(template=>template.id===step.template_id)?.title || "Template"} · {humanDelay(step.delay_hours)}</li>)}</ol></details>},
          ]} mobileRow={item=><div className="grid gap-2"><p className="font-semibold text-navy">{item.name}</p><p className="text-xs text-ink-muted">{item.status} · {item.steps.length} steps</p><details><summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-indigo">View timing</summary><ol>{item.steps.map(step=><li key={step.id} className="text-xs leading-6 text-ink-muted">{step.step_order}. {step.title} · {humanDelay(step.delay_hours)}</li>)}</ol></details></div>}/> : <WorkspaceState title="No sequences" description="Save a message template, then build a sequence with explicit follow-up delays."/>}</section>
        </div>
      )}

      {tab === "campaigns" && (
        <div role="tabpanel" id="outreach-panel-campaigns" aria-labelledby="outreach-tab-campaigns" className="min-w-0 grid gap-5 ">
          <div><button type="button" className={recruiterPrimary} onClick={()=>{setEditor("campaigns");setCampaignStep(0);}}>Create campaign</button><RecruiterDrawer open={editor==="campaigns"} onClose={()=>{if(!busy)setEditor(null);}} title="Create campaign" footer={<><button type="button" disabled={Boolean(busy)} className={recruiterSecondary} onClick={()=>setEditor(null)}>Cancel</button>{campaignStep>0&&<button type="button" className={recruiterSecondary} onClick={()=>setCampaignStep(step=>step-1)}>Back</button>}{campaignStep<3?<button key="continue-step" type="button" className={recruiterPrimary} disabled={campaignStep===0?(!campaignName.trim()||selectedCount===0):campaignStep===1?!campaignSequenceID:false} onClick={event=>{event.preventDefault();setCampaignStep(step=>step+1);}}>Continue</button>:<button key="create-reviewed-draft" type="submit" form={`${formID}-campaign`} className={recruiterPrimary} disabled={busy==="campaign"||!campaignName.trim()||!selectedCount||!campaignSequenceID}>{busy==="campaign"?"Creating…":"Create draft campaign"}</button>}</>}><form id={`${formID}-campaign`} onSubmit={createCampaign} className="min-w-0 max-w-full rounded-2xl border border-line/70 bg-white p-5">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-indigo">Targeted outreach</p>
            <h2 className="mt-1 text-xl font-bold text-navy">Create campaign</h2>
            <p className="mt-1 text-sm leading-6 text-ink-muted">Campaigns start as drafts so you can verify the sequence, job context and recipients before launch.</p>
<nav aria-label="Campaign setup steps" className="mt-4 flex flex-wrap gap-2">{["Audience","Message","Schedule","Review"].map((step,index)=><span key={step} aria-current={campaignStep===index?"step":undefined} className={`rounded-full px-3 py-2 text-xs ${campaignStep===index?"bg-indigo text-white":"text-ink-muted"}`}>{index+1}. {step}</span>)}</nav><div className="mt-5 grid gap-4"><div hidden={campaignStep!==0}>              <label className="min-w-0 grid gap-1.5 text-xs font-bold text-ink-muted">Campaign name
                <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} required maxLength={160} className="min-h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm font-semibold text-ink" />
              </label>               <fieldset className="min-w-0 max-w-full rounded-xl border border-line/70">
                <legend className="ml-3 px-2 text-xs font-bold text-ink-muted">Recipients · {selectedCount} selected</legend>
                <div className="max-h-72 overflow-y-auto p-2">
                  {candidates.length === 0 ? <p className="p-3 text-sm text-ink-muted">Save candidates to Talent Pools before creating a campaign.</p> : candidates.map((candidate) => (
                    <label key={candidate.candidate_id} className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50">
                      <input type="checkbox" checked={selectedCandidates.has(candidate.candidate_id)} onChange={() => toggleCandidate(candidate.candidate_id)} className="mt-0.5 h-4 w-4 rounded border-line" />
                      <span className="min-w-0"><span className="block truncate text-sm font-bold text-ink">{candidate.full_name}</span><span className="block truncate text-xs text-ink-muted">{candidate.headline ?? candidate.current_city ?? "Candidate"}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset></div><div hidden={campaignStep!==1}>              <label className="min-w-0 grid gap-1.5 text-xs font-bold text-ink-muted">Sequence
                <select value={campaignSequenceID} onChange={(e) => setCampaignSequenceID(e.target.value)} required className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm text-ink">
                  <option value="">Select sequence</option>
                  {sequences.filter((sequence) => sequence.status === "active").map((sequence) => <option key={sequence.id} value={sequence.id}>{sequence.name}</option>)}
                </select>
              </label>               <label className="min-w-0 grid gap-1.5 text-xs font-bold text-ink-muted">Job context <span className="font-medium">(optional)</span>
                <select value={campaignJobID} onChange={(e) => setCampaignJobID(e.target.value)} className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm text-ink">
                  <option value="">No job context</option>
                  {activeJobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
                </select>
              </label></div><div hidden={campaignStep!==2}><h3 className="text-sm font-semibold text-navy">Follow-up schedule</h3><p className="mt-2 text-sm leading-6 text-ink-muted">The existing sequence begins when you explicitly launch the draft. It stops future follow-ups after a reply. Calendar-based campaign scheduling is unavailable.</p><ol className="mt-4 grid gap-2">{sequences.find(sequence=>sequence.id===campaignSequenceID)?.steps.map(step=><li key={step.id} className="border-b border-line py-3 text-sm text-ink">{step.step_order}. {step.title} · {humanDelay(step.delay_hours)}</li>)}</ol></div><div hidden={campaignStep!==3}><h3 className="text-sm font-semibold text-navy">Review draft campaign</h3><p className="mt-3 text-sm text-ink">{campaignName} · {selectedCount} recipients selected</p><p className="mt-2 text-sm text-ink-muted">Sequence: {sequences.find(sequence=>sequence.id===campaignSequenceID)?.name}</p><p className="mt-3 text-xs leading-6 text-ink-muted">Consent, suppression, cooldown and delivery budgets are checked by the protected server path at launch. Creating this draft sends no messages.</p></div>            </div>
          </form>{notice&&<p role="status" className="mt-3 text-sm text-ink">{notice}</p>}</RecruiterDrawer></div>

          <section><h2 className="mb-3 text-lg font-semibold text-navy">Campaigns</h2>{campaigns.length ? <RecruiterDataTable label="Outreach campaigns" rows={campaigns} rowKey={item=>item.id} columns={[
            {key:"name",title:"Campaign",width:"33%",render:item=><div><p className="font-semibold text-navy">{item.name}</p><p className="mt-1 text-xs leading-5 text-ink-muted">{item.sequence_name}{item.job_title?` · ${item.job_title}`:""}</p></div>},
            {key:"status",title:"Status",width:"16%",render:item=><span className={`rounded-full border px-2 py-1 text-xs ${statusTone(item.status)}`}>{item.status}</span>},
            {key:"delivery",title:"Delivery",width:"26%",render:item=><p className="text-xs leading-6 text-ink-muted">{item.total_recipients} recipients<br/>{item.sent_count} sent · {item.skipped_count} skipped · {item.failed_count} failed</p>},
            {key:"actions",title:"Actions",width:"25%",render:campaignActions},
          ]} mobileRow={item=><div className="grid gap-3"><p className="font-semibold text-navy">{item.name}</p><p className="text-xs leading-6 text-ink-muted">{item.sequence_name} · {item.status}</p><p className="text-xs leading-6 text-ink-muted">{item.total_recipients} recipients · {item.sent_count} sent · {item.skipped_count} skipped · {item.failed_count} failed</p>{campaignActions(item)}</div>}/> : <WorkspaceState title="No campaigns" description="Create a sequence, then review a draft audience before launching outreach."/>}</section>
        </div>
      )}
    </div>
  );
}
