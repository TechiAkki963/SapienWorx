import { CompanyShell } from "@/components/company/company-shell";
import { CompanySetupWizard } from "@/components/company/setup-wizard";
import { companyWorkspace } from "@/lib/company-server";
import { emptySetup } from "@/lib/company";
import { ScopedHiring } from "@/components/company/scoped-hiring";
export const dynamic = "force-dynamic";
export default async function CompanyPage() { const data = await companyWorkspace(); return <CompanyShell member={data.member}>{data.member.role === "primary_admin" ? <CompanySetupWizard initial={data.setup ?? emptySetup}/> : <ScopedHiring member={data.member} jobs={data.jobs}/>}</CompanyShell>; }
