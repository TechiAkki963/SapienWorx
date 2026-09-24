"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { APIRequestError, apiRequest } from "@/lib/api";
import { cn } from "@/lib/cn";

export interface DashboardProfileCardProps {
  firstName: string;
  lastName: string;
  headline: string;
  imageUrl?: string | null;
  statLabel: string;
  statValue: string | number;
  className?: string;
}

type UploadResponse = { profile_image_url: string; size_bytes: number; content_type: "image/webp" };

function initials(firstName: string, lastName: string) {
  return `${firstName.trim().slice(0, 1)}${lastName.trim().slice(0, 1)}`.toUpperCase() || "SW";
}

function trustedImagePath(value?: string | null) {
  return value?.startsWith("/api/v1/users/profile-image?version=") ? value : "";
}

export function DashboardProfileCard({ firstName, lastName, headline, imageUrl, statLabel, statValue, className }: DashboardProfileCardProps) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const localPreview = useRef<string | null>(null);
  const [preview, setPreview] = useState(trustedImagePath(imageUrl));
  const [imageFailed, setImageFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const name = [firstName, lastName].filter(Boolean).join(" ").trim() || "SapienWorx member";

  useEffect(() => () => {
    if (localPreview.current) URL.revokeObjectURL(localPreview.current);
  }, []);

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage("Choose a JPEG, PNG or WebP image up to 5 MB.");
      event.target.value = "";
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("image", file);
      const result = await apiRequest<UploadResponse>("/api/v1/users/profile-image", { method: "POST", body: form });
      if (result.content_type !== "image/webp" || result.size_bytes >= 200 * 1024 || !trustedImagePath(result.profile_image_url)) {
        throw new Error("The server returned an invalid profile image response.");
      }
      if (localPreview.current) URL.revokeObjectURL(localPreview.current);
      localPreview.current = null;
      setPreview(result.profile_image_url);
      setImageFailed(false);
      setMessage("Profile photo updated.");
      router.refresh();
    } catch (cause) {
      if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname) && cause instanceof APIRequestError && cause.code === "storage_unavailable") {
        if (localPreview.current) URL.revokeObjectURL(localPreview.current);
        localPreview.current = URL.createObjectURL(file);
        setPreview(localPreview.current);
        setImageFailed(false);
        setMessage("Local preview only — storage is not configured here, so this photo was not saved.");
      } else {
        setMessage(cause instanceof Error ? cause.message : "Could not update your profile photo.");
      }
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <section className={cn("h-full w-full", className)} aria-label="Your dashboard profile">
      <div className="relative aspect-square w-full max-w-64 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo via-[#7c83e8] to-[#f2a87e] shadow-lg">
        {preview && !imageFailed ? (
          <Image src={preview} alt={`${name} profile photo`} fill unoptimized sizes="(max-width: 639px) 100vw, 256px" className="object-cover" onError={() => setImageFailed(true)} />
        ) : (
          <div aria-hidden="true" className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#555fc1] via-[#837be2] to-[#f0a982]">
            <span className="font-sans text-5xl font-bold tracking-tight text-white drop-shadow-sm">{initials(firstName, lastName)}</span>
          </div>
        )}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className="absolute right-4 top-4 z-[2] rounded-full border border-white/25 bg-black/35 px-3 py-2 text-xs font-semibold text-white shadow-sm backdrop-blur-md transition hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60" aria-label="Change profile photo">
          {busy ? "Uploading…" : "Edit photo"}
        </button>
        <input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} tabIndex={-1} aria-hidden="true" />
        <h2 className="absolute bottom-12 left-4 z-[2] max-w-[calc(100%-2rem)] truncate font-serif text-xl font-bold tracking-tight text-white drop-shadow-sm">{name}</h2>
        <div className="absolute bottom-4 left-4 right-3 z-[2] flex min-w-0 items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-sans text-sm text-slate-200 drop-shadow-sm">{headline || "SapienWorx member"}</p>
          <span className="ml-auto max-w-[54%] shrink-0 truncate rounded-full border border-white/20 bg-white/25 px-3 py-1.5 text-xs font-medium text-white shadow-sm backdrop-blur-md" aria-label={`${statLabel}: ${statValue}`}>
            <span className="text-white/90">{statLabel}</span> <span className="font-bold">{statValue}</span>
          </span>
        </div>
      </div>
      {message && <p role="status" className="mt-2 max-w-64 text-xs font-semibold text-ink-muted">{message}</p>}
    </section>
  );
}
