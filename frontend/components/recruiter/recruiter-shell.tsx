import Link from "next/link";
import { cookies } from "next/headers";

import { LogoutButton } from "@/components/auth/logout-button";
import { SettingsLink } from "@/components/ui/settings-link";
import { RecruiterWorkspaceContext } from "@/components/recruiter/workspace-context";
import { RecruiterFrame } from "./recruiter-frame";
import type { RecruiterNavigationAccess } from "./recruiter-nav";
import { ThemeModeControl } from "@/components/theme/theme-mode-control";
import { RecruiterDashboard } from "@/lib/recruiter";
import { recruiterAPI } from "@/lib/recruiter-server";
import type { ThreadListResponse } from "@/lib/messaging";
import { messagingAPI } from "@/lib/messaging-server";
import { getSessionUser } from "@/lib/auth-server";
import { RecruiterNotificationBell } from "./notification-bell";
import type { RecruiterNotificationInbox } from "@/lib/recruiter-notifications";
import { RecruiterAccountProfile } from "./account-profile";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "R";
}

export async function RecruiterShell({ children }: { children: React.ReactNode }) {
  const [workspace, conversations, session, notificationInbox, companyAccess] = await Promise.all([
    recruiterAPI<RecruiterDashboard>("/api/v1/recruiter/dashboard").catch(() => null),
    messagingAPI<ThreadListResponse>("/api/v1/messaging/threads").catch(() => null),
    getSessionUser(),
    recruiterAPI<RecruiterNotificationInbox>("/api/v1/recruiter/notifications?limit=1").catch(() => null),
    recruiterAPI<RecruiterNavigationAccess>("/api/v1/company/access").catch(()=>null),
  ]);
  const recruiterName = workspace?.recruiter_name ?? "Recruiter";
  const companyName = workspace?.company_name ?? "SapienWorx workspace";
  const unreadCount = conversations?.items?.reduce((total, thread) => total + thread.unread_count, 0) ?? 0;
  const preferenceKey=`sw_recruiter_sidebar_${session?.id || "guest"}`;
  const collapsed=(await cookies()).get(preferenceKey)?.value==="collapsed";

  return (
    <div className="theme-surface swx-recruiter-workspace min-h-screen bg-[#f5f7fb] text-ink">
      <a href="#main-content" className="skip-link">Skip to recruiter workspace</a>
      <RecruiterFrame initialCollapsed={collapsed} preferenceKey={preferenceKey} unreadCount={unreadCount} access={companyAccess} header={<header className="swx-recruiter-navbar sticky top-0 z-40 border-b border-line/70 bg-white/95">
        <div className="flex min-h-[63px] items-center gap-4 px-4 sm:px-6">
          <form action="/recruiter/pipeline" className="swx-recruiter-navbar-search min-w-0 flex-1">
            <label className="relative block">
              <span className="sr-only">Search candidates</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 fill-none stroke-ink-muted stroke-[1.8]"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
              <input name="q" placeholder="Search candidates by name or headline" className="h-10 w-full rounded-xl border border-line bg-slate-50/80 pl-10 pr-4 text-sm outline-none transition placeholder:text-ink-muted/70 focus:border-indigo/35 focus:bg-white focus:ring-4 focus:ring-indigo-soft/70" />
            </label>
          </form>

          <div className="swx-recruiter-navbar-actions ml-auto flex shrink-0 items-center gap-2">
            <ThemeModeControl compact />
            <RecruiterNotificationBell initialUnread={notificationInbox?.unread ?? 0} />
            <SettingsLink href="/recruiter/settings" />

            <details className="relative">
              <summary aria-label={`Account menu for ${recruiterName}`} className="flex cursor-pointer list-none items-center gap-0 rounded-xl border border-line bg-white p-1.5 transition hover:bg-slate-50 sm:gap-2 sm:pr-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-[13px] font-extrabold text-white">{initials(recruiterName)}</span>
                <span className="hidden max-w-36 text-left xl:block">
                  <span className="block truncate text-xs font-bold text-ink">{recruiterName}</span>
                  <span className="block truncate text-[13px] text-ink-muted">{companyName}</span>
                </span>
                <svg aria-hidden="true" viewBox="0 0 16 16" className="hidden h-3 w-3 fill-none stroke-current stroke-[1.7] text-ink-muted sm:block"><path d="m4 6 4 4 4-4" /></svg>
              </summary>
              <div className="absolute right-0 mt-2 w-60 rounded-xl border border-line bg-white p-2 shadow-[0_16px_44px_rgba(16,33,63,0.14)]">
                <div className="border-b border-line/70 px-2.5 py-2">
                  <p className="truncate text-sm font-bold text-ink">{recruiterName}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">{companyName}</p>
                </div>
                {companyAccess?.member.role==="primary_admin"&&<Link href="/company" className="flex min-h-11 items-center rounded-lg px-2.5 text-sm font-semibold text-indigo">Company administration</Link>}
                <Link href="/" className="mt-1 flex rounded-lg px-2.5 py-2 text-sm font-semibold text-ink-muted hover:bg-slate-50 hover:text-ink">View public site</Link>
                {session?.role === "recruiter" && <RecruiterAccountProfile session={{ ...session, first_name: session.first_name || recruiterName.split(" ")[0], last_name: session.last_name || recruiterName.split(" ").slice(1).join(" ") }} company={companyName} activeJobs={workspace?.active_jobs ?? 0} />}
                <div className="mt-1 border-t border-line/70 pt-1"><LogoutButton /></div>
              </div>
            </details>
          </div>
        </div>
      </header>}><RecruiterWorkspaceContext />{children}</RecruiterFrame>
    </div>
  );
}
