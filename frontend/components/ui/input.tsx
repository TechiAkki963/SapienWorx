"use client";

import { forwardRef, useId } from "react";

import { cn } from "@/lib/cn";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, hint, id, label, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;

  return (
    <label className="grid gap-2 text-sm font-medium text-ink" htmlFor={inputId}>
      <span>{label}</span>
      <input
        ref={ref}
        id={inputId}
        aria-describedby={hint || error ? descriptionId : undefined}
        aria-invalid={Boolean(error)}
        className={cn(
          "min-h-11 w-full rounded-2xl border border-line bg-white/90 px-4 text-base text-ink shadow-sm outline-none transition placeholder:text-ink-muted/65 focus:border-indigo/55 focus:ring-4 focus:ring-indigo-soft/55",
          error && "border-red-400 focus:border-red-500 focus:ring-red-100",
          className,
        )}
        {...props}
      />
      {(hint || error) && (
        <span id={descriptionId} className={cn("text-xs text-ink-muted", error && "text-red-600")}>
          {error ?? hint}
        </span>
      )}
    </label>
  );
});
