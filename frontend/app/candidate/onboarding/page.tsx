import { CandidateOnboarding } from "@/components/candidate/candidate-onboarding";
import { WorkspaceError } from "@/components/candidate/workspace-error";
import { CandidateProfile, CandidateProfileDetails, safeCandidateJobPath } from "@/lib/candidate";
import { candidateAPI } from "@/lib/candidate-server";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function safeReturnPath(value: string | string[] | undefined) {
  const path = Array.isArray(value) ? value[0] : value;
  return safeCandidateJobPath(path);
}

export default async function CandidateOnboardingPage({ searchParams }: Props) {
  try {
    const [profile, extended] = await Promise.all([
      candidateAPI<CandidateProfile>("/api/v1/candidate/profile"),
      candidateAPI<CandidateProfileDetails>("/api/v1/candidate/profile/details"),
    ]);
    const params = await searchParams;
    const status = extended.details?.onboarding_status;
    const pendingJob = status === "profile_ready" ? undefined : safeCandidateJobPath(String(extended.details?.onboarding_return_to ?? ""));
    return <CandidateOnboarding profile={profile} extended={extended} returnTo={safeReturnPath(params.next) ?? pendingJob} />;
  } catch {
    return <WorkspaceError title="We couldn’t load profile setup." />;
  }
}
