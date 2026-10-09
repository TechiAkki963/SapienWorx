import { adminAPI } from "@/lib/admin-server";
import { requireAdminWorkspace } from "@/lib/admin-access-server";
import { canAdmin } from "@/lib/admin-access";
import { CompanyPolicyForm } from "@/components/admin/company-administration";
import { CompanyGrantForm } from "@/components/admin/company-grant-form";
import type { CompanyPlan } from "@/lib/company";
export default async function AdminCompanyPage({ params }: {
    params: Promise<{
        companyID: string;
    }>;
}) { const { access } = await requireAdminWorkspace("organizations.read"); const { companyID } = await params; const initial = await adminAPI<CompanyPlan>(`/api/v1/admin/companies/${companyID}/subscription`); return <section className="space-y-5"><header><h1 className="text-3xl font-semibold">Company administration</h1><p className="mt-3 break-all text-sm text-slate-500">{companyID}</p></header><CompanyPolicyForm id={companyID} initial={initial} canManage={canAdmin(access, "organizations.review")}/>{canAdmin(access, "organizations.review") && <CompanyGrantForm companyID={companyID}/>}</section>; }
