import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { PublicFooter } from "@/components/site/public-footer";
import { PublicHeader } from "@/components/site/public-header";
import { Surface } from "@/components/ui/surface";
import { publicAPI } from "@/lib/candidate-server";

type PublicProfile = {
  full_name: string;
  headline?: string;
  current_location?: string;
  preferred_locations: string[];
  total_experience_months: number;
  photo_data_url?: string;
};

function experienceLabel(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years) return `${rest} month${rest === 1 ? "" : "s"}`;
  return `${years} yr${years === 1 ? "" : "s"}${rest ? ` ${rest} mo` : ""}`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "CP";
}

export const dynamic = "force-dynamic";

export default async function PublicCandidateProfilePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const profile = await publicAPI<PublicProfile>(`/api/v1/profiles/${token}`).catch(() => null);
  if (!profile) notFound();

  return (
    <main className="min-h-screen bg-canvas" id="main-content">
      <div className="print:hidden"><PublicHeader /></div>
      <Container className="py-10 sm:py-14">
        <Surface className="mx-auto max-w-4xl overflow-hidden p-0">
          <div className="bg-gradient-to-br from-indigo-soft via-white to-mint/35 p-6 sm:p-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="h-28 w-28 shrink-0">
                {profile.photo_data_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.photo_data_url} alt={`${profile.full_name} profile`} className="h-28 w-28 rounded-full border-4 border-white object-cover shadow-card" />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-navy text-2xl font-bold text-white shadow-card">{initials(profile.full_name)}</div>
                )}
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-indigo">SapienWorx candidate profile</p>
                <h1 className="mt-2 text-4xl font-bold tracking-[-0.045em] text-navy">{profile.full_name}</h1>
                <p className="mt-2 text-lg text-ink-muted">{profile.headline || "Professional candidate profile"}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-navy shadow-sm">{experienceLabel(profile.total_experience_months)} experience</span>
                  {profile.current_location && <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-navy shadow-sm">⌖ {profile.current_location}</span>}
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">Preferred locations</p>
              <p className="mt-2 text-base font-semibold text-navy">{profile.preferred_locations.length ? profile.preferred_locations.join(" · ") : "Not specified"}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">Privacy</p>
              <p className="mt-2 text-sm leading-6 text-ink-muted">This shared profile intentionally hides private contact details. Recruiter access remains governed by SapienWorx permissions.</p>
            </div>
          </div>
        </Surface>
      </Container>
      <div className="print:hidden"><PublicFooter /></div>
    </main>
  );
}
