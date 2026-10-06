"use client";
import { useId, useState } from "react";
import { profileContract, type FieldErrors } from "@/lib/profile-validation";
export function ProfileDateFields({
  name,
  label,
  value,
  errors,
}: {
  name: string;
  label: string;
  value?: string;
  errors: FieldErrors;
}) {
  const id = useId();
  const [year, setYear] = useState(value?.slice(0, 4) || ""),
    [month, setMonth] = useState(value?.slice(5, 7) || ""),
    [day, setDay] = useState(value?.slice(8, 10) || "");
  const inputDate =
    year && month && day
      ? `${year}-${month}-${day}`
      : year || month || day
        ? "incomplete"
        : "";
  return (
    <fieldset className="profile-reference-date">
      <legend>{label}</legend>
      <input type="hidden" name={name} value={inputDate} />
      {[
        {
          key: "day",
          value: day,
          set: setDay,
          values: Array.from({ length: 31 }, (_, i) => ({
            value: String(i + 1).padStart(2, "0"),
            label: String(i + 1),
          })),
        },
        {
          key: "month",
          value: month,
          set: setMonth,
          values: profileContract.months.map((m, i) => ({
            value: String(i + 1).padStart(2, "0"),
            label: m,
          })),
        },
        {
          key: "year",
          value: year,
          set: setYear,
          values: Array.from(
            { length: new Date().getUTCFullYear() - 1899 },
            (_, i) => ({
              value: String(new Date().getUTCFullYear() - i),
              label: String(new Date().getUTCFullYear() - i),
            }),
          ),
        },
      ].map((part) => (
        <select
          key={part.key}
          name={name + "_" + part.key}
          aria-label={label + " — " + part.key}
          className="profile-v2-input"
          value={part.value}
          onChange={(e) => part.set(e.target.value)}
          aria-invalid={!!errors[name]}
          aria-describedby={errors[name] ? id : undefined}
        >
          <option value="">
            {part.key[0].toUpperCase() + part.key.slice(1)}
          </option>
          {part.values.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      ))}
      {errors[name] && (
        <p id={id} className="profile-v2-error">
          {errors[name]}
        </p>
      )}
      <button
        type="button"
        data-profile-change
        className="profile-v2-link"
        onClick={() => {
          setDay("");
          setMonth("");
          setYear("");
        }}
      >
        Clear {label.toLowerCase()}
      </button>
    </fieldset>
  );
}
