"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiRequest } from "@/lib/api";
import { useAdminPermission } from "@/components/admin/admin-access-provider";

export type TaxonomyEntityOption = {
  id: string;
  entity_type: string;
  canonical_name: string;
};

export function ProvisionalTermActions({
  id,
  rawTerm,
  proposedType,
  entities,
}: {
  id: string;
  rawTerm: string;
  proposedType: string;
  entities: TaxonomyEntityOption[];
}) {
  const allowed = useAdminPermission("taxonomy.manage");
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  if (!allowed) return <p className="mt-3 text-xs text-slate-500">Read-only taxonomy access.</p>;

  async function resolve(action: "approve" | "merge" | "reject") {
    if (action === "merge" && !target) {
      setMessage("Choose a canonical entity first.");
      return;
    }
    setBusy(action);
    setMessage("");
    try {
      await apiRequest(`/api/v1/admin/workforce-taxonomy/provisional/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          action,
          target_entity_id: action === "merge" ? target : "",
          canonical_name: action === "approve" ? rawTerm : "",
          entity_type: action === "approve" ? proposedType : "",
          review_note: action === "approve" ? "Approved from Phase 1 taxonomy review." : action === "merge" ? "Merged from Phase 1 taxonomy review." : "Rejected from Phase 1 taxonomy review.",
        }),
      });
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Taxonomy review failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mt-3 grid gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={Boolean(busy)} onClick={() => void resolve("approve")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
          {busy === "approve" ? "Approving…" : "Approve canonical"}
        </button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void resolve("reject")} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </button>
      </div>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
        <select value={target} onChange={(event) => setTarget(event.target.value)} aria-label={`Canonical target for ${rawTerm}`} className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700">
          <option value="">Merge into existing canonical entity…</option>
          {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.canonical_name} · {entity.entity_type.replaceAll("_", " ")}</option>)}
        </select>
        <button type="button" disabled={Boolean(busy) || !target} onClick={() => void resolve("merge")} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 disabled:opacity-50">
          {busy === "merge" ? "Merging…" : "Merge"}
        </button>
      </div>
      {message && <p role="status" className="text-xs font-semibold text-rose-700">{message}</p>}
    </div>
  );
}
