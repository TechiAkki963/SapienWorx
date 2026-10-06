"use client";
import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { useCandidateWorkspace } from "./candidate-workspace-state";

export function CandidatePhotoControls({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const { identity, patchIdentity } = useCandidateWorkspace();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size === 0 ||
      file.size > 5 * 1024 * 1024
    ) {
      setError(true);
      setMessage("Choose a JPEG, PNG or WebP image up to 5 MB.");
      event.target.value = "";
      return;
    }
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      const data = new FormData();
      data.set("image", file);
      const result = await apiRequest<{ photo_data_url: string }>(
        "/api/v1/candidate/profile/photo",
        { method: "POST", body: data },
      );
      patchIdentity({ photo_data_url: result.photo_data_url });
      setMessage("Profile photo updated everywhere in your workspace.");
      router.refresh();
    } catch (cause) {
      setError(true);
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Your photo could not be saved. Try again.",
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function remove() {
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      await apiRequest("/api/v1/candidate/profile/photo", { method: "DELETE" });
      patchIdentity({ photo_data_url: "" });
      setMessage("Profile photo removed.");
      router.refresh();
    } catch (cause) {
      setError(true);
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Your photo could not be removed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="candidate-photo-actions">
        <button
          type="button"
          disabled={busy || disabled}
          onClick={() => input.current?.click()}
        >
          {busy
            ? "Updating photo…"
            : identity?.photo_data_url
              ? "Change photo"
              : "Upload photo"}
        </button>
        {identity?.photo_data_url && (
          <button
            type="button"
            disabled={busy || disabled}
            onClick={() => void remove()}
          >
            Remove photo
          </button>
        )}
        <input
          ref={input}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          accept="image/jpeg,image/png,image/webp"
          onChange={upload}
        />
      </div>
      {busy && (
        <progress className="sr-only" aria-label="Uploading profile photo" />
      )}
      {message && (
        <p
          className="candidate-photo-message"
          role={error ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </div>
  );
}
