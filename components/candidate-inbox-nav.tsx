import Link from "next/link";
export function CandidateInboxNav({ active }: { active: "messages" | "updates" }) {
  return <nav className="candidate-inbox-route-nav" aria-label="Candidate inbox views"><Link className={active==="messages"?"active":""} href="/candidate/messages">Messages</Link><Link className={active==="updates"?"active":""} href="/candidate/notifications">Application updates</Link></nav>;
}
