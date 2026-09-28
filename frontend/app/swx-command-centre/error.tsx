"use client";

import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";

export default function AdminWorkspaceError({ reset }: { reset: () => void }) {
  return <main id="main-content" className="mx-auto my-10 max-w-xl rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8">
    <p className="text-xs font-bold uppercase tracking-wider text-indigo">Command centre unavailable</p>
    <h1 className="mt-3 text-2xl font-bold text-ink">Access could not be verified</h1>
    <p className="mt-3 text-sm leading-7 text-ink-muted">Administrative data stays closed while we cannot verify your session or load the workspace. Confirm your security session, try again, or sign out.</p>
    <div className="mt-5 flex flex-wrap items-center gap-3"><Link href="/swx-command-centre/security" className="rounded-xl bg-indigo px-4 py-3 text-sm font-bold text-white">Confirm security session</Link><button onClick={reset} className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink">Try again</button><LogoutButton /></div>
  </main>;
}
