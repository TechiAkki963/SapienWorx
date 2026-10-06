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

export function CVManager({
  currentFilename,
}: {
  currentFilename?: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function uploadCV(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      file.type !== "application/pdf" ||
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
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
      const prepared = await apiRequest<UploadResponse>(
        "/api/v1/candidate/cv/presign",
        {
          method: "POST",
          body: JSON.stringify({
            filename: file.name,
            content_type: "application/pdf",
          }),
        },
      );
      const upload = await fetch(prepared.upload.url, {
        method: prepared.upload.method,
        headers: prepared.upload.headers,
        body: file,
      });
      if (!upload.ok)
        throw new Error("The resume upload to private storage failed.");
      await apiRequest<void>("/api/v1/candidate/cv/complete", {
        method: "POST",
      });
      setMessage("Resume uploaded securely.");
      router.refresh();
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Could not upload resume.",
      );
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
      setMessage(
        cause instanceof Error ? cause.message : "Could not open resume.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="profile-reference-resume print:hidden">
      <div className="profile-reference-resume-top">
        <h2>Resume</h2>
        {currentFilename && (
          <button
            type="button"
            aria-label="Download resume"
            onClick={downloadCV}
            disabled={busy}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5" />
            </svg>
          </button>
        )}
      </div>
      <p className="profile-reference-resume-name mt-4">
        {currentFilename || "No resume uploaded yet."}
      </p>
      <div className="profile-reference-resume-drop">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy
            ? "Working…"
            : currentFilename
              ? "Update resume"
              : "Upload resume"}
        </button>
        <p className="profile-v2-hint">Supported format: PDF, up to 5 MB</p>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="application/pdf,.pdf"
          onChange={uploadCV}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
      <p className="profile-v2-hint">
        Your resume stays private and is shared with a company only when you
        apply.
      </p>
      {message && (
        <p
          role="status"
          className="mt-4 rounded-xl bg-indigo-soft/55 px-3 py-2 text-xs font-semibold text-navy"
        >
          {message}
        </p>
      )}
    </section>
  );
}
