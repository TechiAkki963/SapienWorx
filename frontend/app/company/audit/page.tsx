import { companyWorkspace } from "@/lib/company-server";
import { recruiterAPI } from "@/lib/recruiter-server";
import { CompanyShell } from "@/components/company/company-shell";
export default async function CompanyAuditPage() { const workspace = await companyWorkspace(true); const { items } = await recruiterAPI<{
    items: {
        action: string;
        created_at: string;
        details: Record<string, unknown>;
    }[];
}>("/api/v1/company/audit"); return <CompanyShell member={workspace.member}><h1 className="text-3xl font-semibold text-navy">Company audit history</h1><p className="text-sm text-ink-muted">The most recent 100 company administration events. Records are append-only.</p><ol className="divide-y divide-line rounded-xl border border-line bg-white">{items.map((item, i) => <li key={i} className="p-5"><p className="text-sm font-semibold">{item.action.replaceAll(".", " · ")}</p><time className="mt-2 block text-xs text-ink-muted">{new Date(item.created_at).toLocaleString("en-GB")}</time>{typeof item.details.reason === "string" && <p className="mt-2 text-sm">{item.details.reason}</p>}</li>)}{!items.length && <li className="p-5 text-sm text-ink-muted">Company changes will appear here.</li>}</ol></CompanyShell>; }
