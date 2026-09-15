import { ProfileEditor } from "@/components/candidate/profile-editor";
import { WorkspaceError } from "@/components/candidate/workspace-error";
import { CandidateProfile, CandidateProfileDetails, CandidateProfileSummary } from "@/lib/candidate";
import { candidateAPI } from "@/lib/candidate-server";

function fallbackDetails(): CandidateProfileDetails {
  return {
    details: {},
    current_salary_currency: "INR",
    expected_salary_currency: "INR",
  };
}

function fallbackSummary(profile: CandidateProfile, extended: CandidateProfileDetails): CandidateProfileSummary {
  const preferred = typeof extended.details?.preferred_locations === "string"
    ? extended.details.preferred_locations.split(",").map((item) => item.trim()).filter(Boolean)
    : [];

  const secondaryPhone = typeof extended.details?.secondary_phone === "string"
    ? extended.details.secondary_phone.trim()
    : "";

  return {
    full_name: profile.full_name,
    headline: profile.headline,
    email: profile.email,
    email_verified: false,
    primary_phone: profile.phone,
    secondary_phone: secondaryPhone || undefined,
    current_location: [profile.current_city, profile.current_state].filter(Boolean).join(", "),
    preferred_locations: preferred,
    total_experience_months: profile.total_experience_months,
    profile_completion: profile.profile_completion,
    share_token: "",
    profile_visible: false,
  };
}

export default async function CandidateProfilePage() {
  let profile: CandidateProfile;

  try {
    profile = await candidateAPI<CandidateProfile>("/api/v1/candidate/profile");
  } catch {
    return <WorkspaceError title="We couldn’t load your profile." />;
  }

  const extended = await candidateAPI<CandidateProfileDetails>("/api/v1/candidate/profile/details")
    .catch(() => fallbackDetails());

  const summary = await candidateAPI<CandidateProfileSummary>("/api/v1/candidate/profile/summary")
    .catch(() => fallbackSummary(profile, extended));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 print:hidden">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo">Candidate profile</p>
        <h1 className="mt-2 text-4xl font-bold tracking-[-0.045em] text-navy">Your professional profile</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
          Keep your complete candidate record accurate. Recruiters only see information according to your profile visibility and platform permissions.
        </p>
      </div>
      <ProfileEditor profile={profile} extended={extended} summary={summary} />
    </div>
  );
}
