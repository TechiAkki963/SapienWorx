import Link from "next/link";
import { SERVER_API_URL } from "@/lib/server-api-url";
import { getSessionUser } from "@/lib/auth-server";
import { SignupForm } from "@/components/auth/signup-form";
import { InvitationAccept } from "@/components/company/invitation-accept";
export const dynamic = "force-dynamic";
export default async function CompanyInvitationPage({ searchParams }: {
    searchParams: Promise<{
        token?: string;
    }>;
}) { const { token = "" } = await searchParams; const response = await fetch(`${SERVER_API_URL}/api/v1/company/invitation?token=${encodeURIComponent(token)}`, { cache: "no-store" }); if (!response.ok)
    return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-semibold">Invitation unavailable</h1><p className="mt-4 text-sm leading-6">This company invitation may be expired, revoked or already accepted. Ask your Company Admin for a fresh invitation.</p><Link href="/recruiter/login" className="mt-4 inline-block text-indigo">Sign in to your existing workspace</Link></main>; const data = await response.json() as {
    company_name: string;
    email: string;
    name: string;
    role: string;
}; const session = await getSessionUser(); return <main className="theme-surface mx-auto max-w-xl p-6 sm:p-10"><h1 className="text-3xl font-semibold text-navy">Join {data.company_name}</h1><p className="my-5 text-sm leading-6 text-ink-muted">You are invited as {data.role.replaceAll("_", " ")}. Use your verified official email to activate company access.</p>{session?.role === "recruiter" ? <InvitationAccept token={token}/> : <><SignupForm recruiter invitation={{ token, ...data }}/><p className="mt-5 text-sm">Already have an account? <Link className="font-semibold text-indigo" href="/recruiter/login">Sign in</Link>, then reopen your invitation.</p></>}</main>; }
