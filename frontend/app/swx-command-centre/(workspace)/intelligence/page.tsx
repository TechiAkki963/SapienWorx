import { HumanReviewActions, IntelligenceSwitchControl, InsightReviewActions, ModelActions, ModelRegistrationForm, PromptActions, PromptRegistrationForm, RunIntelligenceButton } from "@/components/admin/intelligence-actions";
import { requireAdminWorkspace } from "@/lib/admin-access-server";
import { adminAPI } from "@/lib/admin-server";

type Run={id:string;engine_version:string;status:string;metrics:Record<string,number>;requested_by:string;completed_at:string};
type Insight={id:string;domain:string;severity:string;title:string;rationale:string;evidence:Record<string,unknown>;recommendation:string;confidence:number;status:string};
type Model={id:string;engine_type:string;version:string;provider:string;model_ref:string;config:Record<string,unknown>;status:string;approval_id?:string;created_at:string;activated_at?:string};
type Eval={id:string;model_version_id:string;dataset_ref:string;metrics:Record<string,unknown>;quality_gate_status:string;started_at:string;completed_at?:string;notes:string};
type Switch={key:string;enabled:boolean;requires_approval_to_enable:boolean;description:string;changed_at:string};
type Heartbeat={engine_key:string;status:string;version:string;metadata:Record<string,unknown>;last_seen_at:string};
type Prompt={id:string;prompt_key:string;version:number;template:string;variables:string[];status:string;model_version_id?:string;approval_id?:string;created_at:string;activated_at?:string};
type HumanReview={id:string;review_type:string;subject_type:string;subject_id?:string;priority:string;reason_code:string;evidence:Record<string,unknown>;recommendation:Record<string,unknown>;status:string;assigned_to?:string;reviewed_by?:string;review_note:string;created_at:string;updated_at:string;reviewed_at?:string};
type Dashboard={runs:Run[];insights:Insight[];models:Model[];evaluations:Eval[];switches:Switch[];heartbeats:Heartbeat[];prompts:Prompt[];human_reviews:HumanReview[];gateway:{requests_24h:number;failures_24h:number;blocked_24h:number;estimated_cost_24h:number;avg_latency_ms_24h:number;redactions_24h:number};store:{pending_events:number;failed_events:number;dead_letters:number;candidate_features:number;job_features:number;match_results:number;feedback_events:number;embedding_documents:number;open_human_reviews:number;oldest_pending_seconds:number};computed_at:string;advisory_only:boolean};

