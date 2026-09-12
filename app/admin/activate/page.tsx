import { MasterAdminActivation } from "../../../components/master-admin-activation";

export default async function AdminActivatePage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return <MasterAdminActivation token={typeof token === "string" ? token : ""} />;
}
