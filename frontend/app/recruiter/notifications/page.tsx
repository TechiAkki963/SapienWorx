import { recruiterAPI } from "@/lib/recruiter-server";
import type { RecruiterNotificationInbox } from "@/lib/recruiter-notifications";
import { NotificationsWorkspace } from "@/components/recruiter/notifications-workspace";
import {RecruiterShell} from "@/components/recruiter/recruiter-shell";
import {requireRole} from "@/lib/auth-server";
export const dynamic="force-dynamic";
export default async function NotificationsPage(){
 await requireRole("recruiter");
 const inbox=await recruiterAPI<RecruiterNotificationInbox>("/api/v1/recruiter/notifications");
 return <RecruiterShell><NotificationsWorkspace initial={inbox}/></RecruiterShell>;
}
