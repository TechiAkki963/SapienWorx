import Link from "next/link";

import { Container } from "@/components/layout/container";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";

const sections = [
  ["What SapienWorx processes", "Account identifiers, contact details, candidate profile and CV information, applications, recruiter hiring activity, interview records and messages needed to operate the recruitment platform."],
  ["Why it is processed", "To create and secure accounts, provide candidate and recruiter workflows, support hiring communications, maintain platform integrity, fulfil user requests and meet applicable legal or regulatory obligations."],
  ["Account verification", "The current SapienWorx product uses email OTP for account verification. SMS OTP is not enabled."],
  ["Your controls", "Authenticated users can request access, export, rectification, restriction, objection or erasure through the privacy request workflow. Candidate self-erasure is automated where safe; records that require retention or ownership review are routed to an administrator review gate."],
  ["Retention and deletion", "SapienWorx records retention rules by data category and trigger event. Erasure is not reported as complete while an external private object, such as a CV file, still has a pending deletion fulfilment job."],
  ["Recruitment fairness", "Anonymous Pitch Mode uses a server-side redacted response that excludes identity and direct contact information. Protected or sensitive attributes are not intended to be used as ordinary sourcing or ranking criteria."],
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f8fbff] text-ink">
      <PublicHeader />
      <Container>
        <article className="mx-auto max-w-4xl py-14 sm:py-20">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-indigo">Privacy at SapienWorx</p>
          <h1 className="mt-4 font-serif text-5xl font-semibold tracking-[-0.05em] text-navy sm:text-6xl">Clear controls for your recruitment data.</h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-ink-muted">This product notice explains the privacy controls built into SapienWorx. It is designed to support DPDP/GDPR readiness and should be reviewed with final legal and deployment-specific information before production launch.</p>

          <div className="mt-10 grid gap-4">
            {sections.map(([title, body]) => <section key={title} className="rounded-2xl border border-line/80 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-navy">{title}</h2><p className="mt-2 text-sm leading-7 text-ink-muted">{body}</p></section>)}
          </div>

          <div className="mt-8 rounded-2xl border border-indigo/15 bg-indigo-soft/35 p-6">
            <h2 className="text-lg font-bold text-navy">Subprocessors</h2>
            <p className="mt-2 text-sm leading-7 text-ink-muted">Service providers that process personal data on behalf of SapienWorx are maintained in a dedicated transparency register.</p>
            <Link href="/subprocessors" className="mt-4 inline-flex font-semibold text-indigo hover:underline">View the subprocessor register →</Link>
          </div>
        </article>
      </Container>
      <PublicFooter />
    </main>
  );
}
