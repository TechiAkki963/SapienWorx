import Link from "next/link";
import { PhoneChange } from "@/components/candidate/phone-change";
import { ThemeModeControl } from "@/components/theme/theme-mode-control";

export default function CandidateSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Account settings</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Manage your verified contact details, appearance and privacy.
      </p>
      <section className="candidate-settings-section">
        <h2>Verified mobile number</h2>
        <PhoneChange />
        <p>
          Your verified email remains read-only. Recruiters see your contact
          details only under your existing sharing controls.
        </p>
      </section>
      <section id="security" className="candidate-settings-section"><h2>Account security</h2><p>Reset your password using the verified email attached to your account.</p><Link className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo" href="/forgot-password?returnTo=%2Fcandidate%2Fsettings%23security">Reset your password</Link></section>
      <section className="candidate-settings-section">
        <h2>Appearance</h2>
        <p>Follow your device appearance, or choose Light or Dark.</p>
        <div className="mt-4">
          <ThemeModeControl />
        </div>
      </section>
      <section className="candidate-settings-section">
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
    </div>
  );
}
