import { CandidateShell } from "@/components/candidate/candidate-shell";
import { requireRole } from "@/lib/auth-server";
import { CandidateProfileDetails, candidateOnboardingStatus } from "@/lib/candidate";
import { candidateAPI } from "@/lib/candidate-server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  await requireRole("candidate");
  const details = await candidateAPI<CandidateProfileDetails>("/api/v1/candidate/profile/details");
  if (candidateOnboardingStatus(details) === "not_started") redirect("/welcome");
  return <CandidateShell>{children}</CandidateShell>;
}
