import { LogoutButton } from "@/components/auth/logout-button";
import { Wordmark } from "@/components/brand/wordmark";
import { Surface } from "@/components/ui/surface";
import { requireRole } from "@/lib/auth-server";

export default async function CandidateProtectedPage() { const user = await requireRole("candidate"); return <main className="mx-auto min-h-screen max-w-5xl px-5 py-8"><div className="flex items-center justify-between"><Wordmark/><LogoutButton/></div><Surface tone="mint" className="mt-12 p-8 sm:p-10"><p className="text-sm font-semibold text-indigo">Candidate session active</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-ink">Welcome to your protected candidate space.</h1><p className="mt-4 max-w-2xl text-ink-muted">Authentication is complete for user {user.id}. The full candidate dashboard, job discovery and application experience arrive in Phase 5.</p></Surface></main>; }
