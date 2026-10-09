import Link from "next/link";
import { recruiterAPI } from "@/lib/recruiter-server";
export async function talentAccess(feature = "talent.discovery") {
    const access = await recruiterAPI<{
        member: {
            role: string;
            talent_seat: boolean;
        };
        entitlements: {
            features: Record<string, boolean>;
            state: string;
        };
    }>("/api/v1/company/access");
    return { allowed: access.entitlements.features[feature] && (access.member.talent_seat || access.member.role === "legacy_recruiter"), owner: access.member.role === "primary_admin", state: access.entitlements.state };
}
export function TalentAccessNotice({ owner }: {
    owner: boolean;
}) { return <section className="rounded-xl border border-line bg-white p-6"><h1 className="text-2xl font-semibold text-navy">Talent access is paused</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-ink-muted">Your saved searches, pools and outreach history are preserved. Core recruiting, existing applicants and conversations remain available. {owner ? "Review your company plan and seat assignments to restore paid access." : "Ask your Company Admin to review the subscription and your Talent seat assignment."}</p><nav className="mt-5 flex flex-wrap gap-5 text-sm font-semibold text-indigo"><Link className="min-h-11 content-center" href="/recruiter/pipeline">Open existing applications</Link><Link className="min-h-11 content-center" href="/recruiter/messages">Open conversations</Link><Link className="min-h-11 content-center" href="/recruiter/saved-searches">Saved search history</Link><Link className="min-h-11 content-center" href="/recruiter/outreach">Outreach history</Link>{owner && <Link className="min-h-11 content-center" href="/company/plan">Plan & usage</Link>}</nav></section>; }
