"use client";

import { ChangeEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

type PresignedRequest = {
  url: string;
  method: string;
  headers?: Record<string, string>;
  expires_at: string;
};

type UploadResponse = {
  upload: PresignedRequest;
  filename: string;
};

type DownloadResponse = {
  download: PresignedRequest;
  filename: string;
};

export function CVManager({ currentFilename }: { currentFilename?: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function uploadCV(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
      setMessage("Use a PDF resume.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Resume must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const prepared = await apiRequest<UploadResponse>("/api/v1/candidate/cv/presign", {
        method: "POST",
        body: JSON.stringify({ filename: file.name, content_type: "application/pdf" }),
      });
      const upload = await fetch(prepared.upload.url, {
        method: prepared.upload.method,
        headers: prepared.upload.headers,
        body: file,
      });
      if (!upload.ok) throw new Error("The resume upload to private storage failed.");
      await apiRequest<void>("/api/v1/candidate/cv/complete", { method: "POST" });
      setMessage("Resume uploaded securely.");
      router.refresh();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not upload resume.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function downloadCV() {
    setBusy(true);
    setMessage("");
    try {
      const result = await apiRequest<DownloadResponse>("/api/v1/candidate/cv");
      window.open(result.download.url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not open resume.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[1.5rem] border border-line/80 bg-white p-5 shadow-sm sm:p-6 print:hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-indigo">Private resume</p>
          <h2 className="mt-1 text-lg font-bold text-navy">CV storage</h2>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            PDFs are uploaded directly to private object storage using a short-lived signed URL. Recruiters can access your CV only through an application to their company.
          </p>
          <p className="mt-2 text-xs font-semibold text-navy">{currentFilename ? `Current CV: ${currentFilename}` : "No CV uploaded yet."}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {currentFilename && <Button type="button" variant="secondary" onClick={downloadCV} disabled={busy}>Open CV</Button>}
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? "Working…" : currentFilename ? "Replace CV" : "Upload CV"}</Button>
          <input ref={inputRef} className="sr-only" type="file" accept="application/pdf,.pdf" onChange={uploadCV} />
        </div>
      </div>
      {message && <p role="status" className="mt-4 rounded-xl bg-indigo-soft/55 px-3 py-2 text-xs font-semibold text-navy">{message}</p>}
    </section>
  );
}
