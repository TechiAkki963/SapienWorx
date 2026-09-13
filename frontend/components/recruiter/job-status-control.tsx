"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { StatusMenu } from "@/components/recruiter/status-menu";
import { apiRequest } from "@/lib/api";
import { jobStatuses } from "@/lib/recruiter";

export function JobStatusControl({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <StatusMenu
      value={status}
      options={jobStatuses}
      disabled={busy}
      ariaLabel="Job status"
      onChange={async (next) => {
        setBusy(true);
        try {
          await apiRequest(`/api/v1/recruiter/jobs/${jobId}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
