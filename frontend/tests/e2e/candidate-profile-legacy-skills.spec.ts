import { expect, test } from "@playwright/test";
import { login, MOCK_API, recordedRequests, resetE2E } from "./helpers";
import { profileV2Fixture } from "./profile-v2-fixture";

test.beforeEach(async ({ request }) => resetE2E(request));

for (const fixture of [
  {
    name: "legacy text",
    value: " Go, PostgreSQL, TypeScript ",
    skills: ["Go", "PostgreSQL", "TypeScript"],
  },
  { name: "single legacy skill", value: "Rust", skills: ["Rust"] },
  {
    name: "array",
    value: ["Go", "PostgreSQL", "TypeScript"],
    skills: ["Go", "PostgreSQL", "TypeScript"],
  },
  { name: "null", value: null, skills: [] },
  { name: "absent", value: undefined, skills: [] },
]) {
  test(`profile loads and edits ${fixture.name} key skills without losing saved data`, async ({
    page,
    request,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await request.post(`${MOCK_API}/__e2e/profile-fixture`, {
      data: {
        ...profileV2Fixture,
        details: {
          ...profileV2Fixture.details,
          it_skills: [],
          key_skills: fixture.value,
        },
      },
    });
    await login(page, "candidate");
    await page.goto("/candidate/profile");
    await expect(
      page.getByRole("button", { name: "Edit key skills", exact: true }),
    ).toBeVisible();
    const section = page.locator("#section-keyskills");
    for (const skill of fixture.skills)
      await expect(section.getByText(skill, { exact: true })).toBeVisible();
    if (!fixture.skills.length)
      await expect(
        section.getByText("Add the skills that show your strengths."),
      ).toBeVisible();
    const checklist = page.locator(".profile-completion-checklist");
    await checklist.locator("summary").click();
    await expect(
      checklist.getByRole("link", {
        name: fixture.skills.length >= 3
          ? "Skills Added"
          : "Skills Incomplete; open this section",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      (await recordedRequests(request)).filter((r) => r.method === "PATCH"),
    ).toHaveLength(0);

    await page
      .getByRole("button", { name: "Edit resume headline", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Resume headline", exact: true })
      .fill("Updated headline");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    let saved = await (await request.get(`${MOCK_API}/__e2e/state`)).json();
    expect(saved.profileDetails.details.key_skills).toEqual(fixture.value);
    expect(saved.profileDetails.details.legacy_extension).toEqual(
      profileV2Fixture.details.legacy_extension,
    );
    await page.reload();
    await page.setViewportSize({ width: 360, height: 800 });
    await page
      .getByRole("button", { name: "Edit key skills", exact: true })
      .click();
    for (const skill of fixture.skills)
      await expect(
        page.getByRole("button", { name: `Remove ${skill}`, exact: true }),
      ).toBeVisible();
    const input = page.getByRole("combobox", {
      name: "Add skills",
      exact: true,
    });
    await input.fill("Testing");
    await input.press("Enter");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    saved = await (await request.get(`${MOCK_API}/__e2e/state`)).json();
    expect(saved.profileDetails.details.key_skills).toEqual([
      ...fixture.skills,
      "Testing",
    ]);
    expect(saved.profileDetails.details.employment).toEqual(
      profileV2Fixture.details.employment,
    );
    expect(saved.profileDetails.details.legacy_extension).toEqual(
      profileV2Fixture.details.legacy_extension,
    );
    await page.reload();
    await expect(section.getByText("Testing", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
