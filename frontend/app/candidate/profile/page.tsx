import { ProfileEditor } from "@/components/candidate/profile-editor";
import { WorkspaceError } from "@/components/candidate/workspace-error";
import {
  CandidateProfile,
  CandidateProfileDetails,
  CandidateProfileSummary,
} from "@/lib/candidate";
import { candidateAPI } from "@/lib/candidate-server";
import "@/components/candidate/profile-v2.css";
import "@/components/candidate/profile-reference.css";

export default async function CandidateProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ panel?: string }>;
}) {
  const params = await searchParams;
  let profile: CandidateProfile;

  try {
    profile = await candidateAPI<CandidateProfile>("/api/v1/candidate/profile");
  } catch {
    return <WorkspaceError title="We couldn’t load your profile." />;
  }

  let extended: CandidateProfileDetails;
  let summary: CandidateProfileSummary;
  try {
    extended = await candidateAPI<CandidateProfileDetails>(
      "/api/v1/candidate/profile/details",
    );
    summary = await candidateAPI<CandidateProfileSummary>(
      "/api/v1/candidate/profile/summary",
    );
  } catch {
    return (
      <WorkspaceError
        title="We couldn’t load your saved profile details."
        message="Your saved profile is safe. Please try again when the connection returns."
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="sr-only">My Professional Profile</h1>
      <ProfileEditor
        profile={profile}
        extended={extended}
        summary={{ ...summary, profile_completion: profile.profile_completion }}
        openVisibility={params.panel === "visibility"}
      />
    </div>
  );
}
