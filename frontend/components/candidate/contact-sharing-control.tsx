"use client";

import { useEffect, useState, useRef } from "react";
import { apiRequest, APIRequestError } from "@/lib/api";
import { CandidateProfileDetails } from "@/lib/candidate";

export function ContactSharingControl({
  details,
  onDirtyChange,
  onBusyChange,
}: {
  details: CandidateProfileDetails;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [enabled, setEnabled] = useState(
    details.contact_reveal_enabled ?? false,
  );
  const [alternate, setAlternate] = useState(
    details.alternate_phone_e164 ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const phoneInput = useRef<HTMLInputElement>(null);
  const [fieldError, setFieldError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    apiRequest<CandidateProfileDetails>("/api/v1/candidate/profile/details", {
      cache: "no-store",
    })
      .then((result) => {
        if (active) {
          setEnabled(result.contact_reveal_enabled ?? false);
          setAlternate(result.alternate_phone_e164 ?? "");
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active)
          setMessage(
            "Could not load your saved phone settings. Please refresh before changing them.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function save() {
    if (!loaded) return;
    if (alternate.trim() && !/^\+[1-9][0-9]{7,14}$/.test(alternate.trim())) {
      setFieldError(
        "Use international E.164 format, for example +919876543210.",
      );
      phoneInput.current?.focus();
      return;
    }
    setFieldError("");
    setBusy(true);
    onBusyChange?.(true);
    setMessage("");
    try {
      const result = await apiRequest<CandidateProfileDetails>(
        "/api/v1/candidate/profile/contact-sharing",
        {
          method: "PATCH",
          body: JSON.stringify({
            enabled,
            alternate_phone_e164: alternate.trim(),
          }),
        },
      );
      setEnabled(result.contact_reveal_enabled ?? false);
      setAlternate(result.alternate_phone_e164 ?? "");
      setMessage("Contact sharing preference saved.");
      onDirtyChange?.(false);
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Could not save phone settings. Your edits are still here.",
      );
      if (
        cause instanceof APIRequestError &&
        cause.fields.alternate_phone_e164
      ) {
        setFieldError(cause.fields.alternate_phone_e164);
        phoneInput.current?.focus();
      }
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <div className="mt-4 border-t border-line pt-4">
      <h3 className="text-sm font-bold text-navy">Recruiter phone access</h3>
      <p className="mt-1 text-xs leading-5 text-ink-muted">
        Off by default. If enabled, verified recruiters at companies where you
        applied may reveal your phone number. No digits appear before they
        request it. If your profile marks contact as private, phone reveal
        remains blocked.
      </p>
      <label className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
        <span className="text-sm font-semibold text-navy">
          Allow phone reveal for applied companies
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={enabled}
          disabled={!loaded || busy}
          onChange={(event) => {
            setEnabled(event.target.checked);
            onDirtyChange?.(true);
          }}
          className="h-5 w-9 accent-indigo"
        />
      </label>
      <label className="mt-3 grid gap-1 text-xs font-semibold text-navy">
        Alternate phone (optional)
        <input
          ref={phoneInput}
          type="tel"
          aria-invalid={!!fieldError}
          aria-describedby={fieldError ? "profile-phone-error" : undefined}
          value={alternate}
          disabled={!loaded || busy}
          onChange={(event) => {
            setAlternate(event.target.value);
            onDirtyChange?.(true);
          }}
          placeholder="+919876543210"
          autoComplete="tel"
          className="min-h-10 rounded-lg border border-line px-3 text-sm"
        />
      </label>
      {fieldError && (
        <p id="profile-phone-error" className="profile-v2-error mt-2">
          {fieldError}
        </p>
      )}
      <button
        type="button"
        disabled={!loaded || busy}
        onClick={() => void save()}
        className="mt-3 min-h-10 rounded-lg bg-indigo px-4 text-xs font-bold text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save phone settings"}
      </button>
      {message && (
        <p role="status" className="mt-2 text-xs text-ink-muted">
          {message}
        </p>
      )}
    </div>
  );
}
