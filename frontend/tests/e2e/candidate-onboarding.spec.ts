import { expect, test } from "@playwright/test";
import { login, MOCK_API, resetE2E } from "./helpers";
test.describe("four-step profile onboarding", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));
  test("new candidate finishes the four manual stages and returns to editable profile", async ({
    page,
    request,
  }) => {
    await login(page, "candidate");
    await request.post(`${MOCK_API}/__e2e/onboarding`, {
      data: { status: "not_started" },
    });
    await page.goto("/candidate");
    await expect(page).toHaveURL(/welcome$/);
    await page.getByRole("button", { name: "Create My Profile" }).click();
    await expect(
      page.getByRole("navigation", { name: "Profile builder steps" }),
    ).toContainText("Skills & Education");
    await page.getByLabel("Professional headline").fill("Platform Engineer");
    await page.getByLabel("Current city", { exact: true }).fill("Pune");
    await page
      .getByRole("button", { name: "Save section", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Experience", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Experience", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Add employment", exact: true })
      .click();
    await page.getByLabel("Company name").fill("Example Labs");
    await page
      .getByLabel("Job title", { exact: true })
      .fill("Platform Engineer");
    await page.getByLabel("I currently work here").check();
    await page.getByLabel("Start date month").selectOption("Jan");
    await page.getByLabel("Start date year").selectOption("2022");
    await page.getByRole("button", { name: "Save item", exact: true }).click();
    await page
      .getByRole("button", { name: "Save & continue", exact: true })
      .click();
    await page.getByRole("button", { name: "Add skill", exact: true }).click();
    await page.getByLabel("Skill / competency").fill("Go");
    await page.getByRole("button", { name: "Save item", exact: true }).click();
    await page
      .getByRole("button", { name: "Add education", exact: true })
      .click();
    await page.getByLabel("Education level").fill("B.E. Computer Science");
    await page.getByLabel("University / institute").fill("Example University");
    await page.getByRole("button", { name: "Save item", exact: true }).click();
    await page
      .getByRole("button", { name: "Save & continue", exact: true })
      .click();
    await page
      .getByLabel("Preferred locations", { exact: true })
      .fill("Pune, Remote");
    await page
      .getByRole("button", { name: "Save section", exact: true })
      .click();
    await expect(page).toHaveURL(/candidate\/profile$/);
    const result = await (await request.get(`${MOCK_API}/__e2e/state`)).json();
    expect(result.profileDetails.details).toMatchObject({
      onboarding_status: "profile_ready",
      onboarding_step: 4,
    });
    expect(result.profileDetails.details.it_skills[0].name).toBe("Go");
    expect(result.profileDetails.details.discoverable_to_recruiters).not.toBe(
      true,
    );
  });
  test("CV switching respects the processing gate; enabled failures preserve saved data", async ({
    page,
    request,
  }) => {
    await login(page, "candidate");
    await request.post(`${MOCK_API}/__e2e/onboarding`, {
      data: { status: "not_started" },
    });
    await page.goto("/welcome");
    await page.getByRole("button", { name: "Create My Profile" }).click();
    await page.getByLabel("Professional headline").fill("Platform Engineer");
    await page.getByLabel("Current city", { exact: true }).fill("Pune");
    await page
      .getByRole("button", { name: "Save section", exact: true })
      .click();
    if (!(await page.getByRole("button", { name: "Switch to CV" }).count())) {
      await expect(
        page.getByRole("heading", { name: "Experience", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Fill details from a CV" }),
      ).toHaveCount(0);
      const result = await (
        await request.get(`${MOCK_API}/__e2e/state`)
      ).json();
      expect(result.profile.headline).toBe("Platform Engineer");
      expect(result.profile.current_city).toBe("Pune");
      return;
    }
    await page.getByRole("button", { name: "Switch to CV" }).click();
    await request.post(`${MOCK_API}/__e2e/cv-failure`, {
      data: { enabled: true },
    });
    const region = page.getByRole("region", { name: "Fill details from a CV" });
    await region.getByRole("checkbox", { name: /I consent/ }).check();
    await region.locator("input[type=file]").setInputFiles({
      name: "unreadable.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF synthetic"),
    });
    await expect(region.getByText(/couldn't prepare a preview/)).toBeVisible();
    await page
      .getByRole("button", { name: /CV not working\? Continue manually/ })
      .click();
    await expect(
      page.getByRole("heading", { name: "Experience", exact: true }),
    ).toBeVisible();
    const result = await (await request.get(`${MOCK_API}/__e2e/state`)).json();
    expect(result.profile.headline).toBe("Platform Engineer");
    expect(result.profile.current_city).toBe("Pune");
  });
  test("intended job remains stored and first-login workspace is gated", async ({
    page,
    request,
  }) => {
    await request.post(`${MOCK_API}/__e2e/onboarding`, {
      data: { status: "not_started" },
    });
    const next = "/jobs/60000000-0000-4000-8000-000000000001";
    await page.goto(`/login?next=${encodeURIComponent(next)}`);
    await page
      .getByLabel("Email", { exact: true })
      .fill("candidate@example.com");
    await page
      .getByLabel("Password", { exact: true })
      .fill("E2e-password-123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/welcome\?next=/);
    await page.getByRole("button", { name: "Create My Profile" }).click();
    const result = await (await request.get(`${MOCK_API}/__e2e/state`)).json();
    expect(result.profileDetails.details.onboarding_return_to).toBe(next);
  });
});
