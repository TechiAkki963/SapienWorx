"use client";
import { useState } from "react";
import type {
  CandidateProfile,
  CandidateProfileDetails,
} from "@/lib/candidate";
import { apiRequest } from "@/lib/api";
import { ProfileSectionEditor } from "./profile-section-editor";
import type { ProfileEditTarget } from "./profile-domain-fields";
const steps = [
  "Basic profile",
  "Experience",
  "Skills & Education",
  "Career Preferences",
];
export type ProfileFormSection =
  | "about"
  | "experience"
  | "skills"
  | "education"
  | "preferences"
  | "additional";
export function ProfileForm({
  profile,
  extended,
  onSaved,
}: {
  profile: CandidateProfile;
  extended: CandidateProfileDetails;
  onSaved?: () => void;
  guided?: boolean;
}) {
  const savedStep = Number(extended.details.onboarding_step ?? 1);
  const initialStep = Math.max(0, Math.min(3, savedStep - 1));
  const [step, setStep] = useState(initialStep),
    [p, setProfile] = useState(profile),
    [d, setDetails] = useState(extended),
    [target, setTarget] = useState<ProfileEditTarget | null>(
      initialStep === 0
        ? { section: "intro" }
        : initialStep === 3
          ? { section: "preferences" }
          : null,
    ),
    [message, setMessage] = useState("");
  async function progress(next: number) {
    try {
      const latest = await apiRequest<CandidateProfileDetails>(
        "/api/v1/candidate/profile/details",
      );
      const updated = await apiRequest<CandidateProfileDetails>(
        "/api/v1/candidate/profile/details",
        {
          method: "PATCH",
          body: JSON.stringify({
            details: { ...latest.details, onboarding_step: next + 1 },
            current_salary_amount: latest.current_salary_amount ?? null,
            current_salary_currency: latest.current_salary_currency,
            expected_salary_amount: latest.expected_salary_amount ?? null,
            expected_salary_currency: latest.expected_salary_currency,
          }),
        },
      );
      setDetails(updated);
      setStep(next);
      setTarget(
        next === 0
          ? { section: "intro" }
          : next === 3
            ? { section: "preferences" }
            : null,
      );
      setMessage("");
    } catch {
      setMessage(
        "Your profile changes are saved, but the next step could not be recorded. Please retry.",
      );
    }
  }
  function saved(profile: CandidateProfile, details: CandidateProfileDetails) {
    setProfile(profile);
    setDetails(details);
    setTarget(null);
    if (step === 0) void progress(1);
    else if (step === 3) onSaved?.();
    else setMessage("Item saved. Add another, or continue when ready.");
  }
  return (
    <div className="profile-v2">
      <nav
        className="profile-v2-builder-nav"
        aria-label="Profile builder steps"
      >
        {steps.map((label, i) => (
          <span key={label} aria-current={step === i ? "step" : undefined}>
            <b>{i + 1}</b>
            {label}
          </span>
        ))}
      </nav>
      <section className="profile-v2-card">
        <h2>{steps[step]}</h2>
        <p className="profile-v2-prose mt-2">
          {step === 0
            ? "Start with your professional identity."
            : step === 1
              ? "Add a recent role. If you are starting your career, you can skip work history."
              : step === 2
                ? "Add a skill or qualification that tells people what you bring."
                : "Choose your next move. Compensation stays private."}
        </p>
        {message && (
          <p role="status" className="profile-v2-notice mt-4">
            {message}
          </p>
        )}
        {target ? (
          <ProfileSectionEditor
            key={`${target.section}-${target.index ?? "new"}`}
            target={target}
            profile={p}
            extended={d}
            onSaved={saved}
            onCancel={() => setTarget(null)}
          />
        ) : (
          <div className="mt-5 grid gap-3">
            {step === 0 && (
              <button
                type="button"
                className="profile-v2-button"
                onClick={() => setTarget({ section: "intro" })}
              >
                Edit basic profile
              </button>
            )}
            {step === 1 && (
              <>
                <ul>
                  {d.details.employment?.map((r, i) => (
                    <li key={i} className="profile-v2-item-heading">
                      <span>
                        {r.job_title} · {r.company}
                      </span>
                      <button
                        type="button"
                        className="profile-v2-button"
                        onClick={() =>
                          setTarget({ section: "experience", index: i })
                        }
                      >
                        Edit employment {i + 1}
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="profile-v2-button"
                  onClick={() => setTarget({ section: "experience" })}
                >
                  Add employment
                </button>
              </>
            )}
            {step === 2 && (
              <>
                <ul>
                  {d.details.it_skills?.map((r, i) => (
                    <li key={i} className="profile-v2-item-heading">
                      <span>{r.name}</span>
                      <button
                        type="button"
                        className="profile-v2-button"
                        onClick={() =>
                          setTarget({ section: "skills", index: i })
                        }
                      >
                        Edit skill {i + 1}
                      </button>
                    </li>
                  ))}
                  {d.details.education?.map((r, i) => (
                    <li key={"edu" + i} className="profile-v2-item-heading">
                      <span>
                        {r.level} · {r.university}
                      </span>
                      <button
                        type="button"
                        className="profile-v2-button"
                        onClick={() =>
                          setTarget({ section: "education", index: i })
                        }
                      >
                        Edit education {i + 1}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="profile-v2-button"
                    onClick={() => setTarget({ section: "skills" })}
                  >
                    Add skill
                  </button>
                  <button
                    type="button"
                    className="profile-v2-button"
                    onClick={() => setTarget({ section: "education" })}
                  >
                    Add education
                  </button>
                </div>
              </>
            )}
            {step === 3 && (
              <button
                type="button"
                className="profile-v2-button"
                onClick={() => setTarget({ section: "preferences" })}
              >
                Edit Career Preferences
              </button>
            )}
          </div>
        )}
        {!target && (
          <div className="profile-v2-actions">
            {step > 0 && (
              <button
                type="button"
                className="profile-v2-button"
                onClick={() => void progress(step - 1)}
              >
                Back
              </button>
            )}
            <button
              type="button"
              className="profile-v2-button primary"
              onClick={() => (step < 3 ? void progress(step + 1) : onSaved?.())}
            >
              {step < 3 ? "Save & continue" : "Confirm profile is ready"}
            </button>
          </div>
        )}
      </section>
      <p className="profile-v2-hint">
        Optional personal details, projects and links can be added later from
        your profile.
      </p>
    </div>
  );
}
