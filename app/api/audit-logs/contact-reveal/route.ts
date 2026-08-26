type ContactMethod = "email" | "phone";

type ContactRevealAuditEvent = {
  id: string;
  candidateId: number;
  jobId: string;
  contactMethod: ContactMethod;
  purpose: "recruitment_pipeline";
  recordedAt: string;
};

const developmentAuditLog: ContactRevealAuditEvent[] = [];

export async function POST(request: Request) {
  let body: { candidateId?: unknown; jobId?: unknown; contactMethod?: unknown; purpose?: unknown };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "A JSON audit event is required." }, { status: 400 });
  }

  if (!Number.isInteger(body.candidateId) || typeof body.jobId !== "string" || !/^SWX_[A-Z0-9]+_\d{3,}$/.test(body.jobId) || !["email", "phone"].includes(String(body.contactMethod)) || body.purpose !== "recruitment_pipeline") {
    return Response.json({ error: "Invalid contact-reveal audit event." }, { status: 422 });
  }

  const event: ContactRevealAuditEvent = {
    id: crypto.randomUUID(),
    candidateId: body.candidateId as number,
    jobId: body.jobId,
    contactMethod: body.contactMethod as ContactMethod,
    purpose: "recruitment_pipeline",
    recordedAt: new Date().toISOString(),
  };

  developmentAuditLog.push(event);
  if (developmentAuditLog.length > 500) developmentAuditLog.shift();
  console.info("audit_logs.contact_reveal", event);

  return Response.json({ auditLogId: event.id, recordedAt: event.recordedAt }, { status: 201 });
}
