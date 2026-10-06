"use client";
import Link from "next/link";
import { useState } from "react";
import type {
  CandidateProfileDetails,
  CandidateProfileSummary,
} from "@/lib/candidate";
import { experienceText } from "@/lib/profile-validation";
import { ProfileFactIcon } from "./profile-fact-icon";
import { Pencil } from "./candidate-profile-sections";
import { CandidateAvatar } from "./candidate-avatar";
import { CandidatePhotoControls } from "./candidate-photo-controls";
import { useCandidateWorkspace } from "./candidate-workspace-state";

export function ProfileIntroCard({
  summary,
  extended,
  noticeDays,
  onEdit,
  onAdd,
  onVisibility,
  onPreview,
  editing,
}: {
  summary: CandidateProfileSummary;
  extended: CandidateProfileDetails;
  noticeDays?: number;
  onEdit: () => void;
  onAdd: () => void;
  onVisibility: () => void;
  onPreview: () => void;
  editing: boolean;
}) {
  const { identity } = useCandidateWorkspace();
  const [message, setMessage] = useState("");
  const current = extended.details.employment?.find((row) =>
    ["yes", "true"].includes(String(row.current_company).toLowerCase()),
  );
  const designation =
    extended.details.current_designation || current?.job_title;
  const months =
    identity?.total_experience_months ?? summary.total_experience_months;
  async function share() {
    if (!summary.profile_visible) return;
    const url = window.location.origin + `/profile/${summary.share_token}`;
    try {
      if (navigator.share)
        await navigator.share({
          title: summary.full_name + " — SapienWorx profile",
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        setMessage("Profile link copied.");
      }
    } catch {
      setMessage(
        "Sharing was cancelled or unavailable. You can use Preview public profile in visibility settings.",
      );
    }
  }
  return (
    <section
      className="profile-v2-intro"
      aria-labelledby="candidate-identity-title"
    >
      <div className="profile-v2-intro-content">
        <div className="profile-v2-intro-top">
          <div>
            <div
              className="profile-reference-completion"
              style={{
                background: `conic-gradient(#2c9d63 ${summary.profile_completion}%, var(--color-line) 0)`,
              }}
            >
              <CandidateAvatar
                className="profile-v2-avatar"
                name={summary.full_name}
                image={summary.photo_data_url}
              />
              <span
                className="profile-reference-percent"
                aria-label={`Profile completeness ${summary.profile_completion}%`}
              >
                {summary.profile_completion}%
              </span>
            </div>
            <CandidatePhotoControls disabled={editing} />
          </div>
        </div>
        <div className="profile-reference-identity">
          <div className="profile-v2-identity">
            <h2 id="candidate-identity-title">{summary.full_name}</h2>
            <Pencil
              label="Edit basic details"
              onClick={onEdit}
              disabled={editing}
            />
          </div>
          {designation && (
            <p className="profile-v2-headline mt-1">
              {designation}
              {current?.company ? ` at ${current.company}` : ""}
            </p>
          )}
          {summary.headline && (
            <p className="profile-v2-prose mt-2">{summary.headline}</p>
          )}
          <dl className="profile-reference-header-facts">
            <div>
              <dt>
                <ProfileFactIcon type="location" />
                <span className="sr-only">Current location</span>
              </dt>
              <dd>{summary.current_location || "Add current location"}</dd>
            </div>
            <div>
              <dt>
                <ProfileFactIcon type="phone" />
                <span className="sr-only">Mobile number</span>
              </dt>
              <dd>
                {identity?.primary_phone ||
                  summary.primary_phone ||
                  "Mobile number not added"}
                <Link
                  href="/candidate/settings"
                  className="ml-2 font-semibold text-indigo text-xs"
                >
                  Change
                </Link>
              </dd>
            </div>
            <div>
              <dt>
                <ProfileFactIcon type="experience" />
                <span className="sr-only">Total experience</span>
              </dt>
              <dd>{experienceText(months)}</dd>
            </div>
            <div>
              <dt>
                <ProfileFactIcon type="email" />
                <span className="sr-only">Verified email</span>
              </dt>
              <dd>
                {summary.email}
                {summary.email_verified && (
                  <span
                    className="profile-v2-verified"
                    aria-label="Email verified"
                  >
                    {" "}
                    ✓
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>
                <ProfileFactIcon type="location" />
                <span className="sr-only">Preferred locations</span>
              </dt>
              <dd>
                {summary.preferred_locations.join(", ") ||
                  "Add preferred locations"}
              </dd>
            </div>
            <div>
              <dt>
                <ProfileFactIcon type="calendar" />
                <span className="sr-only">Availability</span>
              </dt>
              <dd>
                {noticeDays == null
                  ? "Add availability"
                  : noticeDays === 0
                    ? "Available immediately"
                    : `Available to join in ${noticeDays} days`}
              </dd>
            </div>
          </dl>
          <div className="profile-v2-intro-actions">
            <button
              className="profile-v2-link"
              onClick={onVisibility}
              disabled={editing}
            >
              Profile Visibility
            </button>
            <button
              className="profile-v2-link"
              onClick={onPreview}
              disabled={editing}
            >
              Preview profile
            </button>
            <button
              className="profile-v2-link"
              onClick={onAdd}
              disabled={editing}
            >
              Edit profile ▾
            </button>
            {summary.profile_visible && (
              <button className="profile-v2-link" onClick={() => void share()}>
                Share link
              </button>
            )}
          </div>
          <p className="profile-v2-meta mt-3">
            {summary.discoverable_to_recruiters
              ? "Visible to verified recruiters"
              : "Recruiter discovery is off"}
            {extended.profile_updated_at
              ? " · Updated " +
                new Date(extended.profile_updated_at).toLocaleDateString(
                  "en-GB",
                  {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  },
                )
              : ""}
          </p>
        </div>
        {message && (
          <p role="status" className="profile-v2-notice mt-3">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