function Pill({value}:{value:string}){const good=["healthy","production","passed","enabled","approved"].includes(value);const bad=["failed","degraded","rejected","stopped"].includes(value);return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${good?"bg-emerald-50 text-emerald-700":bad?"bg-red-50 text-red-700":"bg-amber-50 text-amber-800"}`}>{value.replaceAll("_"," ")}</span>}
function Metric({label,value}:{label:string;value:string|number}){return <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p></div>}

export default async function IntelligencePage(){
  await requireAdminWorkspace("intelligence.read");
  const data=await adminAPI<Dashboard>("/api/v1/admin/intelligence");
  const latest=data.runs[0];
  const now=Date.now();
  return <section className="min-w-0 space-y-5">
    <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">SapienWorx Intelligence Centre</p>
      <h1 className="mt-3 text-3xl font-bold text-slate-950">Control plane for the separate Intelligence Engine</h1>
      <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-600">Master Admin governs intelligence; the separate <code>sapienworx-intelligence</code> runtime processes the outbox, cross-industry taxonomy features, candidate/job intelligence, matching, governed embedding documents, feedback and evaluations. Browser clients never call the processing engine directly.</p>
      <div role="note" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Human-controlled by design.</strong> Learning signals do not directly modify production models. Promotion requires a passed evaluation and an independently approved governance request. Fraud and suspicious-candidate/job intelligence remains isolated to the Master Admin trust-review area and is never exposed as recruiter-facing labels.</div>
      <div className="mt-5"><RunIntelligenceButton/></div>
    </header>

    <section aria-label="Intelligence runtime scorecard" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Metric label="Pending events" value={data.store.pending_events}/>
      <Metric label="Retrying failures" value={data.store.failed_events}/>
      <Metric label="Dead letters" value={data.store.dead_letters}/>
      <Metric label="Oldest pending" value={data.store.oldest_pending_seconds<60?Math.round(data.store.oldest_pending_seconds)+" s":Math.round(data.store.oldest_pending_seconds/60)+" min"}/>
      <Metric label="Human reviews" value={data.store.open_human_reviews}/>
      <Metric label="Candidate features" value={data.store.candidate_features}/>
      <Metric label="Job features" value={data.store.job_features}/>
      <Metric label="Match results" value={data.store.match_results}/>
      <Metric label="Embedding docs" value={data.store.embedding_documents}/>
      <Metric label="Feedback labels" value={data.store.feedback_events}/>
    </section>

    <div className="grid gap-5 xl:grid-cols-2">
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-950">Engine health</h2>
        <p className="mt-1 text-xs text-slate-500">Heartbeat freshness distinguishes a healthy processing plane from a disconnected UI.</p>
        <div className="mt-4 space-y-3">{data.heartbeats.length===0?<p className="text-sm text-slate-500">No Intelligence Engine heartbeat has been recorded.</p>:data.heartbeats.map(v=>{const stale=now-new Date(v.last_seen_at).getTime()>120000;return <article key={v.engine_key} className="min-w-0 rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between gap-2"><div><p className="font-semibold text-slate-900">{v.engine_key}</p><p className="mt-1 text-xs text-slate-500">{v.version} · last seen {new Date(v.last_seen_at).toLocaleString("en-IN",{timeZone:"UTC"})} UTC</p></div><Pill value={stale?"stopped":v.status}/></div></article>})}</div>
      </section>
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-950">AI Gateway</h2>
        <p className="mt-1 text-xs text-slate-500">The gateway remains provider-agnostic and external providers stay disabled until explicitly governed.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric label="Requests · 24h" value={data.gateway.requests_24h}/>
          <Metric label="Failures · 24h" value={data.gateway.failures_24h}/>
          <Metric label="Blocked · 24h" value={data.gateway.blocked_24h}/>
          <Metric label="Avg latency" value={Math.round(data.gateway.avg_latency_ms_24h)+" ms"}/>
          <Metric label="Redactions" value={data.gateway.redactions_24h}/>
          <Metric label="Estimated cost" value={"$"+data.gateway.estimated_cost_24h.toFixed(4)}/>
        </div>
      </section>
    </div>

    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-slate-950">Intelligence kill switches</h2>
      <p className="mt-1 text-xs text-slate-500">Disabling a capability does not disable SapienWorx core recruitment workflows. Enabling governed capabilities requires an approved request.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{data.switches.map(v=><article key={v.key} className="min-w-0 rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between gap-2"><p className="min-w-0 break-all font-mono text-xs font-bold text-slate-800">{v.key}</p><Pill value={v.enabled?"enabled":"disabled"}/></div><IntelligenceSwitchControl switchKey={v.key} enabled={v.enabled} description={v.description}/></article>)}</div>
    </section>

    <div className="grid gap-5 xl:grid-cols-2"><ModelRegistrationForm/><PromptRegistrationForm/></div>

    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-slate-950">Prompt Registry</h2>
      <p className="mt-1 text-xs text-slate-500">Versioned prompts are centrally governed; services should not embed provider prompts independently.</p>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">{data.prompts.length===0?<p className="text-sm text-slate-500">No prompt versions registered.</p>:data.prompts.map(v=><article key={v.id} className="min-w-0 rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between gap-2"><div><p className="min-w-0 break-all font-mono text-xs font-bold text-slate-800">{v.prompt_key}</p><p className="mt-1 text-xs text-slate-500">version {v.version} · {v.variables.join(", ")||"no variables"}</p></div><Pill value={v.status}/></div><pre className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700">{v.template}</pre><PromptActions id={v.id} status={v.status}/></article>)}</div>
    </section>

    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-slate-950">Model & engine registry</h2>
      <p className="mt-1 text-xs text-slate-500">Candidate versions are evaluated offline/observationally before any controlled promotion.</p>
      <div className="mt-4 max-w-full overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="py-2">Engine</th><th>Version</th><th>Provider</th><th>Model ref</th><th>Status</th><th>Activated</th><th>Actions</th></tr></thead><tbody>{data.models.map(v=><tr key={v.id} className="border-t border-slate-100"><td className="py-3 font-semibold">{v.engine_type.replaceAll("_"," ")}</td><td>{v.version}</td><td>{v.provider}</td><td className="break-all font-mono text-xs">{v.model_ref}</td><td><Pill value={v.status}/></td><td className="text-xs text-slate-500">{v.activated_at?new Date(v.activated_at).toLocaleString("en-IN",{timeZone:"UTC"})+" UTC":"—"}</td><td><ModelActions id={v.id} status={v.status}/></td></tr>)}</tbody></table></div>
    </section>

    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-slate-950">Evaluations</h2>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">{data.evaluations.length===0?<p className="text-sm text-slate-500">No candidate-model evaluations recorded.</p>:data.evaluations.map(v=><article key={v.id} className="min-w-0 rounded-xl border border-slate-100 p-4"><div className="flex items-center justify-between gap-2"><p className="break-all font-mono text-xs text-slate-700">{v.model_version_id}</p><Pill value={v.quality_gate_status}/></div><p className="mt-2 text-xs text-slate-500">{v.dataset_ref}</p><pre className="mt-3 max-h-52 overflow-auto rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700">{JSON.stringify(v.metrics,null,2)}</pre><p className="mt-2 text-xs leading-5 text-slate-500">{v.notes}</p></article>)}</div>
    </section>

    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-slate-950">Latest aggregate platform snapshot</h2>
      <p className="mt-1 text-xs text-slate-500">{latest?"Engine "+latest.engine_version+" · "+new Date(latest.completed_at).toLocaleString("en-IN",{timeZone:"UTC"})+" UTC":"No completed platform-analysis run yet."}</p>
      {latest?<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(latest.metrics).map(([key,value])=><Metric key={key} label={key.replaceAll("_"," ")} value={Number(value).toLocaleString("en-IN")}/>)}</div>:<p className="mt-4 text-sm text-slate-500">Queue an advisory analysis after the separate engine is running.</p>}
    </section>

    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Master Admin only</p><h2 className="mt-1 font-bold text-slate-950">Human review queue</h2><p className="mt-1 text-xs leading-5 text-slate-500">Operational intelligence cases only. Trust/fraud review remains isolated in the dedicated Trust workspace.</p></div>
        <Pill value={data.human_reviews.length?"review_required":"clear"}/>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">{data.human_reviews.length===0?<p className="text-sm text-slate-500">No open intelligence review cases.</p>:data.human_reviews.map(item=><article key={item.id} className="min-w-0 rounded-xl border border-slate-100 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">{item.review_type.replaceAll("_"," ")}</p><p className="mt-1 break-all font-mono text-xs font-bold text-slate-800">{item.reason_code}</p></div><div className="flex gap-2"><Pill value={item.priority}/><Pill value={item.status}/></div></div><p className="mt-3 text-xs text-slate-500">Subject: {item.subject_type}{item.subject_id?" · "+item.subject_id:""}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Evidence</p><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-slate-700">{JSON.stringify(item.evidence,null,2)}</pre></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Suggested next step</p><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-slate-700">{JSON.stringify(item.recommendation,null,2)}</pre></div></div><HumanReviewActions id={item.id} status={item.status}/></article>)}</div>
    </section>

    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-slate-950">Recent findings requiring human judgement</h2>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">{data.insights.length===0?<p className="text-sm text-slate-500">No findings recorded.</p>:data.insights.map(item=><article key={item.id} className="rounded-2xl border border-slate-100 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">{item.domain}</p><h3 className="mt-1 font-bold text-slate-950">{item.title}</h3></div><Pill value={item.severity}/></div><p className="mt-3 text-sm leading-6 text-slate-600">{item.rationale}</p><div className="mt-3 rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Evidence</p><pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs text-slate-700">{JSON.stringify(item.evidence,null,2)}</pre></div><p className="mt-3 text-sm leading-6 text-slate-700"><strong>Recommendation:</strong> {item.recommendation}</p><p className="mt-2 text-xs text-slate-500">Confidence {Math.round(item.confidence*100)}% · state {item.status}</p><InsightReviewActions id={item.id} status={item.status}/></article>)}</div>
    </section>
  </section>
}
