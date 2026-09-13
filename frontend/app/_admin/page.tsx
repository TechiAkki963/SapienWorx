import { LogoutButton } from "@/components/auth/logout-button";
import { Wordmark } from "@/components/brand/wordmark";
import { Surface } from "@/components/ui/surface";
import { requireRole } from "@/lib/auth-server";

export default async function AdminProtectedPage() { const user = await requireRole("master_admin"); return <main className="mx-auto min-h-screen max-w-6xl px-5 py-8"><div className="flex items-center justify-between"><Wordmark/><LogoutButton/></div><Surface tone="lavender" className="mt-12 p-8 sm:p-10"><p className="text-sm font-semibold text-indigo">Master Admin</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-ink">Administrative authentication is active.</h1><p className="mt-4 max-w-2xl text-ink-muted">Master Admin user {user.id} can access protected administrative APIs including recruiter verification. Public admin signup does not exist.</p></Surface></main>; }
