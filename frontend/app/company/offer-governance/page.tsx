import {notFound} from "next/navigation";
import {companyWorkspace} from "@/lib/company-server";
import {recruiterAPI} from "@/lib/recruiter-server";
import type {OfferSettings} from "@/lib/offers";
import {CompanyShell} from "@/components/company/company-shell";
import {CompanyOfferGovernance} from "@/components/company/offer-governance";
export const dynamic="force-dynamic";
export default async function OfferGovernance(){const workspace=await companyWorkspace(true);const settings=await recruiterAPI<OfferSettings>("/api/v1/company/offer-governance");if(!settings.permissions["offer.manage_approval_policy"]||!settings.permissions["offer.view_compensation"])notFound();return <CompanyShell member={workspace.member}><header><h1 className="text-3xl font-semibold text-navy">Offer governance</h1><p className="mt-3 text-sm text-ink-muted">Company approval rules and granular offer permissions.</p></header><CompanyOfferGovernance initial={settings}/></CompanyShell>}
