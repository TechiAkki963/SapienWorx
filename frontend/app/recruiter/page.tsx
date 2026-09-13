import { LogoutButton } from "@/components/auth/logout-button";
import { Wordmark } from "@/components/brand/wordmark";
import { Surface } from "@/components/ui/surface";
import { requireRole } from "@/lib/auth-server";

export default async function RecruiterProtectedPage() { const user = await requireRole("recruiter"); return <main className="mx-auto min-h-screen max-w-6xl px-5 py-8"><div className="flex items-center justify-between"><Wordmark/><LogoutButton/></div><Surface tone="peach" className="mt-12 p-8 sm:p-10"><p className="text-sm font-semibold text-indigo">Verified recruiter session</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-ink">Recruiter workspace access is protected.</h1><p className="mt-4 max-w-2xl text-ink-muted">Role enforcement is active for user {user.id}. The high-density operational recruiter dashboard will be built in Phase 6.</p></Surface></main>; }
