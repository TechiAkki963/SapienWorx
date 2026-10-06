import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  validateProfile,
  validateDetails,
  calculatedExperience,
} from "../../lib/profile-validation";
import type { CandidateDetails, CandidateProfile } from "../../lib/candidate";
type Case = {
  name: string;
  core?: CandidateProfile;
  details?: CandidateDetails;
  previous?: CandidateDetails;
  fields: string[];
};
const cases: Case[] = JSON.parse(
  readFileSync(
    path.join(
      process.cwd(),
      "../backend/internal/candidate/profile_validation_cases.json",
    ),
    "utf8",
  ),
);
for (const fixture of cases)
  test(`shared profile contract: ${fixture.name}`, () => {
    const fields = fixture.core
      ? validateProfile(fixture.core)
      : validateDetails(fixture.details ?? {}, undefined, fixture.previous);
    expect(Object.keys(fields).sort()).toEqual(fixture.fields.sort());
  });
test("overlapping employment counts elapsed months once", () => {
  expect(
    calculatedExperience(
      [
        {
          joining_year: "2020",
          joining_month: "Jan",
          end_year: "2023",
          end_month: "Jan",
          current_company: "No",
        },
        { joining_year: "2022", joining_month: "Jan", current_company: "Yes" },
      ],
      new Date(2026, 9, 5),
    ),
  ).toBe(81);
  expect(calculatedExperience([{ company: "Legacy" }])).toBeNull();
});

test("frontend contract is byte-identical to canonical backend contract", () => {
  expect(
    readFileSync(path.join(process.cwd(), "lib/profile-contract.json"), "utf8"),
  ).toBe(
    readFileSync(
      path.join(
        process.cwd(),
        "../backend/internal/candidate/profile_contract.json",
      ),
      "utf8",
    ),
  );
});
