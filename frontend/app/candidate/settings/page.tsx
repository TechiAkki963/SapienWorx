import Link from "next/link";
import { PhoneChange } from "@/components/candidate/phone-change";
import { ThemeModeControl } from "@/components/theme/theme-mode-control";
import { CandidateAnalyticsConsent, CandidateNotificationPreferences } from "@/components/candidate/candidate-preferences";
import { CandidateDataControls } from "@/components/candidate/candidate-data-controls";

export default function CandidateSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Account settings</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Manage your verified contact details, appearance and privacy.
      </p>
      <section id="job-preferences" className="candidate-settings-section"><h2>Job preferences</h2><p>Manage preferred roles, locations, work modes and availability. Compensation stays private under your existing profile controls.</p><Link className="candidate-primary-action" href="/candidate/profile?edit=preferences#section-preferences">Edit career preferences</Link></section>
      <section id="mobile" className="candidate-settings-section">
        <h2>Verified mobile number</h2>
        <PhoneChange />
        <p>
          Your verified email remains read-only. Recruiters see your contact
          details only under your existing sharing controls.
        </p>
      </section>
      <section id="security" className="candidate-settings-section"><h2>Account security</h2><p>Reset your password using the verified email attached to your account.</p><Link className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo" href="/forgot-password?returnTo=%2Fcandidate%2Fsettings%23security">Reset your password</Link></section>
      <section id="notifications" className="candidate-settings-section"><h2>Notification preferences</h2><p>Choose which updates appear in your in-app inbox. Muting a category does not delete applications, interviews, offers or messages.</p><CandidateNotificationPreferences/></section>
      <section id="appearance" className="candidate-settings-section">
        <h2>Appearance</h2>
        <p>Follow your device appearance, or choose Light or Dark.</p>
        <div className="mt-4">
          <ThemeModeControl />
        </div>
      </section>
      <section id="privacy" className="candidate-settings-section">
        <h2>Privacy & visibility</h2>
        <p>
          Control recruiter discovery, your public profile link and contact
          sharing.
        </p>
        <Link
          href="/candidate/profile?panel=visibility"
          className="mt-4 inline-block font-semibold text-indigo"
        >
          Open privacy & visibility →
        </Link>
        <p>
          <Link href="/privacy" className="font-semibold text-indigo">
            Privacy notice
          </Link>
        </p>
      </section>
      <section id="data" className="candidate-settings-section"><h2>Data &amp; consent</h2><CandidateAnalyticsConsent/><CandidateDataControls/></section>
    </div>
  );
}
