import Link from "next/link";
import { RecruiterProductHeader } from "@/components/recruiter/recruiter-product-header";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { SavedSearchAlerts, type SavedSearchItem } from "@/components/recruiter/saved-search-alerts";
import { requireRole } from "@/lib/auth-server";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic="force-dynamic";
export default async function SavedSearchesPage(){
 await requireRole("recruiter");
 const {items}=await recruiterAPI<{items:SavedSearchItem[]}>("/api/v1/recruiter/saved-searches");
 return <RecruiterShell><div className="grid gap-5 pb-24">
  <RecruiterProductHeader eyebrow="Sourcing automation" title="Saved searches & alerts" description="Reuse high-value candidate searches and choose a daily or weekly alert cadence." actions={<Link href="/recruiter/discover" className="rounded-xl bg-indigo px-4 py-2.5 text-sm font-bold text-white">Discover talent</Link>} />
  <SavedSearchAlerts initialItems={items??[]}/>
 </div></RecruiterShell>
}
