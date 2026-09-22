import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

const recruiterFeatures = [
  { title: "Create and manage jobs", body: "Publish roles, control job status and keep application activity connected to each opening." },
  { title: "Work from a dense candidate pipeline", body: "Filter candidates, review context and move stages explicitly in a table-first workspace." },
  { title: "Coordinate interviews", body: "Schedule interviews using external meeting links and keep candidate communication tied to the workflow." },
  { title: "Verified company access", body: "Recruiter accounts use official business email verification and SapienWorx admin approval." },
];

export default function RecruiterSignupPage() {
  return (
    <AuthShell
      eyebrow="Recruiter registration"
      panelLabel="Build a cleaner hiring operation"
      title="Bring your team into a more focused recruiting workflow."
      description="Register with your official company email, verify your email address and request access to the SapienWorx recruiter workspace."
      features={recruiterFeatures}
      image="/images/people/recruiter-signup.webp"
      imageAlt="Recruiter preparing to set up her hiring workspace"
      imageMode="contain"
      reverseOnDesktop
      tone="peach"
    >
      <SignupForm recruiter />
    </AuthShell>
  );
}
