import { ProvisionalTermActions } from "@/components/admin/workforce-taxonomy-actions";
import { adminAPI } from "@/lib/admin-server";
import { requireAdminWorkspace } from "@/lib/admin-access-server";

export const dynamic = "force-dynamic";

type Entity = {
  id: string;
  entity_type: string;
  canonical_name: string;
  description: string;
  status: string;
  country_scope: string;
  language_code: string;
  usage_count: number;
  metadata: Record<string, unknown>;
};

type Provisional = {
  id: string;
  raw_term: string;
  normalized_term: string;
  proposed_entity_type: string;
  country_scope: string;
  source: string;
  source_context: string;
  occurrence_count: number;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
};

type Dashboard = {
  entities: Entity[];
  provisional_terms: Provisional[];
  entity_count: number;
  alias_count: number;
  pending_count: number;
  mapping_count: number;
  relationship_count: number;
};

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function WorkforceTaxonomyPage() {
  await requireAdminWorkspace("taxonomy.read");
  const data = await adminAPI<Dashboard>("/api/v1/admin/workforce-taxonomy");

  return (
    <div className="grid min-w-0 gap-5">
      <header>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#5262c9]">Workforce foundation</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.04em] text-slate-950 sm:text-3xl">Workforce Taxonomy</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Canonical occupations, competencies, tools, credentials and other workforce concepts used across industries. Intelligence may propose relationships later; production taxonomy remains governed here.</p>
      </header>

      <section className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-5" aria-label="Taxonomy summary">
        {[
          ["Canonical entities", data.entity_count],
          ["Active aliases", data.alias_count],
          ["Relationships", data.relationship_count],
          ["Mapped raw terms", data.mapping_count],
          ["Pending review", data.pending_count],
        ].map(([name, value]) => <div key={name} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500">{name}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p></div>)}
      </section>

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="font-bold text-slate-950">Provisional terms</h2><p className="mt-1 text-xs leading-5 text-slate-500">Unknown legitimate terms remain usable in jobs and candidate profiles while awaiting governance.</p></div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">{data.pending_count} pending</span>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {data.provisional_terms.length === 0 ? <p className="text-sm text-slate-500">No provisional terms are waiting for review.</p> : data.provisional_terms.map((term) => (
            <article key={term.id} className="min-w-0 rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><h3 className="break-words font-bold text-slate-900">{term.raw_term}</h3><p className="mt-1 text-xs text-slate-500">{label(term.proposed_entity_type)} · source: {term.source_context || term.source}</p></div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{term.occurrence_count} occurrence{term.occurrence_count === 1 ? "" : "s"}</span>
              </div>
              <ProvisionalTermActions id={term.id} rawTerm={term.raw_term} proposedType={term.proposed_entity_type} entities={data.entities.map(({ id, entity_type, canonical_name }) => ({ id, entity_type, canonical_name }))} />
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-950">Canonical entities</h2>
        <p className="mt-1 text-xs text-slate-500">Top 100 entities by current mapped usage. This is intentionally a compact Phase 1 governance view, not the final taxonomy editor.</p>
        <div className="mt-4 max-w-full overflow-x-auto">
          <table className="min-w-[760px] w-full border-collapse text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500"><tr><th className="px-3 py-3">Canonical term</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Scope</th><th className="px-3 py-3">Usage</th><th className="px-3 py-3">Status</th></tr></thead>
            <tbody>{data.entities.map((entity) => <tr key={entity.id} className="border-b border-slate-100"><td className="px-3 py-3 font-semibold text-slate-900">{entity.canonical_name}</td><td className="px-3 py-3 text-slate-600">{label(entity.entity_type)}</td><td className="px-3 py-3 text-slate-600">{entity.country_scope || "Global"} · {entity.language_code}</td><td className="px-3 py-3 font-semibold text-slate-700">{entity.usage_count}</td><td className="px-3 py-3 text-slate-600">{label(entity.status)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
