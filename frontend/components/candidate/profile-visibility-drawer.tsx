"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CandidateProfileDetails,
  CandidateProfileSummary,
} from "@/lib/candidate";
import { apiRequest } from "@/lib/api";
import { ContactSharingControl } from "./contact-sharing-control";
import { ProfileDrawer } from "./profile-drawer";
export function ProfileVisibilityDrawer({
  summary,
  extended,
  onClose,
  onChanged,
}: {
  summary: CandidateProfileSummary;
  extended: CandidateProfileDetails;
  onClose: () => void;
  onChanged: (visible: boolean, discoverable: boolean) => void;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(summary.profile_visible),
    [discovery, setDiscovery] = useState(summary.discoverable_to_recruiters),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [contactDirty, setContactDirty] = useState(false),
    [contactBusy, setContactBusy] = useState(false),
    [privateContact, setPrivateContact] = useState(
      extended.details.private_contact === true,
    );
  async function toggle(
    kind: "visibility" | "discovery" | "private_contact",
    next: boolean,
  ) {
    const previous =
      kind === "visibility"
        ? visible
        : kind === "discovery"
          ? discovery
          : privateContact;
    if (kind === "visibility") setVisible(next);
    if (kind === "discovery") setDiscovery(next);
    if (kind === "private_contact") setPrivateContact(next);
    setBusy(true);
    setMessage("");
    try {
      if (kind === "discovery")
        await apiRequest("/api/v1/candidate/profile/discovery", {
          method: "PATCH",
          body: JSON.stringify({ enabled: next }),
        });
      else {
        const latest = await apiRequest<CandidateProfileDetails>(
          "/api/v1/candidate/profile/details",
        );
        await apiRequest("/api/v1/candidate/profile/details", {
          method: "PATCH",
          body: JSON.stringify({
            expected_profile_updated_at: latest.profile_updated_at,
            details: {
              ...latest.details,
              [kind === "visibility"
                ? "profile_visible_in_sourcing"
                : "private_contact"]: next,
            },
            current_salary_amount: latest.current_salary_amount ?? null,
            expected_salary_amount: latest.expected_salary_amount ?? null,
            current_salary_currency: latest.current_salary_currency,
            expected_salary_currency: latest.expected_salary_currency,
          }),
        });
      }
      if (kind === "private_contact") setPrivateContact(next);
      if (kind === "visibility") setVisible(next);
      if (kind === "discovery") setDiscovery(next);
      onChanged(
        kind === "visibility" ? next : visible,
        kind === "discovery" ? next : discovery,
      );
      setMessage(
        kind === "visibility"
          ? next
            ? "Your shareable profile link is on."
            : "Your shareable profile link is private."
          : kind === "discovery"
            ? next
              ? "Recruiter discovery and pre-application outreach are enabled."
              : "Recruiter discovery and pre-application outreach are off."
            : "Contact privacy saved.",
      );
      router.refresh();
    } catch (cause) {
      if (kind === "visibility") setVisible(previous);
      if (kind === "discovery") setDiscovery(previous);
      if (kind === "private_contact") setPrivateContact(previous);
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Could not save your privacy choice.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <ProfileDrawer
      title="Profile Visibility"
      onClose={onClose}
      dirty={contactDirty}
      busy={busy || contactBusy}
    >
      <p className="profile-v2-prose">
        Control how people find you. These settings are independent and off by
        default.
      </p>
      <section className="profile-v2-drawer-section">
        <h3>Shareable profile link</h3>
        <p>
          When enabled, anyone with your unique link can view your name,
          headline, location, experience, preferred locations and photo. Email,
          phone, salary and CV stay private.
        </p>
        <label className="profile-v2-toggle">
          <span>Enable shareable profile link</span>
          <input
            type="checkbox"
            role="switch"
            checked={visible}
            disabled={busy || contactBusy}
            onChange={(e) => void toggle("visibility", e.target.checked)}
          />
        </label>
        {visible && (
          <a
            href={`/profile/${summary.share_token}`}
            target="_blank"
            rel="noreferrer"
            className="profile-v2-link"
          >
            Preview public profile →
          </a>
        )}
      </section>
      <section className="profile-v2-drawer-section">
        <h3>Recruiter discovery & outreach</h3>
        <p>
          Allow verified recruiters to discover your professional profile and
          start platform outreach before you apply. This excludes email, phone,
          salary, CV and optional personal details.
        </p>
        <label className="profile-v2-toggle">
          <span>Allow recruiter discovery and outreach</span>
          <input
            type="checkbox"
            role="switch"
            checked={discovery}
            disabled={busy || contactBusy}
            onChange={(e) => void toggle("discovery", e.target.checked)}
          />
        </label>
      </section>
      <section className="profile-v2-drawer-section">
        <h3>Keep contact private</h3>
        <p>This overrides phone reveal, including at applied companies.</p>
        <label className="profile-v2-toggle">
          <span>Keep my contact details private</span>
          <input
            type="checkbox"
            role="switch"
            checked={privateContact}
            disabled={busy || contactBusy}
            onChange={(e) => void toggle("private_contact", e.target.checked)}
          />
        </label>
      </section>
      <ContactSharingControl
        details={extended}
        onDirtyChange={setContactDirty}
        onBusyChange={setContactBusy}
      />
      {message && (
        <p role="status" className="profile-v2-notice mt-4">
          {message}
        </p>
      )}
      <p className="profile-v2-hint mt-5">
        Visibility and discovery choices save immediately. Phone settings save
        when you choose Save phone settings.
      </p>
    </ProfileDrawer>
  );
}
