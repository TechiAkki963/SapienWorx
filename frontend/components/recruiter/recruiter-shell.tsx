import { cookies } from "next/headers";

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
      <RecruiterFrame
        initialCollapsed={collapsed}
        preferenceKey={preferenceKey}
        unreadCount={unreadCount}
        access={companyAccess}
        recruiterName={recruiterName}
        companyName={companyName}
        profileImageUrl={session?.profile_image_url}
        header={<header className="swx-recruiter-navbar sticky top-0 z-40 border-b border-line/70 bg-white/95">
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
              {session?.role === "recruiter" && <RecruiterAccountProfile session={{ ...session, first_name: session.first_name || recruiterName.split(" ")[0], last_name: session.last_name || recruiterName.split(" ").slice(1).join(" ") }} company={companyName} activeJobs={workspace?.active_jobs ?? 0} showTrigger={false} />}
            </div>
          </div>
        </header>}
      >
        <RecruiterWorkspaceContext />
        {children}
      </RecruiterFrame>
    </div>
  );
}
