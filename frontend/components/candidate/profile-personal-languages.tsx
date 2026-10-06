"use client";
import { useState } from "react";
import type { ProfileLanguage } from "@/lib/candidate";
import type { FieldErrors } from "@/lib/profile-validation";
import { ProfileField } from "./profile-fields";
export function ProfilePersonalLanguages({
  value,
  errors,
}: {
  value?: ProfileLanguage[];
  errors: FieldErrors;
}) {
  const rows = value ?? [];
  const [count, setCount] = useState(rows.length),
    [removed, setRemoved] = useState<number[]>([]);
  return (
    <div className="grid gap-5">
      <h3 className="font-semibold">Language proficiency</h3>
      <input type="hidden" name="personal_languages_present" value="true" />
      {Array.from({ length: count }, (_, i) =>
        removed.includes(i) ? (
          <input
            key={i}
            type="hidden"
            name={`languages[${i}].remove`}
            value="true"
          />
        ) : (
          <section key={i} className="grid gap-3">
            <div className="profile-v2-form-grid">
              <ProfileField
                name={`languages[${i}].language`}
                label={`Language ${i + 1}`}
                value={rows[i]?.language}
                errors={errors}
                required
              />
              <ProfileField
                name={`languages[${i}].proficiency`}
                label={`Proficiency ${i + 1}`}
                value={rows[i]?.proficiency}
                kind="select"
                options={[
                  "Beginner",
                  "Intermediate",
                  "Proficient",
                  "Native / bilingual",
                ]}
                errors={errors}
              />
            </div>
            <div className="flex flex-wrap gap-5">
              {(["read", "write", "speak"] as const).map((k) => (
                <label key={k} className="profile-v2-check">
                  <input
                    type="checkbox"
                    name={`languages[${i}].${k}`}
                    value="Yes"
                    defaultChecked={["yes", "true"].includes(
                      String(rows[i]?.[k]).toLowerCase(),
                    )}
                  />
                  {k[0].toUpperCase() + k.slice(1)}
                </label>
              ))}
              <button
                type="button"
                className="profile-v2-link"
                data-profile-change
                onClick={() => setRemoved((old) => [...old, i])}
              >
                Delete language {i + 1}
              </button>
            </div>
          </section>
        ),
      )}
      <button
        type="button"
        className="profile-v2-link"
        data-profile-change
        disabled={count >= 30}
        onClick={() => setCount((c) => c + 1)}
      >
        Add another language
      </button>
    </div>
  );
}
