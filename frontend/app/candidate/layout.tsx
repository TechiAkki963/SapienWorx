import { CandidateShell } from "@/components/candidate/candidate-shell";
import { requireRole, SessionConnectionError } from "@/lib/auth-server";
import { WorkspaceError } from "@/components/candidate/workspace-error";
import { headers } from "next/headers";
import {
  CandidateProfileDetails,
  CandidateProfileSummary,
  candidateOnboardingStatus,
} from "@/lib/candidate";
import { candidateAPI } from "@/lib/candidate-server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import "@/components/candidate/candidate-workspace.css";

export default async function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await requireRole("candidate");
  } catch (cause) {
    if (!(cause instanceof SessionConnectionError)) throw cause;
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <WorkspaceError
          title="We couldn’t check your session."
          message={cause.message}
          retryHref={
            (await headers()).get("x-swx-candidate-path") || "/candidate"
          }
        />
      </main>
    );
  }
  let details: CandidateProfileDetails;
  try {
    details = await candidateAPI<CandidateProfileDetails>(
      "/api/v1/candidate/profile/details",
    );
  } catch {
    return (
      <CandidateShell
        identity={null}
        name={
          [session.first_name, session.last_name].filter(Boolean).join(" ") ||
          "Candidate"
        }
      >
        <WorkspaceError
          title="We couldn’t load your profile."
          retryHref={
            (await headers()).get("x-swx-candidate-path") || "/candidate"
          }
        />
      </CandidateShell>
    );
  }
  if (candidateOnboardingStatus(details) === "not_started")
    redirect("/welcome");
  const identity = await candidateAPI<CandidateProfileSummary>(
    "/api/v1/candidate/profile/summary",
  ).catch(() => null);
  return (
    <CandidateShell
      identity={identity}
      name={
        [session.first_name, session.last_name].filter(Boolean).join(" ") ||
        "Candidate"
      }
    >
      {children}
    </CandidateShell>
  );
}
