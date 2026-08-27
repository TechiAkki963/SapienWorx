import { RegistrationPortal } from "../../components/auth";
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ job?: string | string[] }> }) {
  const { job } = await searchParams;
  return <RegistrationPortal jobId={typeof job === "string" ? job : undefined} />;
}
