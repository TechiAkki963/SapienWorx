import { expect, test, type Page } from "@playwright/test";
import { login, MOCK_API, resetE2E, recordedRequests } from "./helpers";
import fs from "node:fs/promises";
import path from "node:path";
import { profileV2Fixture } from "./profile-v2-fixture";
const state = async (request: Parameters<typeof resetE2E>[0]) =>
  (await request.get(`${MOCK_API}/__e2e/state`)).json();
async function cancel(page: Page) {
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  if (
    await page
      .getByRole("button", { name: "Discard changes", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Discard changes", exact: true })
      .click();
}
test.describe("Candidate Profile V2", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));
  test("section scoped saves preserve privacy, legacy fields and unrelated records", async ({
    page,
    request,
  }) => {
    await request.post(`${MOCK_API}/__e2e/profile-fixture`, {
      data: profileV2Fixture,
    });
    await login(page, "candidate");
    await page.goto("/candidate/profile");
    await page
      .getByRole("button", { name: "Edit basic details", exact: true })
      .click();
    await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
    await page.getByLabel("Name", { exact: true }).fill("Aarav Candidate");
    await page.getByRole("button", { name: "Save", exact: true }).click();
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
    await page
      .getByRole("button", { name: "Edit profile summary", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Profile summary", exact: true })
      .fill("Updated professional story.");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page
      .getByRole("button", { name: "Edit career profile", exact: true })
      .click();
    await page
      .getByLabel("Preferred locations", { exact: true })
      .fill("Paris, Remote");
    await page.getByLabel("Notice period (days)").fill("14");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByText("Your profile has been updated."),
    ).toBeVisible();
    const saved = await state(request);
    expect(saved.profile.headline).toBe("Principal Platform Engineer");
    expect(saved.profile.notice_period_days).toBe(14);
    expect(saved.profileDetails.details.professional_summary).toBe(
      "Updated professional story.",
    );
    expect(saved.profileDetails.details.employment).toEqual(
      profileV2Fixture.details.employment,
    );
    expect(saved.profileDetails.details.legacy_extension).toEqual({
      retain: "unchanged",
    });
    expect(saved.profileDetails.details.private_contact).toBe(true);
    expect(saved.profileDetails.current_salary_amount).toBe(1800000);
    const writes = (await recordedRequests(request)).filter(
      (r) => r.method === "PATCH",
    );
    expect(
      writes.filter((r) => r.path === "/api/v1/candidate/profile").length,
    ).toBe(3);
    await page.reload();
    await expect(page.getByText("Updated professional story.")).toBeVisible();
  });
  test("individual employment, skill and education editing preserves other items and normalizes months", async ({
    page,
    request,
  }) => {
    await request.post(`${MOCK_API}/__e2e/profile-fixture`, {
      data: profileV2Fixture,
    });
    await login(page, "candidate");
    await page.goto("/candidate/profile");
    await page
      .getByRole("button", { name: "Edit employment 1: Example Labs" })
      .click();
    await page.getByLabel("Job title", { exact: true }).fill("Staff Engineer");
    await expect(page.getByLabel("End date month")).toHaveCount(0);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Edit skill 1: Go" }).click();
    await page.getByLabel("Skill experience years").fill("1");
    await page.getByLabel("Skill experience months").fill("14");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page
      .getByRole("button", { name: "Edit education 1: Example University" })
      .click();
    await page.getByLabel("Score / grade (optional)").fill("8.8");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const saved = await state(request);
    expect(saved.profileDetails.details.employment[0]).toMatchObject({
      job_title: "Staff Engineer",
      end_month: null,
      end_year: null,
    });
    expect(saved.profileDetails.details.employment[1]).toEqual(
      profileV2Fixture.details.employment[1],
    );
    expect(saved.profileDetails.details.it_skills[0]).toMatchObject({
      experience_years: 2,
      experience_months: 2,
    });
    expect(saved.profileDetails.details.it_skills[1]).toEqual(
      profileV2Fixture.details.it_skills[1],
    );
    expect(saved.profileDetails.details.education[0].score).toBe("8.8");
    await page
      .getByRole("button", { name: "Edit skill 2: PostgreSQL" })
      .click();
    await page
      .getByRole("button", { name: "Remove skill", exact: true })
      .click();
    await expect(
      page.getByText("Remove this item from your profile?"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirm removal" }).click();
    await expect(
      page.getByRole("button", { name: "Edit skill 2: PostgreSQL" }),
    ).toHaveCount(0);
  });
  test("structured projects and links stay editable without dropping metadata", async ({
    page,
    request,
  }) => {
    await request.post(`${MOCK_API}/__e2e/profile-fixture`, {
      data: profileV2Fixture,
    });
    await login(page, "candidate");
    await page.goto("/candidate/profile");
    await page
      .getByRole("button", { name: "Edit existing achievements" })
      .click();
    await page
      .getByLabel("Project title", { exact: true })
      .fill("Improved workflow reliability");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Edit onlineProfiles 1" }).click();
    await page
      .getByLabel("Social profile", { exact: true })
      .fill("My portfolio");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: "Edit onlineProfiles 1",
        exact: true,
      }),
    ).toBeEnabled();
    const saved = await state(request);
    expect(saved.profileDetails.details.projects[0]).toMatchObject({
      title: "Improved workflow reliability",
      private_note: "Retain owner metadata",
    });
    expect(saved.profileDetails.details.professional_links[0]).toMatchObject({
      label: "My portfolio",
      private_note: "Retain owner metadata",
    });
  });
  test("field errors focus the first invalid field and preserve drafts after server failure", async ({
    page,
  }) => {
    await login(page, "candidate");
    await page.goto("/candidate/profile");
    await page
      .getByRole("button", { name: "Edit basic details", exact: true })
      .click();
    await page.getByLabel("Name", { exact: true }).fill("");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
    await page.getByLabel("Name", { exact: true }).fill("Draft retained");
    await page.route("**/api/v1/candidate/profile", async (route) => {
      if (route.request().method() === "PATCH")
        await route.fulfill({
          status: 400,
          json: {
            error: {
              code: "validation_failed",
              message: "Check fields.",
              fields: { current_city: "Server rejected this value." },
            },
          },
        });
      else await route.continue();
    });
    await page
      .getByLabel("Current location", { exact: true })
      .fill("Draft location");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "Server rejected this value.",
    );
    await expect(
      page.getByLabel("Current location", { exact: true }),
    ).toBeFocused();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Draft retained",
    );
    await expect(
      page.getByLabel("Current location", { exact: true }),
    ).toHaveValue("Draft location");
  });
  test("competing record changes block saving and preserve the candidate draft", async ({
    page,
    request,
  }) => {
    await request.post(`${MOCK_API}/__e2e/profile-fixture`, {
      data: profileV2Fixture,
    });
    await login(page, "candidate");
    await page.goto("/candidate/profile");
    await page.getByRole("button", { name: "Edit skill 1: Go" }).click();
    await page.getByLabel("Skill / competency").fill("Golang draft");
    await request.post(`${MOCK_API}/__e2e/profile-fixture`, {
      data: { details: { it_skills: [{ name: "Newer skill" }] } },
    });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.locator("#candidate-profile-edit-form [role=alert]"),
    ).toContainText("changed in another session");
    await expect(page.getByLabel("Skill / competency")).toHaveValue(
      "Golang draft",
    );
    expect((await state(request)).profileDetails.details.it_skills).toEqual([
      { name: "Newer skill" },
    ]);
  });
  test("dirty Cancel and Escape request discard without losing inputs", async ({
    page,
  }) => {
    await login(page, "candidate");
    await page.goto("/candidate/profile");
    await page
      .getByRole("button", { name: "Edit profile summary", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Profile summary", exact: true })
      .fill("Unsaved story");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByRole("button", { name: "Keep editing", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Profile summary", exact: true }),
    ).toHaveValue("Unsaved story");
    await page
      .getByRole("textbox", { name: "Profile summary", exact: true })
      .press("Escape");
    await expect(page).toHaveURL(/candidate\/profile/);
    await expect(page.getByText("Discard unsaved changes?")).toBeVisible();
    await page
      .getByRole("button", { name: "Discard changes", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Edit profile summary", exact: true }),
    ).toBeFocused();
  });
  test("visibility drawer traps focus, restores focus, saves independent consents and guards phone draft", async ({
    page,
    request,
  }) => {
    await login(page, "candidate");
    await page.goto("/candidate/profile");
    const opener = page
      .getByRole("button", {
        name: "Profile Visibility",
        exact: true,
      })
      .first();
    await opener.click();
    const drawer = page.getByRole("dialog", { name: "Profile Visibility" });
    const close = drawer.getByRole("button", {
      name: "Close Profile Visibility",
    });
    await expect(close).toBeFocused();
    await close.press("Shift+Tab");
    expect(
      await page.evaluate(
        () => document.activeElement?.closest("dialog") !== null,
      ),
    ).toBe(true);
    await drawer
      .getByRole("switch", { name: "Enable shareable profile link" })
      .check();
    await expect(
      drawer.getByText("Your shareable profile link is on."),
    ).toBeVisible();
    const discovery = drawer.getByRole("switch", {
      name: "Allow recruiter discovery and outreach",
    });
    await discovery.check();
    await expect(
      drawer.getByText(
        "Recruiter discovery and pre-application outreach are enabled.",
      ),
    ).toBeVisible();
    await discovery.uncheck();
    await expect(
      drawer.getByText(
        "Recruiter discovery and pre-application outreach are off.",
      ),
    ).toBeVisible();
    await drawer.getByLabel("Alternate phone (optional)").fill("+919812345678");
    await close.press("Escape");
    await expect(
      drawer.getByText("Discard unsaved phone settings?"),
    ).toBeVisible();
    await drawer.getByRole("button", { name: "Keep editing" }).click();
    await drawer.getByRole("button", { name: "Save phone settings" }).click();
    await expect(
      drawer.getByText("Contact sharing preference saved."),
    ).toBeVisible();
    await close.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(opener).toBeFocused();
    const saved = await state(request);
    expect(saved.profileDetails.details.profile_visible_in_sourcing).toBe(true);
    expect(saved.profileDetails.details.discoverable_to_recruiters).toBe(false);
    expect(saved.profileDetails.alternate_phone_e164).toBe("+919812345678");
  });
  test("private CV upload keeps signed upload flow and filename persistence", async ({
    page,
  }) => {
    await login(page, "candidate");
    await page.goto("/candidate/profile");
    const presign = page.waitForRequest(
      (r) =>
        r.url().endsWith("/api/v1/candidate/cv/presign") &&
        r.method() === "POST",
    );
    const upload = page.waitForRequest(
      (r) => r.url().endsWith("/__e2e/cv-upload") && r.method() === "PUT",
    );
    await page
      .locator('#section-resume input[type=file][accept*="pdf"]')
      .first()
      .setInputFiles({
        name: "Aarav-Candidate-CV.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 synthetic resume"),
      });
    expect((await presign).postDataJSON()).toEqual({
      filename: "Aarav-Candidate-CV.pdf",
      content_type: "application/pdf",
    });
    expect((await upload).headers()["x-amz-server-side-encryption"]).toBe(
      "AES256",
    );
    await expect(page.getByText("Resume uploaded securely.")).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Aarav-Candidate-CV.pdf", { exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Download resume" }),
    ).toBeEnabled();
  });
  test("System tracks live OS changes and explicit themes stay fixed", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await login(page, "candidate");
    await page.goto("/candidate/profile");
    await expect(page.locator("html")).not.toHaveClass(/swx-dark/);
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveClass(/swx-dark/);
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).not.toHaveClass(/swx-dark/);
    await page.getByLabel("Appearance: System", { exact: true }).click();
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveClass(/swx-dark/);
    await page.getByLabel("Appearance: Dark", { exact: true }).click();
    await page.getByRole("button", { name: "Light", exact: true }).click();
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).not.toHaveClass(/swx-dark/);
  });
});
