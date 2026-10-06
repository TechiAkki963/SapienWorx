"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { useCandidateWorkspace } from "./candidate-workspace-state";
import { WorkspaceDialog } from "./workspace-dialog";

type Challenge = {
  challenge_id: string;
  masked_phone: string;
  expires_at: string;
  resend_after_seconds: number;
};
export function PhoneChange() {
  const { identity, patchIdentity } = useCandidateWorkspace();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [clock, setClock] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    if (!open) return;
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open]);
  const cooldown = Math.max(0, Math.ceil((cooldownUntil - clock) / 1000));
  const expired =
    !!challenge && clock >= new Date(challenge.expires_at).getTime();
  async function requestCode(event?: FormEvent) {
    event?.preventDefault();
    if (Date.now() < cooldownUntil) {
      setError(
        "Please wait for the resend countdown before requesting another code.",
      );
      return;
    }
    const value = phone.replace(/[\s()-]/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(value)) {
      setError(
        "Enter an international mobile number with its country code, for example +91 98765 43210.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<Challenge>(
        "/api/v1/candidate/profile/phone/request",
        { method: "POST", body: JSON.stringify({ phone: value }) },
      );
      setPhone(value);
      setChallenge(result);
      setCode("");
      setClock(Date.now());
      setCooldownUntil(Date.now() + result.resend_after_seconds * 1000);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The verification code could not be sent.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!challenge || !/^\d{6}$/.test(code)) {
      setError("Enter the six-digit verification code.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<{ primary_phone: string }>(
        "/api/v1/candidate/profile/phone/verify",
        {
          method: "POST",
          body: JSON.stringify({ challenge_id: challenge.challenge_id, code }),
        },
      );
      patchIdentity({
        primary_phone: result.primary_phone,
        phone_verified: true,
      });
      setSuccess("Your verified mobile number has been updated.");
      setOpen(false);
      setChallenge(null);
      setCode("");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The code could not be verified.",
      );
    } finally {
      setBusy(false);
    }
  }
  const current = identity?.primary_phone;
  return (
    <div>
      <p>
        {current
          ? `Current mobile: ${current}`
          : "No verified mobile number added."}
      </p>
      <button
        type="button"
        className="candidate-primary-button mt-4"
        onClick={() => {
          setOpen(true);
          setPhone("");
          setCode("");
          setChallenge(null);
          setError("");
          setSuccess("");
        }}
      >
        Change mobile number
      </button>
      {success && <p role="status">{success}</p>}
      {open && (
        <WorkspaceDialog
          title="Change mobile number"
          onClose={() => setOpen(false)}
          busy={busy}
        >
          <p className="text-sm text-ink-muted">
            Your current number stays unchanged until you verify the new number.
          </p>
          {!challenge ? (
            <form className="candidate-phone-form" onSubmit={requestCode}>
              <label>
                New mobile number (country code required)
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  required
                  maxLength={24}
                />
              </label>
              <button
                type="submit"
                className="candidate-primary-button"
                disabled={busy || cooldown > 0}
              >
                {busy
                  ? "Sending code…"
                  : cooldown > 0
                    ? `Send OTP in ${cooldown}s`
                    : "Send OTP"}
              </button>
            </form>
          ) : (
            <form className="candidate-phone-form" onSubmit={verify}>
              <p>
                We sent a code to {challenge.masked_phone}.{" "}
                {expired
                  ? "The code has expired. Request a new one."
                  : "The code expires in " +
                    Math.max(
                      0,
                      Math.ceil(
                        (new Date(challenge.expires_at).getTime() - clock) /
                          60000,
                      ),
                    ) +
                    " minutes."}
              </p>
              <label>
                Verification code
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, ""))
                  }
                  required
                />
              </label>
              <button
                type="submit"
                className="candidate-primary-button"
                disabled={busy || expired}
              >
                {busy ? "Verifying…" : "Verify and update number"}
              </button>
              <div className="flex flex-wrap gap-4">
                <button
                  type="button"
                  disabled={busy || cooldown > 0}
                  onClick={() => void requestCode()}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setChallenge(null);
                    setError("");
                  }}
                >
                  Use a different number
                </button>
              </div>
            </form>
          )}
          {error && (
            <p role="alert" className="candidate-error">
              {error}
            </p>
          )}
        </WorkspaceDialog>
      )}
    </div>
  );
}
