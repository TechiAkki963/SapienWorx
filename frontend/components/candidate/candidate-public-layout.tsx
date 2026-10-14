import { cache } from "react";
import { getSessionUser } from "@/lib/auth-server";
import { candidateAPI } from "@/lib/candidate-server";
import type { CandidateProfileSummary } from "@/lib/candidate";
import { CandidateShell } from "./candidate-shell";
import "./candidate-workspace.css";
export const candidateBrowsingSession = cache(() => getSessionUser().catch(() => null));
export async function CandidatePublicLayout({ children }: {
    children: React.ReactNode;
}) {
    const session = await candidateBrowsingSession();
    if (session?.role !== "candidate")
        return children;
    const identity = await candidateAPI<CandidateProfileSummary>("/api/v1/candidate/profile/summary").catch(() => null);
    return <CandidateShell userID={session.id} name={[session.first_name, session.last_name].filter(Boolean).join(" ")} identity={identity}>{children}</CandidateShell>;
}
