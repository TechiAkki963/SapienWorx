import Link from "next/link";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { SavedSearchAlerts, type SavedSearchItem } from "@/components/recruiter/saved-search-alerts";
import { requireRole } from "@/lib/auth-server";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic="force-dynamic";
export default async function SavedSearchesPage(){
 await requireRole("recruiter");
 const {items}=await recruiterAPI<{items:SavedSearchItem[]}>("/api/v1/recruiter/saved-searches");
 return <RecruiterShell><div className="grid gap-5 pb-24">
  <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-indigo">Sourcing automation</p><h1 className="mt-1 text-2xl font-bold tracking-[-.035em] text-navy sm:text-3xl">Saved searches & alerts</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">Reuse high-value candidate searches and choose a daily or weekly alert cadence.</p></div><Link href="/recruiter/discover" className="rounded-xl bg-indigo px-4 py-2.5 text-sm font-bold text-white">Discover talent</Link></header>
  <SavedSearchAlerts initialItems={items??[]}/>
 </div></RecruiterShell>
}
