import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

const recruiterFeatures = [
  { title: "Run a dense hiring workspace", body: "See active roles, applications, shortlisted candidates, interviews and offers at a glance." },
  { title: "Manage candidates in lists", body: "Use a table-first pipeline with filters and explicit stage controls — no Kanban." },
  { title: "Schedule interviews clearly", body: "Store external meeting links, coordinate timing and keep candidate notifications connected." },
  { title: "Keep company hiring scoped", body: "Work only with jobs, candidates and interviews belonging to your verified company account." },
];

export default function RecruiterLoginPage() {
  return (
    <AuthShell
      eyebrow="Recruiter sign in"
      panelLabel="Your hiring workspace"
      title="A focused place for people who hire people."
      description="Sign in to manage jobs, candidate pipelines, interview schedules and hiring activity from one verified company workspace."
      features={recruiterFeatures}
      image="/images/people/recruiter-login.webp"
      imageAlt="Recruitment leader reviewing his hiring workspace"
      imageMode="contain"
      tone="lavender"
    >
      <LoginForm role="recruiter" />
    </AuthShell>
  );
}
