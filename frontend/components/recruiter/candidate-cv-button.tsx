"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

type DownloadResponse = {
  download: {
    url: string;
    method: string;
    expires_at: string;
  };
  filename: string;
};

export function CandidateCVButton({ candidateID }: { candidateID: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function openCV() {
    setBusy(true);
    setMessage("");
    try {
      const result = await apiRequest<DownloadResponse>(`/api/v1/recruiter/candidates/${candidateID}/cv`);
      window.open(result.download.url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not open candidate CV.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Button type="button" variant="secondary" onClick={openCV} disabled={busy} className="w-full">
        {busy ? "Opening…" : "Open private CV"}
      </Button>
      {message && <p role="status" className="text-xs leading-5 text-ink-muted">{message}</p>}
    </div>
  );
}
