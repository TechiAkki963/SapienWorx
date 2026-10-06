"use client";
import { useId, useState } from "react";
import { countries, type FieldErrors } from "@/lib/profile-validation";
export function ProfilePermitCountries({
  value,
  errors,
}: {
  value?: string;
  errors: FieldErrors;
}) {
  const id = useId();
  const display = new Intl.DisplayNames(["en"], { type: "region" });
  const original = value ?? "";
  const [selected, setSelected] = useState(
      original
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .map(
          (v) =>
            countries.find(
              (c) =>
                c === v || display.of(c)?.toLowerCase() === v.toLowerCase(),
            ) ?? v,
        ),
    ),
    [changed, setChanged] = useState(false);
  return (
    <div className="profile-v2-field">
      <label htmlFor={id}>Work permit for other countries</label>
      <input
        type="hidden"
        name="other_work_permits"
        value={changed ? selected.join(", ") : original}
      />
      <select
        id={id}
        multiple
        className="profile-v2-input"
        aria-label="Work permit for other countries"
        value={selected}
        onChange={(e) => {
          setSelected(Array.from(e.target.selectedOptions).map((o) => o.value));
          setChanged(true);
        }}
        aria-invalid={selected.length > 3 || !!errors.other_work_permits}
        aria-describedby={id + "-hint"}
      >
        {selected
          .filter((v) => !countries.includes(v))
          .map((v) => (
            <option key={v} value={v}>
              {v} (saved value)
            </option>
          ))}
        {countries.map((c) => (
          <option key={c} value={c}>
            {display.of(c)}
          </option>
        ))}
      </select>
      <p className="profile-v2-hint" id={id + "-hint"}>
        Choose up to 3 countries. Use Ctrl or Command to select more than one.
      </p>
      {(selected.length > 3 || errors.other_work_permits) && (
        <p className="profile-v2-error">
          {errors.other_work_permits || "Choose no more than 3 countries."}
        </p>
      )}
    </div>
  );
}
