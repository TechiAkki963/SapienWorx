import { notFound } from "next/navigation";
import { recruiterAPI, RecruiterBackendError } from "./recruiter-server";
import type { EditableRecruiterJob } from "./recruiter";

export async function ownedRecruiterJob(id: string) {
  try { return await recruiterAPI<EditableRecruiterJob>(`/api/v1/recruiter/jobs/${encodeURIComponent(id)}`); }
  catch (error) {
    if (error instanceof RecruiterBackendError && [403, 404].includes(error.status)) notFound();
    throw error;
  }
}
