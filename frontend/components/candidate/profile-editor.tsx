"use client";

import { useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import type {
  CandidateProfile,
  CandidateProfileDetails,
  CandidateProfileSummary,
} from "@/lib/candidate";

import { ProfessionalContentView } from "./professional-content";

import { ProfileIntroCard } from "./profile-intro-card";

import { ProfileSectionEditor } from "./profile-section-editor";

import {
  ReferenceProfileSections,
  profileQuickLinks,
} from "./profile-reference-sections";

import { ProfileVisibilityDrawer } from "./profile-visibility-drawer";

import { ProfileDrawer } from "./profile-drawer";

import { CVManager } from "./cv-manager";

import { CVParsePreview } from "./cv-parse-preview";
import { useCandidateWorkspace } from "./candidate-workspace-state";
import { ProfileCompletionChecklist } from "./profile-completion-checklist";

import type {
  ProfileEditTarget,
  ProfileSection,
} from "./profile-domain-fields";

const addGroups: {
  label: string;
  items: { label: string; section: ProfileSection }[];
}[] = [
  {
    label: "Core",
    items: [
      { label: "Experience", section: "experience" },
      { label: "Education", section: "education" },
      { label: "Skills", section: "skills" },
    ],
  },
  {
    label: "Recommended",
    items: [
      { label: "Professional summary", section: "about" },
      { label: "Projects", section: "project" },
      { label: "Certifications", section: "certifications" },
      { label: "Languages", section: "languages" },
      { label: "Online profile", section: "onlineProfiles" },
      { label: "Award", section: "awards" },
      { label: "Professional membership", section: "memberships" },
    ],
  },
  {
    label: "Career",
    items: [
      { label: "Career preferences", section: "preferences" },
      { label: "Availability", section: "preferences" },
      { label: "Work authorization", section: "authorization" },
    ],
  },
  {
    label: "Optional / private",
    items: [
      { label: "Accessibility context", section: "additional" },
      { label: "Career break", section: "additional" },
      { label: "Defence background", section: "additional" },
      { label: "Personal information", section: "personal" },
    ],
  },
];

export function ProfileEditor({
  profile,
  extended,
  summary,
  openVisibility = false,
}: {
  profile: CandidateProfile;
  extended: CandidateProfileDetails;
  summary: CandidateProfileSummary;
  openVisibility?: boolean;
}) {
  const { patchIdentity } = useCandidateWorkspace();
  const router = useRouter();
  const [current, setCurrent] = useState(profile),
    [details, setDetails] = useState(extended),
    [identity, setIdentity] = useState(summary),
    [target, setTarget] = useState<ProfileEditTarget | null>(null),
    [drawer, setDrawer] = useState<"visibility" | "add" | "preview" | null>(
      null,
    ),
    [saved, setSaved] = useState("");
  const opener = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (target || !restoreFocus.current) return;
    const element = opener.current?.isConnected
      ? opener.current
      : document.querySelector<HTMLElement>("#section-intro button");
    if (element && !element.hasAttribute("disabled")) {
      element.focus();
      restoreFocus.current = false;
    }
  }, [target, current, details]);
  useEffect(() => {
    if (openVisibility) setDrawer("visibility");
  }, [openVisibility]);

  useEffect(() => {
    setCurrent(profile);
    setDetails(extended);
    setIdentity(summary);
  }, [profile, extended, summary]);

  function open(next: ProfileEditTarget) {
    if (target) return;
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setDrawer(null);
    setSaved("");
    setTarget(next);
  }

  function close() {
    restoreFocus.current = true;
    setTarget(null);
  }

  function onSaved(p: CandidateProfile, d: CandidateProfileDetails) {
    patchIdentity({
      full_name: p.full_name,
      headline: p.headline,
      current_location: [p.current_city, p.current_state]
        .filter(Boolean)
        .join(", "),
      total_experience_months: p.total_experience_months,
      profile_completion: p.profile_completion,
    });
    setCurrent(p);
    setDetails(d);
    setIdentity((old) => ({
      ...old,
      full_name: p.full_name,
      headline: p.headline,
      current_location: [p.current_city, p.current_state]
        .filter(Boolean)
        .join(", "),
      preferred_locations: String(d.details.preferred_locations ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      total_experience_months: p.total_experience_months,
      profile_completion: p.profile_completion,
    }));
    setSaved("Your profile has been updated.");
    close();
    router.refresh();
  }

  const resume = (
    <div className="profile-v2-resume">
      <CVManager currentFilename={details.cv_original_filename} />
      {process.env.NEXT_PUBLIC_CV_PARSE_PREVIEW_ENABLED === "true" && (
        <details className="profile-v2-cv-review">
          <summary>Suggest profile updates from a CV</summary>
          <p className="profile-v2-hint mt-3">
            Review each suggestion before saving. Your confirmed profile is
            never changed by an upload alone.
          </p>
          <CVParsePreview
            profile={current}
            extended={details}
            editing={!!target}
          />
        </details>
      )}
    </div>
  );

  return (
    <div className="profile-v2 profile-naukri">
      <div id="section-intro" className="scroll-mt-24">
        <ProfileIntroCard
          summary={identity}
          extended={details}
          noticeDays={current.notice_period_days}
          editing={!!target}
          onEdit={() => open({ section: "intro" })}
          onAdd={() => setDrawer("add")}
          onVisibility={() => setDrawer("visibility")}
          onPreview={() => setDrawer("preview")}
        />
      </div>
      {saved && (
        <p role="status" className="profile-v2-notice">
          {saved}
        </p>
      )}

      <div className="profile-v2-layout">
        <nav
          aria-label="Profile sections"
          className="profile-v2-nav profile-reference-quicklinks"
        >
          <h2>Quick links</h2>
          <ProfileCompletionChecklist profile={current} extended={details} />
          <div className="profile-reference-links">
            {profileQuickLinks.map(([id, label]) => (
              <div key={id}>
                <a href={"#section-" + id}>{label}</a>
                {["resume", "experience", "education", "projects"].includes(
                  id,
                ) && (
                  <button
                    className="profile-v2-link"
                    disabled={!!target}
                    onClick={() =>
                      id === "resume"
                        ? document
                            .getElementById("section-resume")
                            ?.scrollIntoView({ block: "start" })
                        : open({
                            section:
                              id === "projects"
                                ? "project"
                                : (id as ProfileSection),
                          })
                    }
                  >
                    {id === "resume" ? "Update" : "Add"}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="profile-reference-sidebar-actions">
            <button
              className="profile-v2-link"
              disabled={!!target}
              onClick={() => setDrawer("visibility")}
            >
              Profile Visibility
            </button>
            <button
              className="profile-v2-link"
              disabled={!!target}
              onClick={() => setDrawer("preview")}
            >
              Preview
            </button>
            <button
              className="profile-v2-link"
              disabled={!!target}
              onClick={() => setDrawer("add")}
            >
              Add profile section
            </button>
          </div>
        </nav>
        <ReferenceProfileSections
          profile={current}
          extended={details}
          editing={!!target}
          onEdit={open}
          resume={resume}
        />
      </div>
      {target && (
        <ProfileSectionEditor
          key={target.section + "-" + (target.index ?? "new")}
          target={target}
          profile={current}
          extended={details}
          onSaved={onSaved}
          onCancel={close}
          modal
        />
      )}

      {drawer === "visibility" && (
        <ProfileVisibilityDrawer
          summary={identity}
          extended={details}
          onClose={() => setDrawer(null)}
          onChanged={(visible, discoverable) => {
            patchIdentity({
              profile_visible: visible,
              discoverable_to_recruiters: discoverable,
            });
            setIdentity((old) => ({
              ...old,
              profile_visible: visible,
              discoverable_to_recruiters: discoverable,
            }));
          }}
        />
      )}

      {drawer === "add" && (
        <ProfileDrawer
          title="Add profile section"
          onClose={() => setDrawer(null)}
        >
          <p className="profile-v2-prose">
            Build the professional story you want to share. Start with the core
            sections; add the rest at your pace.
          </p>
          <div className="profile-v2-add-menu">
            {addGroups.map((g) => (
              <section key={g.label}>
                <h3>{g.label}</h3>
                {g.items.map((item) => (
                  <button
                    type="button"
                    key={item.label}
                    onClick={() => open({ section: item.section })}
                  >
                    {item.label}
                    <span aria-hidden="true">＋</span>
                  </button>
                ))}
              </section>
            ))}
          </div>
        </ProfileDrawer>
      )}

      {drawer === "preview" && (
        <ProfileDrawer
          title="Professional profile preview"
          onClose={() => setDrawer(null)}
        >
          <p className="profile-v2-hint">
            This preview contains professional information only. Your public
            link remains {identity.profile_visible ? "on" : "private"}.
          </p>
          <h3 className="mt-5 font-serif text-2xl">{current.full_name}</h3>
          <p className="profile-v2-headline mt-2">{current.headline}</p>
          <p className="profile-v2-meta">{identity.current_location}</p>
          {details.details.professional_summary && (
            <div className="profile-v2-drawer-section">
              <h3>About</h3>
              <p className="profile-v2-prose whitespace-pre-line">
                {details.details.professional_summary}
              </p>
            </div>
          )}
          {details.details.employment?.map((r, i) => (
            <div key={i} className="profile-v2-drawer-section">
              <h3>{r.job_title}</h3>
              <p>{r.company}</p>
            </div>
          ))}
          {details.details.education?.map((r, i) => (
            <div key={"education" + i} className="profile-v2-drawer-section">
              <h3>{r.level ?? r.education}</h3>
              <p>{r.university}</p>
            </div>
          ))}
          {details.details.it_skills?.length && (
            <div className="profile-v2-drawer-section">
              <h3>Skills</h3>
              <p>{details.details.it_skills.map((r) => r.name).join(" · ")}</p>
            </div>
          )}
          <div className="profile-v2-drawer-section">
            <h3>Projects & achievements</h3>
            <ProfessionalContentView value={details.details.projects} />
            <ProfessionalContentView value={details.details.accomplishments} />
          </div>
          <div className="profile-v2-drawer-section">
            <h3>Professional links</h3>
            <ProfessionalContentView
              value={details.details.professional_links}
              links
            />
          </div>
          {identity.profile_visible && (
            <a
              href={`/profile/${identity.share_token}`}
              target="_blank"
              rel="noreferrer"
              className="profile-v2-link"
            >
              Open your public profile →
            </a>
          )}
        </ProfileDrawer>
      )}
    </div>
  );
}
