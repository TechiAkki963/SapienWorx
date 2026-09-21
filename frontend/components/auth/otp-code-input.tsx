"use client";

import { useId, useRef } from "react";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
};

export function OTPCodeInput({ label, value, onChange, disabled = false, error }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-navy">{label}</label>
      <div
        className="relative flex gap-1.5 rounded-xl focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-indigo sm:gap-2"
        onClick={() => input.current?.focus()}
      >
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} aria-hidden="true" className={`grid h-12 min-w-0 flex-1 place-items-center rounded-lg border text-xl font-bold tabular-nums sm:h-14 sm:max-w-14 ${error ? "border-red-400" : "border-line"} bg-white text-navy`}>{value[index] ?? ""}</span>
        ))}
        <input id={id} ref={input} type="text" name="code" inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9]{6}" value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
          aria-invalid={!!error} aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
          disabled={disabled} required
          className="absolute inset-0 h-full w-full cursor-text rounded-lg border-0 bg-transparent text-base opacity-0" />
      </div>
      <p id={`${id}-help`} className="text-xs text-ink-muted">Enter or paste the six-digit code sent to your email.</p>
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
