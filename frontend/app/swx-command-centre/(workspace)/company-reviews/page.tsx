import { adminAPI } from "@/lib/admin-server";
import { requireAdminWorkspace } from "@/lib/admin-access-server";
import { canAdmin } from "@/lib/admin-access";
import { CompanyReviewModeration, type ModerationReview } from "@/components/admin/company-review-moderation";
export default async function CompanyReviewQueue() { const { access } = await requireAdminWorkspace("trust_risk.read"); const { items } = await adminAPI<{
    items: ModerationReview[];
}>("/api/v1/admin/company-reviews"); return <section className="space-y-5"><header><h1 className="text-3xl font-semibold">Company review moderation</h1><p className="mt-3 text-sm leading-6 text-slate-500">SapienWorx controls publication. Company administrators can respond and report concerns, but cannot remove reviews or see private reviewer identity.</p></header><CompanyReviewModeration items={items} canManage={canAdmin(access, "trust_risk.review")}/></section>; }
