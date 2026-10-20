import { adminAPI } from "@/lib/admin-server";

type Task = { task: string; label: string; enabled: boolean; requests: number; attempts: number; retries: number; success: number; failures: number; timeouts: number; p50_ms: number | null; p95_ms: number | null; estimated_cost_usd: number; unknown_cost_requests: number; input_tokens: number; output_tokens: number; proposals: number; reviewed: number; corrected: number; schema_failures: number; validation_failures: number };
type Status = { health: { state: string }; operations: { available: boolean; gateway_switch: boolean; provider_switch: boolean; tasks: Task[] }; budget: { available: boolean; day_spent_usd: number; month_spent_usd: number; day_reserved_usd: number; month_reserved_usd: number; day_limit_usd: number; month_limit_usd: number; daily_alert: boolean; monthly_alert: boolean }; parsing: { external_ai_avoidance_rate?: number | null } };
const money = (v: number) => `$${v.toFixed(6)}`;
const rate = (n: number, d: number) => d ? `${(100 * n / d).toFixed(1)}%` : "—";
const latency = (v: number | null) => v === null ? "—" : `${Math.round(v)} ms`;

export async function AIOperations() {
  let data: Status;
  try { data = await adminAPI<Status>("/api/v1/admin/ai/status"); }
  catch { return <section aria-label="OpenAI operations" className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><h2 className="font-bold">OpenAI operations</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Operational metrics unavailable. Core workflows remain available for manual entry.</p></section>; }
  const ops = data.operations;
  const budget = data.budget;
  return <section aria-label="OpenAI operations" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">OpenAI operations</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{data.health.state.replaceAll("_", " ")}</span></div>
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Last 24 hours · human review required. Switches alone do not grant access: approved models, beta cohorts and role permissions also apply.</p>
    <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div><dt className="text-xs text-slate-600 dark:text-slate-300">Gateway / provider switches</dt><dd className="mt-1 font-semibold">{ops?.gateway_switch ? "ON" : "OFF"} / {ops?.provider_switch ? "ON" : "OFF"}</dd></div>
      {budget?.available ? <>
        <div><dt className="text-xs text-slate-600 dark:text-slate-300">Daily spend / remaining</dt><dd className="mt-1 font-semibold">{money(budget.day_spent_usd)} / {money(Math.max(0, budget.day_limit_usd - budget.day_spent_usd - budget.day_reserved_usd))}{budget.daily_alert && " · Warning"}</dd></div>
        <div><dt className="text-xs text-slate-600 dark:text-slate-300">Monthly spend / remaining</dt><dd className="mt-1 font-semibold">{money(budget.month_spent_usd)} / {money(Math.max(0, budget.month_limit_usd - budget.month_spent_usd - budget.month_reserved_usd))}{budget.monthly_alert && " · Warning"}</dd></div>
        <div><dt className="text-xs text-slate-600 dark:text-slate-300">Configured daily / monthly cap</dt><dd className="mt-1 font-semibold">{money(budget.day_limit_usd)} / {money(budget.month_limit_usd)}</dd></div>
      </> : <div><dt>Budgets</dt><dd>Unavailable</dd></div>}
    </dl>
    {ops?.available ? <div className="mt-5 grid gap-3 lg:grid-cols-3">{ops.tasks.map(task => <article key={task.task} className="min-w-0 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <h3 className="font-semibold">{task.label} <span className="text-xs text-slate-600 dark:text-slate-300">· switches {task.enabled ? "ON" : "OFF"}</span></h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        {[ ["Requests / retries", `${task.requests} / ${task.retries ?? 0}`], ["Success / error", `${rate(task.success, task.requests)} / ${rate(task.failures, task.requests)}`], ["p50 / p95", `${latency(task.p50_ms)} / ${latency(task.p95_ms)}`], ["Estimated cost", money(task.estimated_cost_usd) + (task.unknown_cost_requests ? ` + ${task.unknown_cost_requests} unknown` : "")], ["Input / output tokens", `${task.input_tokens} / ${task.output_tokens}`], ["Timeouts", task.timeouts], ["Review / correction", `${rate(task.reviewed, task.proposals)} / ${rate(task.corrected, task.reviewed)}`], ["Schema / validation failures", `${task.schema_failures} / ${task.validation_failures}`] ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-600 dark:text-slate-300">{label}</dt><dd className="mt-0.5 break-words font-medium">{value}</dd></div>)}
      </dl>
    </article>)}</div> : <p className="mt-4 text-sm">Durable task metrics unavailable.</p>}
    <p className="mt-4 text-xs leading-5 text-slate-600 dark:text-slate-300">Cache avoidance: {data.parsing?.external_ai_avoidance_rate == null ? "unmeasured" : `${(100 * data.parsing.external_ai_avoidance_rate).toFixed(1)}%`}. Review metrics cover retained proposals, not model accuracy. Disabling gateway, provider or individual task is immediate through the audited switches below. Manual profile and job editing remain available.</p>
  </section>;
}
