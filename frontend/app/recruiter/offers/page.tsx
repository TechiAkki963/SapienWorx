import { OffersWorkspace, type OfferApplicationOption, type OfferItem } from "@/components/recruiter/offers-workspace";
import { RecruiterShell } from "@/components/recruiter/recruiter-shell";
import { requireRole } from "@/lib/auth-server";
import { recruiterAPI } from "@/lib/recruiter-server";

export const dynamic="force-dynamic";

type Pipeline={items:OfferApplicationOption[]};

export default async function OffersPage(){
  await requireRole("recruiter");
  const [{items},pipeline]=await Promise.all([
    recruiterAPI<{items:OfferItem[]}>("/api/v1/recruiter/offers"),
    recruiterAPI<Pipeline>("/api/v1/recruiter/pipeline?limit=50&sort=recently_updated"),
  ]);
  const applications=(pipeline.items??[]).filter(item=>!["hired","rejected","withdrawn"].includes(item.stage));
  return <RecruiterShell><div className="grid gap-5 pb-24">
    <header><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-indigo">Candidate conversion</p><h1 className="mt-1 text-2xl font-bold tracking-[-.035em] text-navy sm:text-3xl">Offers</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">Create, send and track offers without losing the application and company context.</p></header>
    <OffersWorkspace initialItems={items??[]} applications={applications}/>
  </div></RecruiterShell>;
}
