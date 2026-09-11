"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CandidateMessages,CandidateNotifications } from "./candidate-communication";
export function CandidateInboxV1(){const params=useSearchParams();const view=params.get("view")==="updates"?"updates":"messages";return <div className="candidate-inbox-route"><nav className="candidate-inbox-switcher" aria-label="Inbox view"><Link aria-current={view==="messages"?"page":undefined} href="/candidate/messages">Messages</Link><Link aria-current={view==="updates"?"page":undefined} href="/candidate/messages?view=updates">Application updates</Link></nav>{view==="updates"?<CandidateNotifications/>:<CandidateMessages/>}</div>}
