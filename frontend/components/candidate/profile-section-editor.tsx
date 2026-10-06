"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiRequest, APIRequestError } from "@/lib/api";
import type {
  CandidateDetails,
  CandidateProfile,
  CandidateProfileDetails,
  Education,
  Employment,
  ProfileSkill,
  ProfileLanguage,
} from "@/lib/candidate";
import {
  validateDetails,
  validateProfile,
  type FieldErrors,
} from "@/lib/profile-validation";
import { ExperienceEditor } from "./experience-editor";
import { EducationEditor } from "./education-editor";
import { SkillsEditor } from "./skills-editor";
import {
  CareerPreferencesEditor,
  preferenceKeys,
} from "./career-preferences-editor";
import {
  ProfileDomainFields,
  detailKeys,
  sectionTitles,
  type ProfileEditTarget,
} from "./profile-domain-fields";
import { ProfileField } from "./profile-fields";
import { readProfessionalContent } from "./professional-content";
import {
  ReferenceBasicFields,
  ReferencePersonalFields,
  ReferenceRecordFields,
  ReferenceKeySkills,
  ReferenceDiversityFields,
} from "./profile-reference-fields";
import {
  referenceDetailKeys,
  referenceRecordKeys,
} from "./profile-reference-schema";
import type { ProfessionalRecord } from "@/lib/candidate";
type Props = {
  target: ProfileEditTarget;
  profile: CandidateProfile;
  extended: CandidateProfileDetails;
  onSaved: (
    profile: CandidateProfile,
    extended: CandidateProfileDetails,
  ) => void;
  onCancel: () => void;
  modal?: boolean;
};
const recordKeys = {
  experience: "employment",
  education: "education",
  skills: "it_skills",
  languages: "languages",
} as const;
const modalTitles: Record<string, string> = {
  intro: "Basic details",
  about: "Profile summary",
  experience: "Employment",
  skills: "IT skills",
  preferences: "Career profile",
};
export function ProfileSectionEditor({
  target,
  profile,
  extended,
  onSaved,
  onCancel,
  modal = false,
}: Props) {
  const form = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [errors, setErrors] = useState<FieldErrors>({}),
    [message, setMessage] = useState(""),
    [discard, setDiscard] = useState(false),
    [remove, setRemove] = useState(false);
  let arrayKey: string | undefined =
    recordKeys[target.section as keyof typeof recordKeys] ??
    referenceRecordKeys[target.section];
  if (
    target.section === "project" &&
    typeof extended.details.projects === "string"
  )
    arrayKey = "project_records";
  if (
    target.section === "onlineProfiles" &&
    typeof extended.details.professional_links === "string"
  )
    arrayKey = "online_profiles";
  const rows = (
    arrayKey && Array.isArray(extended.details[arrayKey])
      ? extended.details[arrayKey]
      : []
  ) as ProfessionalRecord[];
  const referenceRecord = !!referenceRecordKeys[target.section];
  const coreSection = ["intro", "headline", "preferences"].includes(
    target.section,
  );
  const salaryEditing =
    target.section === "preferences" || (modal && target.section === "intro");
  const index = target.index ?? rows.length;
  const existing = index < rows.length;
  const row = rows[index] ?? (target.preset ? { level: target.preset } : {});
  useEffect(() => {
    if (!modal) return;
    const element = dialog.current;
    const previous = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    Array.from(
      form.current?.querySelectorAll<HTMLElement>(
        "input:not([type=hidden]),textarea,select",
      ) ?? [],
    )
      .find((el) => el.getClientRects().length > 0)
      ?.focus();
    return () => {
      element?.close();
      document.body.style.overflow = previous;
    };
  }, [modal]);
  function cancel() {
    if (busy) return;
    if (dirty) setDiscard(true);
    else onCancel();
  }
  useEffect(() => {
    Array.from(
      form.current?.querySelectorAll<HTMLElement>(
        "input:not([type=hidden]),textarea,select",
      ) ?? [],
    )
      .find((el) => el.getClientRects().length > 0)
      ?.focus();
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const navigation = (e: MouseEvent) => {
      const link = (e.target as HTMLElement)?.closest("a[href]");
      if (
        link instanceof HTMLAnchorElement &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        e.button === 0 &&
        link.target !== "_blank" &&
        !link.getAttribute("href")?.startsWith("#")
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setDiscard(true);
        form.current?.scrollIntoView({ block: "center" });
      }
    };
    window.addEventListener("beforeunload", handler);
    document.addEventListener("click", navigation, true);
    return () => {
      window.removeEventListener("beforeunload", handler);
      document.removeEventListener("click", navigation, true);
    };
  }, [dirty]);
  function focusError(fields: FieldErrors) {
    requestAnimationFrame(() => {
      const key = Object.keys(fields)[0];
      const firstVisible = Array.from(
        form.current?.querySelectorAll<HTMLElement>('[aria-invalid="true"]') ??
          [],
      ).find((el) => el.getClientRects().length > 0);
      if (firstVisible) {
        firstVisible.focus();
        return;
      }
      const el = form.current?.elements.namedItem(key);
      if (el instanceof HTMLElement) {
        let ancestor = el.parentElement;
        while (ancestor) {
          if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
          ancestor = ancestor.parentElement;
        }
        el.focus();
      } else form.current?.querySelector<HTMLElement>("[role=alert]")?.focus();
    });
  }
  useEffect(() => {
    if (!busy && Object.keys(errors).length) focusError(errors);
  }, [errors, busy]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const deleting =
      (event.nativeEvent as SubmitEvent).submitter instanceof
        HTMLButtonElement &&
      ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement)
        .value === "delete";
    const data = new FormData(event.currentTarget);
    const values = Object.fromEntries(
      [...data.entries()].map(([k, v]) => [k, String(v).trim()]),
    );
    setMessage("");
    setErrors({});
    let scoped: CandidateDetails = {};
    let draftCore = { ...profile };
    let draftSalary = {
      current_salary_amount: extended.current_salary_amount,
      expected_salary_amount: extended.expected_salary_amount,
      current_salary_currency: extended.current_salary_currency,
      expected_salary_currency: extended.expected_salary_currency,
    };
    if (target.section === "intro") {
      draftCore = {
        ...profile,
        full_name: values.full_name,
        headline: values.headline ?? profile.headline,
        current_city: values.current_city,
        current_state: values.current_state,
        country_code: values.country_code,
        notice_period_days: modal
          ? values.notice_period_days === ""
            ? undefined
            : Number(values.notice_period_days)
          : profile.notice_period_days,
        total_experience_months: modal
          ? values.work_status === "Fresher"
            ? 0
            : Number(values.experience_years || 0) * 12 +
              Number(values.experience_months || 0)
          : data.has("total_experience_months")
            ? Number(values.total_experience_months)
            : profile.total_experience_months,
      };
    }
    if (modal && target.section === "intro")
      draftSalary = {
        ...draftSalary,
        current_salary_amount: data.has("current_salary_amount")
          ? values.current_salary_amount === ""
            ? undefined
            : Number(values.current_salary_amount)
          : extended.current_salary_amount,
        current_salary_currency:
          values.current_salary_currency ?? extended.current_salary_currency,
      };
    if (target.section === "headline")
      draftCore = { ...profile, headline: values.headline };
    if (target.section === "preferences") {
      draftCore = {
        ...profile,
        notice_period_days:
          values.notice_period_days === ""
            ? undefined
            : Number(values.notice_period_days),
      };
      draftSalary = {
        current_salary_amount:
          values.current_salary_amount === ""
            ? undefined
            : Number(values.current_salary_amount),
        expected_salary_amount:
          values.expected_salary_amount === ""
            ? undefined
            : Number(values.expected_salary_amount),
        current_salary_currency: values.current_salary_currency,
        expected_salary_currency: values.expected_salary_currency,
      };
      if (
        values.current_salary_unit === "Monthly" &&
        draftSalary.current_salary_amount != null
      )
        draftSalary.current_salary_amount =
          Math.round(draftSalary.current_salary_amount * 12 * 100) / 100;
      if (
        values.expected_salary_unit === "Monthly" &&
        draftSalary.expected_salary_amount != null
      )
        draftSalary.expected_salary_amount =
          Math.round(draftSalary.expected_salary_amount * 12 * 100) / 100;
    }
    const keys =
      target.section === "preferences"
        ? preferenceKeys
        : (referenceDetailKeys[target.section] ??
          detailKeys[target.section] ??
          []);
    for (const key of keys)
      if (data.has(String(key))) scoped[key] = values[String(key)];
    for (const key of [
      "more_information",
      "usa_work_authorization",
      "desired_job_type",
      "desired_employment_type",
    ] as const)
      if (data.has(key + "_present"))
        scoped[key] = data.getAll(key).map(String);
    if (target.section === "keyskills")
      scoped.key_skills = [
        ...new Set(
          values.key_skills
            .split(/[,\n]+/)
            .map((v) => v.trim())
            .filter(Boolean),
        ),
      ];
    if (
      target.section === "personal" &&
      data.has("personal_languages_present")
    ) {
      const indexes = [
        ...new Set(
          Object.keys(values).flatMap((key) => {
            const match = key.match(/^languages\[(\d+)\]\./);
            return match ? [Number(match[1])] : [];
          }),
        ),
      ].sort((a, b) => a - b);
      scoped.languages = indexes
        .filter((i) => !values[`languages[${i}].remove`])
        .map((i) => ({
          ...extended.details.languages?.[i],
          language: values[`languages[${i}].language`],
          proficiency: values[`languages[${i}].proficiency`],
          read: values[`languages[${i}].read`] ? "Yes" : "No",
          write: values[`languages[${i}].write`] ? "Yes" : "No",
          speak: values[`languages[${i}].speak`] ? "Yes" : "No",
        }));
    }
    if (target.section === "projects") {
      scoped.projects = readProfessionalContent(
        "projects",
        extended.details.projects,
        values,
      );
      scoped.accomplishments = readProfessionalContent(
        "accomplishments",
        extended.details.accomplishments,
        values,
      );
    }
    if (target.section === "links")
      scoped.professional_links = readProfessionalContent(
        "professional_links",
        extended.details.professional_links,
        values,
      );
    if (arrayKey) {
      const next = [...rows];
      if (deleting) next.splice(index, 1);
      else {
        const prefix = `${arrayKey}[${index}].`;
        const record: Employment &
          Omit<Education, "end_year"> &
          ProfileSkill &
          ProfileLanguage &
          ProfessionalRecord = {
          ...row,
          ...Object.fromEntries(
            Object.entries(values)
              .filter(([key]) => key.startsWith(prefix))
              .map(([key, value]) => [key.slice(prefix.length), value]),
          ),
        };
        if (arrayKey === "employment") {
          record.current_company = values[prefix + "current_company"]
            ? "Yes"
            : "No";
          if (record.current_company === "Yes") {
            record.end_year = null;
            record.end_month = null;
          }
        }
        if (arrayKey === "it_skills") {
          const total =
            Number(record.experience_years || 0) * 12 +
            Number(record.experience_months || 0);
          if (
            Number.isInteger(total) &&
            total >= 0 &&
            Number(record.experience_years || 0) >= 0 &&
            Number(record.experience_months || 0) >= 0
          ) {
            record.experience_years = Math.floor(total / 12);
            record.experience_months = total % 12;
          }
        }
        if (arrayKey === "languages")
          for (const key of ["read", "write", "speak"])
            record[key] = values[prefix + key] ? "Yes" : "No";
        if (target.section === "project" && record.status === "In progress") {
          record.end_year = null;
          record.end_month = null;
        }
        if (
          target.section === "workSamples" ||
          target.section === "memberships"
        ) {
          record.current = values[prefix + "current"] ? "Yes" : "No";
          if (record.current === "Yes") {
            record.end_year = null;
            record.end_month = null;
          }
        }
        if (target.section === "certifications") {
          record.no_expiry = values[prefix + "no_expiry"] ? "Yes" : "No";
          if (record.no_expiry === "Yes") {
            record.end_year = null;
            record.end_month = null;
          }
        }
        next[index] = record;
      }
      scoped = { ...scoped, [arrayKey]: next };
    }
    let localErrors: FieldErrors = {};
    if (!deleting) {
      if (coreSection) localErrors = validateProfile(draftCore);
      localErrors = {
        ...localErrors,
        ...validateDetails(
          scoped,
          salaryEditing ? draftSalary : undefined,
          extended.details,
        ),
      };
    }
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      setMessage("Check the highlighted fields.");
      return;
    }
    setBusy(true);
    let coreSaved = false;
    try {
      const latestCore = await apiRequest<CandidateProfile>(
        "/api/v1/candidate/profile",
      );
      let latest = await apiRequest<CandidateProfileDetails>(
        "/api/v1/candidate/profile/details",
      );
      const conflicts = Object.keys(scoped).some(
        (key) =>
          JSON.stringify(latest.details[key]) !==
          JSON.stringify(extended.details[key]),
      );
      const coreKeys =
        target.section === "intro"
          ? ([
              "full_name",
              "headline",
              "current_city",
              "current_state",
              "country_code",
              "total_experience_months",
              "notice_period_days",
            ] as const)
          : target.section === "headline"
            ? (["headline"] as const)
            : target.section === "preferences"
              ? (["notice_period_days"] as const)
              : [];
      const coreConflict = coreKeys.some(
        (key) => latestCore[key] !== profile[key],
      );
      const salaryConflict =
        salaryEditing &&
        (
          [
            "current_salary_amount",
            "expected_salary_amount",
            "current_salary_currency",
            "expected_salary_currency",
          ] as const
        ).some((key) => latest[key] !== extended[key]);
      if (conflicts || coreConflict || salaryConflict)
        throw new Error(
          "This section changed in another session. Reload before saving.",
        );
      // Index-based legacy arrays have no row IDs. Reject competing changes rather than editing the wrong item.
      if (
        arrayKey &&
        JSON.stringify(latest.details[arrayKey] ?? []) !== JSON.stringify(rows)
      )
        throw new Error(
          "This section changed in another session. Your edits are still here; reload the profile before saving.",
        );
      if (coreSection) {
        const core =
          target.section === "intro"
            ? {
                ...latestCore,
                full_name: draftCore.full_name,
                headline: draftCore.headline,
                current_city: draftCore.current_city,
                current_state: draftCore.current_state,
                country_code: draftCore.country_code,
                total_experience_months: draftCore.total_experience_months,
                notice_period_days: draftCore.notice_period_days,
              }
            : target.section === "headline"
              ? { ...latestCore, headline: draftCore.headline }
              : {
                  ...latestCore,
                  notice_period_days: draftCore.notice_period_days,
                };
        const {
          full_name,
          headline,
          current_city,
          current_state,
          country_code,
          total_experience_months,
          notice_period_days,
        } = core;
        await apiRequest<CandidateProfile>("/api/v1/candidate/profile", {
          method: "PATCH",
          body: JSON.stringify({
            expected_profile_updated_at: latest.profile_updated_at,
            full_name,
            headline: headline ?? "",
            current_city: current_city ?? "",
            current_state: current_state ?? "",
            country_code,
            total_experience_months,
            notice_period_days: notice_period_days ?? null,
          }),
        });
        coreSaved = true;
        if (target.section !== "headline") {
          latest = await apiRequest<CandidateProfileDetails>(
            "/api/v1/candidate/profile/details",
          );
          const detailsChangedDuringCoreSave = Object.keys(scoped).some(
            (key) =>
              JSON.stringify(latest.details[key]) !==
              JSON.stringify(extended.details[key]),
          );
          const salaryChangedDuringCoreSave =
            salaryEditing &&
            (
              [
                "current_salary_amount",
                "expected_salary_amount",
                "current_salary_currency",
                "expected_salary_currency",
              ] as const
            ).some((key) => latest[key] !== extended[key]);
          if (detailsChangedDuringCoreSave || salaryChangedDuringCoreSave)
            throw new Error(
              "This section changed in another session. Reload before saving.",
            );
        }
      }
      if (
        target.section !== "headline" &&
        (target.section !== "intro" || modal)
      )
        await apiRequest<CandidateProfileDetails>(
          "/api/v1/candidate/profile/details",
          {
            method: "PATCH",
            body: JSON.stringify({
              expected_profile_updated_at: latest.profile_updated_at,
              details: { ...latest.details, ...scoped },
              current_salary_amount: salaryEditing
                ? (draftSalary.current_salary_amount ?? null)
                : (latest.current_salary_amount ?? null),
              current_salary_currency: salaryEditing
                ? draftSalary.current_salary_currency
                : latest.current_salary_currency,
              expected_salary_amount: salaryEditing
                ? (draftSalary.expected_salary_amount ?? null)
                : (latest.expected_salary_amount ?? null),
              expected_salary_currency: salaryEditing
                ? draftSalary.expected_salary_currency
                : latest.expected_salary_currency,
            }),
          },
        );
      const [savedCore, savedDetails] = await Promise.all([
        apiRequest<CandidateProfile>("/api/v1/candidate/profile"),
        apiRequest<CandidateProfileDetails>(
          "/api/v1/candidate/profile/details",
        ),
      ]);
      setDirty(false);
      onSaved(savedCore, savedDetails);
    } catch (cause) {
      const fields = cause instanceof APIRequestError ? cause.fields : {};
      setErrors(fields);
      setMessage(
        coreSaved
          ? "Basic details were saved, but the remaining changes could not be saved. Your edits are still here; reload before retrying."
          : cause instanceof Error
            ? cause.message + " Your edits are still here."
            : "Could not save. Your edits are still here; please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  const content = (
    <form
      id="candidate-profile-edit-form"
      ref={form}
      className="profile-v2-editor"
      onSubmit={save}
      onChange={() => {
        setDirty(true);
        setDiscard(false);
      }}
      noValidate
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("[data-profile-change]"))
          setDirty(true);
      }}
      aria-label={`Edit ${sectionTitles[target.section]}`}
    >
      <div className="profile-v2-editor-heading">
        {modal && (
          <button
            type="button"
            className="profile-v2-icon profile-modal-close"
            aria-label="Close editor"
            onClick={cancel}
            disabled={busy}
          >
            ×
          </button>
        )}
        <h3>
          {modal ? (
            (modalTitles[target.section] ?? sectionTitles[target.section])
          ) : (
            <>
              {existing ? "Edit" : arrayKey ? "Add" : "Edit"}{" "}
              {target.section === "experience"
                ? "employment"
                : target.section === "skills"
                  ? "skill"
                  : sectionTitles[target.section].toLowerCase()}
            </>
          )}
        </h3>
        <p>Changes apply to this {arrayKey ? "item" : "section"} only.</p>
      </div>
      {message && (
        <p role="alert" tabIndex={-1} className="profile-v2-error-summary">
          {message}
          {Object.keys(errors).length > 0 && (
            <span className="block mt-1">
              {[...new Set(Object.values(errors))].join(" ")}
            </span>
          )}
        </p>
      )}
      <fieldset disabled={busy} className="min-w-0 border-0 p-0">
        {referenceRecord ? (
          <ReferenceRecordFields
            target={target}
            row={row}
            index={index}
            profile={profile}
            extended={extended}
            errors={errors}
          />
        ) : target.section === "headline" ? (
          <ProfileField
            name="headline"
            label="Resume headline"
            value={profile.headline}
            errors={errors}
            kind="textarea"
            maxLength={240}
          />
        ) : target.section === "keyskills" ? (
          <ReferenceKeySkills
            value={extended.details.key_skills}
            errors={errors}
            onChange={() => setDirty(true)}
          />
        ) : target.section === "about" && modal ? (
          <ProfileField
            name="professional_summary"
            label="Profile summary"
            value={extended.details.professional_summary}
            errors={errors}
            kind="textarea"
            maxLength={5000}
          />
        ) : target.section === "highlights" ? (
          <div className="grid gap-4">
            <ProfileField
              name="employment_highlights"
              label="Employment highlights"
              value={extended.details.employment_highlights}
              errors={errors}
              kind="textarea"
              maxLength={5000}
            />
            <ProfileField
              name="interested_domains"
              label="Interested domains"
              value={extended.details.interested_domains}
              errors={errors}
            />
          </div>
        ) : target.section === "intro" && modal ? (
          <ReferenceBasicFields
            profile={profile}
            extended={extended}
            errors={errors}
          />
        ) : target.section === "personal" ? (
          <ReferencePersonalFields extended={extended} errors={errors} />
        ) : target.section === "diversity" ? (
          <ReferenceDiversityFields extended={extended} errors={errors} />
        ) : target.section === "experience" ? (
          <ExperienceEditor
            row={row as Employment}
            index={index}
            errors={errors}
          />
        ) : target.section === "education" ? (
          <EducationEditor
            reference={modal}
            row={row as Education}
            index={index}
            errors={errors}
          />
        ) : target.section === "skills" ? (
          <SkillsEditor
            row={row as ProfileSkill}
            index={index}
            errors={errors}
            onChange={() => setDirty(true)}
          />
        ) : target.section === "preferences" ? (
          <CareerPreferencesEditor
            profile={profile}
            extended={extended}
            errors={errors}
          />
        ) : target.section === "languages" ? (
          <div className="profile-v2-form-grid">
            {["read", "write", "speak"].map((key) => (
              <label key={key} className="profile-v2-check">
                <input
                  name={`languages[${index}].${key}`}
                  type="checkbox"
                  value="Yes"
                  defaultChecked={
                    String(row[key]).toLowerCase() === "yes" ||
                    row[key] === true
                  }
                />
                {key[0].toUpperCase() + key.slice(1)}
              </label>
            ))}
            <ProfileField
              name={`languages[${index}].language`}
              label="Language"
              value={(row as { language?: string }).language}
              errors={errors}
              required
            />
            <ProfileField
              name={`languages[${index}].proficiency`}
              label="Language proficiency"
              value={(row as { proficiency?: string }).proficiency}
              errors={errors}
              kind="select"
              options={[
                "Beginner",
                "Intermediate",
                "Proficient",
                "Native / bilingual",
              ]}
            />
          </div>
        ) : (
          <ProfileDomainFields
            section={target.section}
            profile={profile}
            extended={extended}
            errors={errors}
          />
        )}
      </fieldset>
      <div className="profile-v2-actions">
        {discard ? (
          <>
            <p>Discard unsaved changes?</p>
            <button
              type="button"
              className="profile-v2-button"
              onClick={() => setDiscard(false)}
            >
              Keep editing
            </button>
            <button
              type="button"
              className="profile-v2-button"
              onClick={onCancel}
            >
              Discard changes
            </button>
          </>
        ) : remove ? (
          <>
            <p>Remove this item from your profile?</p>
            <button
              type="button"
              className="profile-v2-button"
              onClick={() => setRemove(false)}
            >
              Keep item
            </button>
            <button
              type="submit"
              name="action"
              value="delete"
              className="profile-v2-button danger"
              disabled={busy}
            >
              Confirm removal
            </button>
          </>
        ) : (
          <>
            <span role="status">
              {busy
                ? "Saving…"
                : dirty
                  ? "Unsaved changes"
                  : "Edit at your pace"}
            </span>
            {existing && arrayKey && (
              <button
                type="button"
                onClick={() => setRemove(true)}
                disabled={busy}
                className="profile-v2-button danger"
              >
                Remove{" "}
                {target.section === "experience"
                  ? "employment"
                  : target.section === "skills"
                    ? "skill"
                    : target.section === "education"
                      ? "education"
                      : target.section === "languages"
                        ? "language"
                        : sectionTitles[target.section].toLowerCase()}
              </button>
            )}
            <button
              type="button"
              className="profile-v2-button"
              disabled={busy}
              onClick={cancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              data-save-and-close
              className="profile-v2-button primary"
              disabled={busy}
            >
              {modal ? "Save" : <>Save {arrayKey ? "item" : "section"}</>}
            </button>
          </>
        )}
      </div>
    </form>
  );
  return modal ? (
    <dialog
      ref={dialog}
      className="profile-v2-modal"
      aria-label={modalTitles[target.section] ?? sectionTitles[target.section]}
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
    >
      {content}
    </dialog>
  ) : (
    content
  );
}
