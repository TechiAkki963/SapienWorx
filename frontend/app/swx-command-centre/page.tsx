import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser } from "@/lib/auth-server";

const features = [
  { title: "Tenant governance", body: "Review recruiter organisations and control platform access." },
  { title: "User moderation", body: "Search, suspend, reset and moderate accounts from one control plane." },
  { title: "Budget visibility", body: "Track platform health and AWS SNS usage without third-party dependencies." },
  { title: "Append-only auditing", body: "Critical governance actions are recorded as security evidence." },
];

export default async function CommandCentreGateway() {
  const session = await getSessionUser();
  if (session?.role === "master_admin") redirect("/swx-command-centre/overview");
  if (session?.role === "recruiter") redirect("/recruiter");
  if (session?.role === "candidate") redirect("/candidate");

  return (
    <AuthShell
      eyebrow="Restricted gateway"
      panelLabel="SapienWorx Control Plane"
      title="Govern the platform without exposing the doorway."
      description="This non-advertised gateway is reserved for directly provisioned Master Admin accounts. There is no administrator registration flow."
      features={features}
    >
      <LoginForm role="master_admin" />
    </AuthShell>
  );
}
