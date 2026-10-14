"use client";
import Link from "next/link";
import {CareerIcon} from "./career-icon";
import {safeNotificationDestination} from "./candidate-topbar";
import {useCandidateWorkspace} from "./candidate-workspace-state";

export function OverviewAlerts(){
  const {notifications,notificationError}=useCandidateWorkspace();
  return <div className="candidate-overview-alerts">{notificationError&&<p role="alert" className="candidate-error">Updates could not be refreshed. <Link href="/candidate/notifications">Try your notifications.</Link></p>}{!notifications.length&&!notificationError&&<p className="candidate-overview-empty">You’re all caught up. Application and account updates will appear here.</p>}{notifications.slice(0,4).map(note=><Link key={note.id} href={safeNotificationDestination(note.action_url)} className="candidate-overview-alert"><span className="candidate-dashboard-icon"><CareerIcon name={note.kind.includes("interview")?"calendar":note.kind.includes("application")?"application":"bell"}/></span><div><h3>{note.title}</h3><p>{note.body}</p><time dateTime={note.created_at}>{new Date(note.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"Asia/Kolkata"})}</time></div>{!note.read_at&&<span className="candidate-alert-unread" aria-label="Unread"/>}</Link>)}</div>;
}
