import { CandidateShell } from "@/components/candidate/candidate-shell";
import { requireRole, SessionConnectionError } from "@/lib/auth-server";
import { WorkspaceError } from "@/components/candidate/workspace-error";
import { headers } from "next/headers";
import type { CandidateProfileSummary } from "@/lib/candidate";
import { candidateAPI } from "@/lib/candidate-server";
import { redirect } from "next/navigation";
import "@/components/candidate/candidate-workspace.css";
export const dynamic="force-dynamic";
export default async function CandidateLayout({children}:{children:React.ReactNode}) {
  let session;
  try { session=await requireRole("candidate"); }
  catch(cause){if(!(cause instanceof SessionConnectionError))throw cause;return <main className="mx-auto max-w-3xl px-5 py-16"><WorkspaceError title="We couldn’t check your session." message={cause.message} retryHref={(await headers()).get("x-swx-candidate-path")||"/candidate"}/></main>}
  const identity=await candidateAPI<CandidateProfileSummary>("/api/v1/candidate/profile/summary").catch(()=>null);
  if(identity?.onboarding_status==="not_started")redirect("/welcome");
  return <CandidateShell identity={identity} userID={session.id} name={[session.first_name,session.last_name].filter(Boolean).join(" ")||"Candidate"}>{children}</CandidateShell>;
}
