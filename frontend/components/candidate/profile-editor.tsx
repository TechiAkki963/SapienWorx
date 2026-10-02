"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CandidateProfileSections } from "@/components/candidate/candidate-profile-sections";
import { CVManager } from "@/components/candidate/cv-manager";
import { CVParsePreview } from "@/components/candidate/cv-parse-preview";
import { ContactSharingControl } from "@/components/candidate/contact-sharing-control";
import { ProfileForm, ProfileFormSection } from "@/components/candidate/profile-form";
import { ProfileSummaryCard } from "@/components/candidate/profile-summary-card";
import { CandidateProfile, CandidateProfileDetails, CandidateProfileSummary } from "@/lib/candidate";
import { apiRequest } from "@/lib/api";

function formatDateTime(value?: string) {
  if (!value) return "Not recorded yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded yet";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function ProfileEditor({ profile, extended, summary }: { profile: CandidateProfile; extended: CandidateProfileDetails; summary: CandidateProfileSummary }) {
  const router = useRouter();
  const [editingSection, setEditingSection] = useState<ProfileFormSection | null>(null);
  const editing = editingSection !== null;
  const [profileVisible, setProfileVisible] = useState(summary.profile_visible);
  const [discoverable, setDiscoverable] = useState(summary.discoverable_to_recruiters);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [visibilityMessage, setVisibilityMessage] = useState("");
  const details = extended.details ?? {};
  const recommendations = [
    ...(!String(details.professional_summary ?? "").trim() ? [{ label: "Add a short professional summary", href: "#section-about" }] : []),
    ...(!Array.isArray(details.employment) || details.employment.length === 0 ? [{ label: "Add a recent role", href: "#section-experience" }] : []),
    ...(!Array.isArray(details.it_skills) || details.it_skills.length < 3 ? [{ label: "Add a few key skills", href: "#section-skills" }] : []),
    ...(!extended.cv_original_filename ? [{ label: "Add your resume", href: "#section-resume" }] : []),
  ].slice(0, 3);

  async function toggleProfileVisibility(next: boolean) {
    setVisibilityBusy(true);
    setVisibilityMessage("");
    try {
      const latest = await apiRequest<CandidateProfileDetails>("/api/v1/candidate/profile/details");
      await apiRequest<CandidateProfileDetails>("/api/v1/candidate/profile/details", {
        method: "PATCH",
        body: JSON.stringify({
          details: { ...latest.details, profile_visible_in_sourcing: next },
          current_salary_amount: latest.current_salary_amount ?? null,
          current_salary_currency: latest.current_salary_currency || "INR",
          expected_salary_amount: latest.expected_salary_amount ?? null,
          expected_salary_currency: latest.expected_salary_currency || "INR",
        }),
      });
      setProfileVisible(next);
      setVisibilityMessage(next ? "Your shareable profile link is on." : "Your shareable profile link is private.");
      router.refresh();
    } catch (cause) {
      setVisibilityMessage(cause instanceof Error ? cause.message : "Could not update profile visibility. Try again.");
    } finally {
      setVisibilityBusy(false);
    }
  }

  async function toggleDiscovery(next: boolean) {
    setVisibilityBusy(true);
    setVisibilityMessage("");
    try {
      await apiRequest("/api/v1/candidate/profile/discovery", { method: "PATCH", body: JSON.stringify({ enabled: next }) });
      setDiscoverable(next);
      setVisibilityMessage(next ? "Recruiter discovery and pre-application outreach are enabled." : "Recruiter discovery and pre-application outreach are off.");
      router.refresh();
    } catch (cause) {
      setVisibilityMessage(cause instanceof Error ? cause.message : "Could not update discovery preference.");
    } finally { setVisibilityBusy(false); }
  }

  function profileSaved() {
    setEditingSection(null);
    router.refresh();
  }

  function openRecommendation(href: string) {
    if (href === "#section-resume") {
      document.getElementById("section-resume")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const section = href === "#section-experience" ? "experience" : href === "#section-skills" ? "skills" : "about";
    setEditingSection(section);
    const id = href.slice(1);
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }

  return (
    <div className="grid gap-5">
      <ProfileSummaryCard summary={{ ...summary, profile_visible: profileVisible }} onEdit={() => setEditingSection("about")} />

      <div id="section-resume" className="scroll-mt-24"><CVManager currentFilename={extended.cv_original_filename} /></div>
      {process.env.NEXT_PUBLIC_CV_PARSE_PREVIEW_ENABLED === "true" && <details className="rounded-2xl border border-indigo/15 bg-white p-4 shadow-sm sm:p-5"><summary className="cursor-pointer text-sm font-bold text-indigo">Suggest profile updates from a CV</summary><p className="mt-2 text-xs leading-5 text-ink-muted">Suggestions are private until you review and accept them. Uploading a replacement CV never automatically overwrites confirmed fields.</p><div className="mt-4"><CVParsePreview profile={profile} extended={extended} editing={editing} /></div></details>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          {editingSection ? <section id="edit-profile" className="scroll-mt-24 rounded-2xl border border-indigo/15 bg-indigo-soft/20 p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-indigo">Edit one section</p><h2 className="mt-1 font-serif text-2xl font-semibold text-navy">{({ about: "About Me", experience: "Work Experience", skills: "Skills & Expertise", education: "Education", preferences: "Career Preferences", additional: "Additional Information" })[editingSection]}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">Only this section will be updated when you save. Your other profile information remains unchanged.</p></div>
              <button type="button" onClick={() => setEditingSection(null)} className="min-h-10 rounded-full border border-line bg-white px-4 text-sm font-semibold text-navy hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40">Cancel editing</button>
            </div>
            <ProfileForm key={editingSection} profile={profile} extended={extended} section={editingSection} onSaved={profileSaved} />
          </section> : <CandidateProfileSections profile={profile} extended={extended} onEdit={setEditingSection} />}
        </div>

        <aside className="grid gap-4 xl:sticky xl:top-5" aria-label="Profile guidance and privacy">
          <section className="rounded-2xl border border-line/80 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-indigo">Profile strength</p>
            <h2 className="mt-1 font-serif text-xl font-semibold text-navy">{profile.profile_completion}% complete</h2>
            <p className="mt-1 text-xs leading-5 text-ink-muted">Small details can make your experience easier to understand.</p>
            {recommendations.length ? <ul className="mt-4 grid gap-1">
              {recommendations.map((item) => <li key={item.href}><button type="button" onClick={() => openRecommendation(item.href)} className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-sm font-semibold text-indigo hover:bg-indigo-soft/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/40"><span>{item.label}</span><span aria-hidden="true">→</span></button></li>)}
            </ul> : <p className="mt-4 rounded-xl bg-mint/40 px-3 py-3 text-sm font-semibold text-emerald-900">Your core profile sections are in good shape.</p>}
          </section>

          <section className="rounded-2xl border border-line/80 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-indigo">My Resume</p>
            <h2 className="mt-1 truncate font-serif text-xl font-semibold text-navy">{extended.cv_original_filename || "No CV uploaded"}</h2>
            <p className="mt-2 text-xs leading-5 text-ink-muted">Your CV is stored privately. Replacing it will not overwrite your confirmed profile details.</p>
            <a href="#section-resume" className="mt-3 inline-flex min-h-10 items-center text-sm font-bold text-indigo hover:underline">{extended.cv_original_filename ? "View or update CV →" : "Add your CV →"}</a>
          </section>

          <section className="rounded-2xl border border-line/80 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="profile-visibility-title">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-indigo">Privacy & control</p>
            <h2 id="profile-visibility-title" className="mt-1 font-serif text-xl font-semibold text-navy">Shareable profile link</h2>
            <p className="mt-2 text-xs leading-5 text-ink-muted">{profileVisible ? "Anyone with your unique link can view your name, headline, location, experience, preferred locations and photo." : "Your public profile page is private. Recruiter access to applications continues to follow platform permissions."}</p>
            <label className={`mt-4 flex min-h-11 items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 ${editing ? "opacity-60" : ""}`}>
              <span className="text-sm font-semibold text-navy">{profileVisible ? "Link is on" : "Keep link private"}</span>
              <input type="checkbox" role="switch" aria-label="Enable shareable profile link" checked={profileVisible} disabled={editing || visibilityBusy} onChange={(event) => void toggleProfileVisibility(event.target.checked)} className="h-5 w-9 accent-indigo disabled:cursor-not-allowed" />
            </label>
            {editing && <p className="mt-2 text-[11px] leading-5 text-ink-muted">Save or cancel profile edits before changing visibility.</p>}
            {visibilityMessage && <p role="status" className="mt-2 text-xs font-semibold text-indigo">{visibilityMessage}</p>}
            {profileVisible && <Link href={`/profile/${summary.share_token}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center font-bold text-indigo hover:underline">Preview public profile →</Link>}
            <div className="mt-4 border-t border-line pt-4">
              <h3 className="text-sm font-bold text-navy">Recruiter discovery & outreach</h3>
              <p className="mt-1 text-xs leading-5 text-ink-muted">Off by default. If enabled, verified recruiters can find your professional profile and start platform outreach before you apply. Discovery shows professional summary, experience, skills, education and preferred locations—not your email, phone, salary or CV. You can withdraw this consent at any time.</p>
              <label className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
                <span className="text-sm font-semibold text-navy">{discoverable ? "Discovery and outreach enabled" : "Discovery and outreach off"}</span>
                <input type="checkbox" role="switch" aria-label="Allow recruiter discovery and outreach" checked={discoverable} disabled={visibilityBusy || editing} onChange={(event) => void toggleDiscovery(event.target.checked)} className="h-5 w-9 accent-indigo disabled:cursor-not-allowed" />
              </label>
            </div>
            <ContactSharingControl details={extended} />
          </section>

          <section className="rounded-2xl border border-line/80 bg-white p-4 text-xs shadow-sm sm:p-5">
            <h2 className="font-bold text-navy">Profile activity</h2>
            <dl className="mt-3 grid gap-3">
              <div><dt className="text-ink-muted">Last active</dt><dd className="mt-0.5 font-semibold text-navy">{formatDateTime(extended.last_active_at)}</dd></div>
              <div><dt className="text-ink-muted">Profile updated</dt><dd className="mt-0.5 font-semibold text-navy">{formatDateTime(extended.profile_updated_at)}</dd></div>
            </dl>
            <p className="mt-3 leading-5 text-ink-muted">Timestamps are system generated. Your private information is only used according to the platform privacy policy.</p>
            <Link href="/privacy" className="mt-3 inline-flex min-h-10 items-center font-bold text-indigo hover:underline">Privacy information →</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
