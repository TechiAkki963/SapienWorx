import { expect, test, type APIRequestContext } from "@playwright/test";
import { login, resetE2E, MOCK_API } from "./helpers";
import { profileV2Fixture } from "./profile-v2-fixture";
import fs from "node:fs/promises";
import path from "node:path";
test.beforeEach(async ({ request }) => {
  await resetE2E(request);
  await request.post(`${MOCK_API}/__e2e/profile-fixture`, {
    data: {
      ...profileV2Fixture,
      details: {
        ...profileV2Fixture.details,
        key_skills: ["Go", "PostgreSQL", "TypeScript"],
      },
    },
  });
});
const state = async (request: APIRequestContext) =>
  (await request.get(`${MOCK_API}/__e2e/state`)).json();
test("reference fields save independently, retain metadata and reload", async ({
  page,
  request,
}) => {
  await login(page, "candidate");
  await page.goto("/candidate/profile");
  await page
    .getByRole("button", { name: "Edit basic details", exact: true })
    .click();
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  await page
    .getByLabel("Locality", { exact: true })
    .fill("Example neighbourhood");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit basic details", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Edit resume headline", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Resume headline", exact: true })
    .fill("Principal Platform Engineer");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit key skills", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Add skills", exact: true })
    .fill("Testing");
  await page
    .getByRole("combobox", { name: "Add skills", exact: true })
    .press("Enter");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit career profile", exact: true })
    .click();
  await page.getByLabel("Role category", { exact: true }).fill("Engineering");
  await page.getByLabel("Job role", { exact: true }).fill("Platform Engineer");
  await page.getByLabel("Permanent", { exact: true }).check();
  await page
    .getByLabel("Preferred shift", { exact: true })
    .selectOption("Flexible");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const saved = await state(request);
  expect(saved.profile.headline).toBe("Principal Platform Engineer");
  expect(saved.profileDetails.details.locality).toBe("Example neighbourhood");
  expect(saved.profileDetails.details.key_skills).toEqual([
    "Go",
    "PostgreSQL",
    "TypeScript",
    "Testing",
  ]);
  expect(saved.profileDetails.details.desired_job_type).toEqual(["Permanent"]);
  expect(saved.profileDetails.details.preferred_shift).toBe("Flexible");
  expect(saved.profileDetails.details.employment).toEqual(
    profileV2Fixture.details.employment,
  );
  expect(saved.profileDetails.details.legacy_extension).toEqual({
    retain: "unchanged",
  });
  expect(saved.profileDetails.current_salary_amount).toBe(1800000);
  await page.reload();
  await expect(
    page
      .locator("#section-headline")
      .getByText("Principal Platform Engineer", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Testing", { exact: true })).toBeVisible();
});
test("all accomplishment categories and project inputs persist without replacing older notes", async ({
  page,
  request,
}) => {
  await request.post(`${MOCK_API}/__e2e/profile-fixture`, {
    data: {
      details: {
        projects: "Existing project notes",
        professional_links: "https://example.test/legacy",
        legacy_extension: { retain: "unchanged" },
      },
    },
  });
  await login(page, "candidate");
  await page.goto("/candidate/profile");
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  await page
    .getByLabel("Project title", { exact: true })
    .fill("Hiring workflow");
  await page.getByLabel("Client", { exact: true }).fill("Synthetic client");
  await page.getByLabel("Worked from year").selectOption("2024");
  await page.getByLabel("Worked from month").selectOption("Jan");
  await page
    .getByLabel("Details of project", { exact: true })
    .fill("Synthetic project details.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const [button, label, title, urlLabel] of [
    ["Add online profile", "Social profile", "Portfolio", "URL"],
    ["Add work sample", "Work title", "Workflow sample", "URL"],
    [
      "Add white paper / research publication / journal entry",
      "Title",
      "Workflow publication",
      "URL",
    ],
    ["Add presentation", "Title", "Workflow presentation", "URL"],
    ["Add patent", "Patent title", "Workflow patent", "URL"],
    [
      "Add certification",
      "Certification name",
      "Workflow certification",
      "Certification URL",
    ],
  ]) {
    await page.getByRole("button", { name: button, exact: true }).click();
    await page.getByLabel(label, { exact: true }).fill(title);
    await page
      .getByLabel(urlLabel, { exact: true })
      .fill("https://example.test/" + title.replaceAll(" ", "-"));
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  const saved = (await state(request)).profileDetails.details;
  expect(saved.projects).toBe("Existing project notes");
  expect(saved.project_records[0]).toMatchObject({
    title: "Hiring workflow",
    client: "Synthetic client",
    status: "In progress",
    end_year: null,
  });
  expect(saved.professional_links).toBe("https://example.test/legacy");
  for (const key of [
    "online_profiles",
    "work_samples",
    "publications",
    "presentations",
    "patents",
    "certifications",
  ])
    expect(saved[key]).toHaveLength(1);
  expect(saved.legacy_extension).toEqual({ retain: "unchanged" });
  await page
    .getByRole("button", { name: "Edit workSamples 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove work sample", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm removal", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const afterRemoval = (await state(request)).profileDetails.details;
  expect(afterRemoval.work_samples).toEqual([]);
  expect(afterRemoval.online_profiles).toHaveLength(1);
  expect(afterRemoval.projects).toBe("Existing project notes");
});
test("modal traps focus, preserves failed drafts and rejects stale updates", async ({
  page,
  request,
}) => {
  await login(page, "candidate");
  await page.goto("/candidate/profile");
  const opener = page.getByRole("button", {
    name: "Edit resume headline",
    exact: true,
  });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Resume headline" });
  const input = dialog.getByLabel("Resume headline", { exact: true });
  await expect(input).toBeFocused();
  await input.press("Shift+Tab");
  expect(
    await page.evaluate(() => !!document.activeElement?.closest("dialog")),
  ).toBe(true);
  await input.fill("Draft headline");
  await request.post(`${MOCK_API}/__e2e/profile-fixture`, {
    data: { profile: { headline: "Other session headline" } },
  });
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("another session");
  await expect(input).toHaveValue("Draft headline");
  await input.press("Escape");
  await expect(dialog.getByText("Discard unsaved changes?")).toBeVisible();
  await dialog
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(opener).toBeFocused();
  expect((await state(request)).profile.headline).toBe(
    "Other session headline",
  );
});
test("basic editor rejects concurrent experience edits", async ({
  page,
  request,
}) => {
  await login(page, "candidate");
  await page.goto("/candidate/profile");
  await page
    .getByRole("button", { name: "Edit basic details", exact: true })
    .click();
  await page.getByLabel("Locality", { exact: true }).fill("Unsaved locality");
  await request.post(`${MOCK_API}/__e2e/profile-fixture`, {
    data: { profile: { total_experience_months: 84 } },
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "another session",
  );
  expect((await state(request)).profile.total_experience_months).toBe(84);
  expect((await state(request)).profileDetails.details.locality).not.toBe(
    "Unsaved locality",
  );
});

test("core and details save detects intervening writes without overwriting them", async ({
  page,
  request,
}) => {
  await login(page, "candidate");
  await page.goto("/candidate/profile");
  await page
    .getByRole("button", { name: "Edit basic details", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Saved synthetic name");
  await page.getByLabel("Locality", { exact: true }).fill("Unsaved locality");
  await page.route("**/api/v1/candidate/profile", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    await request.post(`${MOCK_API}/__e2e/profile-fixture`, {
      data: { details: { locality: "Other session locality" } },
    });
    await route.fulfill({ response });
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Basic details were saved",
  );
  await expect(page.getByLabel("Locality", { exact: true })).toHaveValue(
    "Unsaved locality",
  );
  const saved = await state(request);
  expect(saved.profile.full_name).toBe("Saved synthetic name");
  expect(saved.profileDetails.details.locality).toBe("Other session locality");
});

test("personal date controls, language capabilities and conditional diversity remain owner-only", async ({
  page,
  request,
}) => {
  await login(page, "candidate");
  await page.goto("/candidate/profile");
  await page
    .getByRole("button", { name: "Edit personal details", exact: true })
    .click();
  await page.getByLabel("Date of birth — day").selectOption("29");
  await page.getByLabel("Date of birth — month").selectOption("02");
  await page.getByLabel("Date of birth — year").selectOption("2000");
  await page.getByLabel("Language 1", { exact: true }).fill("English");
  await page
    .getByRole("button", { name: "Add another language", exact: true })
    .click();
  await page.getByLabel("Language 2", { exact: true }).fill("Hindi");
  await page
    .getByLabel("Proficiency 2", { exact: true })
    .selectOption("Proficient");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit language 1: English", exact: true })
    .click();
  await page.getByLabel("Read", { exact: true }).check();
  await page.getByLabel("Write", { exact: true }).uncheck();
  await page.getByLabel("Speak", { exact: true }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit diversity and inclusion", exact: true })
    .click();
  await page.getByLabel("Previously served", { exact: true }).check();
  await page.getByLabel("Service type", { exact: true }).selectOption("Army");
  await page
    .getByLabel("Service number", { exact: true })
    .fill("SYNTHETIC-ONLY");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const saved = (await state(request)).profileDetails.details;
  expect(saved.date_of_birth).toBe("2000-02-29");
  expect(saved.languages[0]).toMatchObject({
    read: "Yes",
    write: "No",
    speak: "Yes",
  });
  expect(saved.languages[1]).toMatchObject({
    language: "Hindi",
    proficiency: "Proficient",
  });
  expect(saved.military_service_type).toBe("Army");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.getByRole("dialog", {
    name: "Professional profile preview",
  });
  await expect(preview).not.toContainText("SYNTHETIC-ONLY");
  await expect(preview).not.toContainText("2000-02-29");
  await expect(preview).not.toContainText("1800000");
});
for (const [width, height] of [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [1024, 768],
  [768, 1024],
  [428, 926],
  [360, 800],
])
  test(`reference layout and every major editor ${width}x${height}`, async ({
    page,
  }) => {
    test.setTimeout(150000);
    await page.setViewportSize({ width, height });
    const dir = path.join(
      process.cwd(),
      "../tmp/full-acceptance/profile-v2/reference-screenshots",
      `${width}x${height}`,
    );
    await fs.mkdir(dir, { recursive: true });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.emulateMedia({ colorScheme: "light" });
    await login(page, "candidate");
    await page.goto("/candidate/profile");
    await expect(
      page.getByRole("heading", { name: "Quick links", exact: true }),
    ).toBeAttached();
    await page.screenshot({
      path: path.join(dir, "light-profile.png"),
      fullPage: true,
    });
    const fit = async () =>
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    await fit();
    const buttons = [
      "Edit basic details",
      "Edit resume headline",
      "Edit key skills",
      "Edit employment 1: Example Labs",
      "Edit education 1: Example University",
      "Edit skill 1: Go",
      "Add project",
      "Edit profile summary",
      "Add online profile",
      "Add work sample",
      "Add white paper / research publication / journal entry",
      "Add presentation",
      "Add patent",
      "Add certification",
      "Edit career profile",
      "Edit personal details",
      "Edit language 1: English",
      "Edit diversity and inclusion",
    ];
    for (let i = 0; i < buttons.length; i++) {
      await page.getByRole("button", { name: buttons[i], exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await fit();
      await page.screenshot({
        path: path.join(dir, `${String(i + 1).padStart(2, "0")}-editor.png`),
      });
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await page
      .getByRole("button", { name: "Profile Visibility", exact: true })
      .first()
      .click();
    await page.screenshot({ path: path.join(dir, "visibility.png") });
    await page
      .getByRole("button", { name: "Close Profile Visibility" })
      .press("Escape");
    await page.getByLabel("Appearance: System", { exact: true }).click();
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await page.screenshot({
      path: path.join(dir, "dark-profile.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Edit personal details", exact: true })
      .click();
    await page.screenshot({ path: path.join(dir, "dark-personal-editor.png") });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await fit();
    expect(errors).toEqual([]);
    if (width >= 768) {
      await page
        .getByRole("navigation", { name: "Candidate workspace" })
        .getByRole("link", { name: "Inbox", exact: true })
        .click();
      await expect(page).toHaveURL(/\/candidate\/inbox$/);
    }
  });
