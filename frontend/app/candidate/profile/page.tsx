import { ProfileEditor } from "@/components/candidate/profile-editor";
import { WorkspaceError } from "@/components/candidate/workspace-error";
import { CandidateProfile, CandidateProfileDetails } from "@/lib/candidate";
import { candidateAPI } from "@/lib/candidate-server";

export default async function CandidateProfilePage() {
  let profile: CandidateProfile;
  let extended: CandidateProfileDetails;

  try {
    [profile, extended] = await Promise.all([
      candidateAPI<CandidateProfile>("/api/v1/candidate/profile"),
      candidateAPI<CandidateProfileDetails>("/api/v1/candidate/profile/details"),
    ]);
  } catch {
    return <WorkspaceError title="We couldn’t load your profile." />;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo">Candidate profile</p>
        <h1 className="mt-2 text-4xl font-bold tracking-[-0.045em] text-navy">Your professional profile</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
          Keep your complete candidate record accurate. Recruiters only see information according to your profile visibility and platform permissions.
        </p>
      </div>
      <ProfileEditor profile={profile} extended={extended} />
    </div>
  );
}
