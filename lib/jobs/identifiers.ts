export type TenantSequenceStore = {
  incrementJobSequence(tenantId: string): Promise<number>;
};

export function companyInitials(companyName: string) {
  const initials = companyName.trim().split(/\s+/).filter(Boolean).map((word) => word[0]).join("").toUpperCase();
  return initials || "ORG";
}

export function formatJobId(companyName: string, sequence: number) {
  return `SWX_${companyInitials(companyName)}_${String(sequence).padStart(3, "0")}`;
}

export async function allocateTenantJobId({ tenantId, companyName, sequenceStore }: { tenantId: string; companyName: string; sequenceStore: TenantSequenceStore }) {
  const sequence = await sequenceStore.incrementJobSequence(tenantId);
  return formatJobId(companyName, sequence);
}
