"use client";
import { useId } from "react";
import {
  countries,
  profileContract,
  type FieldErrors,
} from "@/lib/profile-validation";
export type ProfileFieldProps = {
  name: string;
  label: string;
  value?: string | number | null;
  errors: FieldErrors;
  kind?: "text" | "number" | "textarea" | "date" | "select";
  options?: string[];
  required?: boolean;
  hint?: string;
  maxLength?: number;
  disabled?: boolean;
};
export function ProfileField({
  name,
  label,
  value,
  errors,
  kind = "text",
  options,
  required,
  hint,
  maxLength = 240,
  disabled,
}: ProfileFieldProps) {
  const id = useId(),
    error = errors[name];
  const props = {
    id,
    name,
    "aria-label": label,
    defaultValue: value ?? "",
    disabled,
    "aria-invalid": !!error,
    "aria-describedby":
      [hint ? `${id}-hint` : "", error ? `${id}-error` : ""]
        .filter(Boolean)
        .join(" ") || undefined,
    "aria-required": required || undefined,
    className: "profile-v2-input",
  };
  return (
    <div className="profile-v2-field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {kind === "textarea" ? (
        <textarea {...props} maxLength={maxLength} />
      ) : kind === "select" ? (
        <select {...props}>
          <option value="">Select</option>
          {value && !options?.includes(String(value)) && (
            <option value={String(value)}>{value} (saved value)</option>
          )}
          {options?.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...props}
          type={kind}
          maxLength={kind === "text" ? maxLength : undefined}
          step={kind === "number" ? "any" : undefined}
        />
      )}{" "}
      {hint && (
        <p id={`${id}-hint`} className="profile-v2-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="profile-v2-error">
          {error}
        </p>
      )}
    </div>
  );
}
export function CountryField(
  props: Omit<ProfileFieldProps, "kind" | "options"> & {
    onChange?: (code: string) => void;
  },
) {
  const display = new Intl.DisplayNames(["en"], { type: "region" });
  const id = useId(),
    error = props.errors[props.name];
  return (
    <div className="profile-v2-field">
      <label htmlFor={id}>{props.label} *</label>
      <select
        id={id}
        name={props.name}
        aria-label={props.label}
        defaultValue={props.value ?? ""}
        onChange={(event) => props.onChange?.(event.target.value)}
        className="profile-v2-input"
        aria-required="true"
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        <option value="">Select country</option>
        {countries.map((code) => (
          <option key={code} value={code}>
            {display.of(code)} ({code})
          </option>
        ))}
      </select>
      {error && (
        <p className="profile-v2-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
export const yearOptions = Array.from({ length: 201 }, (_, i) =>
  String(2100 - i),
);
export function MonthYearFields({
  prefix,
  year,
  month,
  label,
  errors,
  disabled,
}: {
  prefix: string;
  year?: string | null;
  month?: string | null;
  label: string;
  errors: FieldErrors;
  disabled?: boolean;
}) {
  const joining = prefix.endsWith("joining");
  return (
    <fieldset className="profile-v2-date">
      <legend>{label}</legend>
      <ProfileField
        name={prefix + "_month"}
        label={label + " month"}
        value={month}
        errors={errors}
        kind="select"
        options={profileContract.months}
        disabled={disabled}
      />
      <ProfileField
        name={prefix + "_year"}
        label={label + " year"}
        value={year}
        errors={errors}
        kind="select"
        options={yearOptions}
        disabled={disabled}
      />
      {joining && (
        <span className="sr-only">
          Choose the month and year you started this role.
        </span>
      )}
    </fieldset>
  );
}
