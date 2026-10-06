"use client";
import Link from "next/link";
import type {
  CandidateProfile,
  CandidateProfileDetails,
} from "@/lib/candidate";
import { experienceText } from "@/lib/profile-validation";
import { CandidateAvatar } from "./candidate-avatar";
import { CandidatePhotoControls } from "./candidate-photo-controls";
import { useCandidateWorkspace } from "./candidate-workspace-state";

export function CandidateOverviewIdentity({
  profile,
  details,
}: {
  profile: CandidateProfile;
  details: CandidateProfileDetails | null;
}) {
  const { identity } = useCandidateWorkspace();
  const current = details?.details.employment?.find((row) =>
    ["yes", "true"].includes(String(row.current_company).toLowerCase()),
  );
  return (
    <section className="candidate-identity-card" aria-label="Your profile">
      <div>
        <CandidateAvatar name={profile.full_name} />
        <CandidatePhotoControls />
      </div>
      <div className="min-w-0">
        <h2>{identity?.full_name || profile.full_name}</h2>
        <p className="font-semibold">
          {details?.details.current_designation ||
            current?.job_title ||
            identity?.headline ||
            profile.headline ||
            "Build your professional profile"}
        </p>
        <p>
          {identity?.current_location ||
            [profile.current_city, profile.current_state]
              .filter(Boolean)
              .join(", ") ||
            "Add your current location"}
        </p>
        <p>
          {experienceText(
            identity?.total_experience_months ??
              profile.total_experience_months,
          )}
        </p>
        <p>
          Profile completeness{" "}
          <strong className="text-ink">
            {identity?.profile_completion ?? profile.profile_completion}%
          </strong>
        </p>
        <p>
          {identity?.discoverable_to_recruiters
            ? "Visible to verified recruiters"
            : "Recruiter discovery is off"}
        </p>
        <Link
          href="/candidate/profile"
          className="mt-4 inline-block text-sm font-semibold text-indigo"
        >
          View and edit profile →
        </Link>
      </div>
    </section>
  );
}
