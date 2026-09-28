import { redirect } from "next/navigation";

import { CandidateWelcome } from "@/components/candidate/candidate-welcome";
import { requireRole } from "@/lib/auth-server";
import { CandidateProfileDetails, candidateOnboardingStatus, safeCandidateJobPath } from "@/lib/candidate";
import { candidateAPI } from "@/lib/candidate-server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function WelcomePage({ searchParams }: Props) {
  const session = await requireRole("candidate");
  const details = await candidateAPI<CandidateProfileDetails>("/api/v1/candidate/profile/details");
  if (candidateOnboardingStatus(details) !== "not_started") redirect("/candidate");
  const params = await searchParams;
  const requested = Array.isArray(params.next) ? params.next[0] : params.next;
  return <CandidateWelcome firstName={session.first_name} returnTo={safeCandidateJobPath(requested)} />;
}
