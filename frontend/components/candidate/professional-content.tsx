"use client";
import { useState } from "react";
import type { ProfessionalContent, ProfessionalRecord } from "@/lib/candidate";
import type { FieldErrors } from "@/lib/profile-validation";
import { ProfileField } from "./profile-fields";
const fields = {
  projects: {
    title: "Project title",
    description: "Description",
    role: "Your role",
    skills: "Skills",
    url: "Project HTTPS link",
  },
  accomplishments: {
    title: "Achievement / certification",
    issuer: "Issuer",
    description: "Description",
  },
  professional_links: {
    label: "Link label",
    type: "Link type",
    url: "HTTPS link",
  },
};
export type ProfessionalContentKey = keyof typeof fields;
export function ProfessionalContentFields({
  name,
  value,
  errors,
}: {
  name: ProfessionalContentKey;
  value?: ProfessionalContent;
  errors: FieldErrors;
}) {
  const existing = Array.isArray(value) ? value : [];
  const [count, setCount] = useState(existing.length);
  const [removed, setRemoved] = useState<number[]>([]);
  if (!Array.isArray(value))
    return (
      <ProfileField
        name={name}
        label={
          name === "projects"
            ? "Projects"
            : name === "accomplishments"
              ? "Achievements & certifications"
              : "Professional HTTPS links"
        }
        value={value}
        errors={errors}
        kind="textarea"
        maxLength={5000}
      />
    );
  return (
    <div className="grid gap-4">
      <h4 className="font-semibold">
        {name === "professional_links"
          ? "Professional links"
          : name === "projects"
            ? "Projects"
            : "Achievements & certifications"}
      </h4>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="profile-v2-private">
          {removed.includes(i) ? (
            <input type="hidden" name={`${name}[${i}].remove`} value="true" />
          ) : (
            <>
              <div className="profile-v2-form-grid">
                {Object.entries(fields[name]).map(([key, label]) => (
                  <ProfileField
                    key={key}
                    name={`${name}[${i}].${key}`}
                    label={label}
                    value={
                      typeof existing[i]?.[key] === "string"
                        ? (existing[i][key] as string)
                        : ""
                    }
                    errors={errors}
                    kind={key === "description" ? "textarea" : "text"}
                    maxLength={key === "description" ? 5000 : 240}
                    required={
                      key === "title" ||
                      (key === "url" && name === "professional_links")
                    }
                  />
                ))}
              </div>
              <button
                type="button"
                className="profile-v2-button mt-3"
                onClick={() => setRemoved((old) => [...old, i])}
              >
                Remove {name === "professional_links" ? "link" : "entry"}{" "}
                {i + 1}
              </button>
            </>
          )}
        </div>
      ))}
      <button
        type="button"
        className="profile-v2-button"
        disabled={count >= 20}
        onClick={() => setCount((n) => n + 1)}
      >
        Add {name === "professional_links" ? "link" : "entry"}
      </button>
    </div>
  );
}
export function readProfessionalContent(
  name: ProfessionalContentKey,
  value: ProfessionalContent | undefined,
  values: Record<string, string>,
): ProfessionalContent {
  if (!Array.isArray(value)) return values[name] ?? value ?? "";
  const indexes = [
    ...new Set(
      Object.keys(values).flatMap((key) => {
        const match = key.match(new RegExp(`^${name}\\[(\\d+)\\]\\.`));
        return match ? [Number(match[1])] : [];
      }),
    ),
  ].sort((a, b) => a - b);
  return indexes
    .filter((i) => !values[`${name}[${i}].remove`])
    .map((i) => ({
      ...value[i],
      ...Object.fromEntries(
        Object.keys(fields[name]).map((key) => [
          key,
          values[`${name}[${i}].${key}`] ?? "",
        ]),
      ),
    }));
}
export function SafeProfessionalLink({
  url,
  label,
}: {
  url?: string;
  label?: string;
}) {
  let safe = false;
  try {
    const u = new URL(url ?? "");
    safe = u.protocol === "https:" && !u.username && !u.password;
  } catch {}
  return safe ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="profile-v2-link break-all"
    >
      {label || url}
    </a>
  ) : (
    <span className="break-all">{label || url}</span>
  );
}
export function ProfessionalContentView({
  value,
  links = false,
}: {
  value?: ProfessionalContent;
  links?: boolean;
}) {
  if (!value) return null;
  if (typeof value === "string")
    return links ? (
      <ul>
        {value
          .split(/[\n,]+/)
          .filter(Boolean)
          .map((url, i) => (
            <li key={i}>
              <SafeProfessionalLink url={url.trim()} />
            </li>
          ))}
      </ul>
    ) : (
      <p className="profile-v2-prose whitespace-pre-line">{value}</p>
    );
  return (
    <div className="grid gap-4">
      {value.map((r: ProfessionalRecord, i) => (
        <article key={i}>
          {links ? (
            <SafeProfessionalLink url={r.url} label={r.label} />
          ) : (
            <>
              <h3 className="font-semibold">{r.title}</h3>
              {r.issuer && <p className="profile-v2-meta">{r.issuer}</p>}
              {r.role && <p className="profile-v2-meta">{r.role}</p>}
              {r.description && (
                <p className="profile-v2-prose whitespace-pre-line">
                  {r.description}
                </p>
              )}
              {r.skills && (
                <p className="profile-v2-meta">Skills: {r.skills}</p>
              )}
              {r.url && <SafeProfessionalLink url={r.url} />}
            </>
          )}
        </article>
      ))}
    </div>
  );
}
