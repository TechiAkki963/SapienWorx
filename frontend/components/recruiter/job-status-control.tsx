"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { StatusMenu } from "@/components/recruiter/status-menu";
import { apiRequest } from "@/lib/api";
import { jobStatusTransitions } from "@/lib/recruiter";

export function JobStatusControl({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter();
  const [error,setError]=useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div><StatusMenu
      value={status}
      options={jobStatusTransitions[status] ?? [status]}
      disabled={busy}
      ariaLabel="Job status"
      onChange={async (next) => {
        if (["closed","archived"].includes(next)&&!window.confirm("Stop new applications to this job? Existing applications remain available."))return;
        setBusy(true);setError("");
        try {
          await apiRequest(`/api/v1/recruiter/jobs/${jobId}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) });
          router.refresh();
        } catch(c){setError(c instanceof Error?c.message:"Could not update job status.")} finally {
          setBusy(false);
        }
      }}
    />{error&&<p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}</div>
  );
}
