import { allocateTenantJobId } from "../../../../lib/jobs/identifiers";

const developmentSequences = new Map<string, number>([["nexora-technologies", 6]]);

export async function POST(request: Request) {
  let body: { tenantId?: unknown; companyName?: unknown };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "A tenant and company name are required." }, { status: 400 });
  }

  if (typeof body.tenantId !== "string" || !body.tenantId.trim() || typeof body.companyName !== "string" || !body.companyName.trim()) {
    return Response.json({ error: "Invalid tenant job identifier request." }, { status: 422 });
  }

  const jobId = await allocateTenantJobId({
    tenantId: body.tenantId,
    companyName: body.companyName,
    sequenceStore: {
      async incrementJobSequence(tenantId) {
        const nextValue = (developmentSequences.get(tenantId) ?? 0) + 1;
        developmentSequences.set(tenantId, nextValue);
        return nextValue;
      },
    },
  });

  return Response.json({ jobId }, { status: 201 });
}
