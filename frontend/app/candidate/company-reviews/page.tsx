import { candidateAPI, publicAPI, BackendResponseError } from "@/lib/candidate-server";
import { CompanyReviewEditor } from "@/components/company/review-editor";
import { emptySetup, type OwnCompanyReview, type PublicCompany } from "@/lib/company";
export default async function CandidateCompanyReviewsPage({ searchParams }: {
    searchParams: Promise<{
        company_id?: string;
    }>;
}) {
    const params = await searchParams;
    const [companies, own] = await Promise.all([publicAPI<{
            items: PublicCompany[];
        }>("/api/v1/companies"), candidateAPI<{
            items: OwnCompanyReview[];
        }>("/api/v1/candidate/company-reviews")]);
    if (params.company_id && !companies.items.some(c => c.id === params.company_id)) {
        try {
            const target = await publicAPI<{
                company: PublicCompany;
            }>(`/api/v1/companies/${encodeURIComponent(params.company_id)}`);
            companies.items.push(target.company);
        }
        catch (e) {
            if (!(e instanceof BackendResponseError) || ![403, 404].includes(e.status))
                throw e;
        }
    }
    for (const r of own.items)
        if (!companies.items.some(c => c.id === r.company_id))
            companies.items.push({ id: r.company_id, name: r.display_name, city: "", country: "", profile: emptySetup.profile, open_jobs: 0, employee_count: 0, interview_count: 0 });
    return <CompanyReviewEditor companies={companies.items} own={own.items} companyID={params.company_id ?? ""}/>;
}
