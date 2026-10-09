import { companyWorkspace } from "@/lib/company-server";
import { recruiterAPI } from "@/lib/recruiter-server";
import { CompanyShell } from "@/components/company/company-shell";
import { CompanyReviewsList } from "@/components/company/reviews-list";
import type { CompanyReview, PublicCompany } from "@/lib/company";
export default async function CompanyReviewsPage() { const workspace = await companyWorkspace(true); const id = workspace.member.company_id; const [data, reviews] = await Promise.all([recruiterAPI<{
        company: PublicCompany;
    }>(`/api/v1/companies/${id}`), recruiterAPI<{
        items: CompanyReview[];
        total: number;
    }>(`/api/v1/companies/${id}/reviews`)]); return <CompanyShell member={workspace.member}><header><h1 className="text-3xl font-semibold text-navy">Company reviews</h1><p className="mt-3 text-sm leading-6 text-ink-muted">Read verified experiences, respond officially or report concerns. Reviewer identity is private; companies cannot edit or remove reviews.</p></header><div className="grid gap-4 sm:grid-cols-2">{[["Employee experience", data.company.employee_rating, data.company.employee_count], ["Interview experience", data.company.interview_rating, data.company.interview_count]].map(([label, rating, count]) => <section key={label} className="rounded-xl border border-line bg-white p-5"><h2 className="text-sm text-ink-muted">{label}</h2><p className="mt-3 text-2xl font-semibold">{rating ? `${Number(rating).toFixed(1)} ★` : "No rating yet"}</p><p className="mt-2 text-sm">{count} published, verified reviews</p></section>)}</div><CompanyReviewsList items={reviews.items} owner/><p className="text-sm text-ink-muted">Showing the latest 20 published reviews. Public company filters include the full published history.</p></CompanyShell>; }
