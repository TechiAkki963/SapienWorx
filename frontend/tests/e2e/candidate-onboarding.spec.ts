import { expect, test } from "@playwright/test";

import { login, MOCK_API, resetE2E } from "./helpers";

test.describe("candidate onboarding", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("gates every candidate workspace route until a choice, but leaves existing profiles alone", async ({ page, request }) => {
    await login(page, "candidate");
    await page.goto("/candidate/applications");
    await expect(page).toHaveURL(/\/candidate\/applications$/);
    await request.post(`${MOCK_API}/__e2e/onboarding`, { data: { status: "not_started" } });
    await page.goto("/candidate/applications");
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByRole("navigation", { name: "Candidate workspace" })).toHaveCount(0);
    await page.getByRole("button", { name: "Create My Profile" }).click();
    await expect(page).toHaveURL(/\/candidate\/onboarding$/);
    await page.goto("/candidate/applications");
    await expect(page).toHaveURL(/\/candidate\/applications$/);
    await page.goto("/welcome");
    await expect(page).toHaveURL(/\/candidate$/);
  });

  test("first login offers two paths and manual steps save one profile", async ({ page, request }) => {
    await login(page, "candidate");
    await request.post(`${MOCK_API}/__e2e/onboarding`, { data: { status: "not_started" } });
    await page.goto("/candidate");
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByRole("heading", { name: "Welcome, Aarav!" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upload My CV" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create Manually" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Candidate navigation" })).toHaveCount(0);

    await page.getByRole("button", { name: "Create My Profile" }).click();
    await expect(page).toHaveURL(/\/candidate\/onboarding$/);
    await expect(page.getByRole("navigation", { name: "Profile builder steps" })).toBeVisible();
    await page.getByLabel("Resume headline").fill("Platform Engineer");
    await page.getByLabel("Current city").fill("Pune");
    await page.getByRole("button", { name: "Save & continue" }).click();
    await expect(page.getByRole("heading", { name: "Work history" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Work history" })).toBeVisible();
    await page.getByLabel("Company name").fill("Example Labs");
    await page.getByLabel("Job title").fill("Platform Engineer");
    await page.getByRole("button", { name: "Save & continue" }).click();
    await expect(page.getByRole("heading", { name: "Academic details" })).toBeVisible();
    await page.getByLabel("Education level").fill("B.E. Computer Science");
    await page.getByLabel("University / institute").fill("Example University");
    await page.getByRole("button", { name: "Save & continue" }).click();
    await expect(page.getByRole("heading", { name: "Skills & competencies" })).toBeVisible();
    await page.getByLabel("Skill / competency").fill("Go");
    await page.getByRole("button", { name: "Save & continue" }).click();
    await expect(page.getByRole("heading", { name: "Work preferences" })).toBeVisible();
    await page.getByRole("button", { name: "Save & review" }).click();
    await expect(page).toHaveURL(/\/candidate$/);

    const details = await (await request.get(`${MOCK_API}/api/v1/candidate/profile/details`)).json();
    expect(details.details.onboarding_status).toBe("profile_ready");
    expect(details.details.employment[0].company).toBe("Example Labs");
    expect(details.details.education[0].university).toBe("Example University");
    expect(details.details.it_skills[0].name).toBe("Go");
    expect(details.details.discoverable_to_recruiters).not.toBe(true);
    expect(details.details.profile_visible_in_sourcing).not.toBe(true);
  });

  test("switches from manual entry to CV review without losing saved work", async ({ page, request }) => {
    await login(page, "candidate");
    await request.post(`${MOCK_API}/__e2e/onboarding`, { data: { status: "not_started" } });
    await page.goto("/welcome");
    await page.getByRole("button", { name: "Create My Profile" }).click();
    await page.getByLabel("Resume headline").fill("Platform Engineer");
    await page.getByLabel("Current city").fill("Pune");
    await page.getByRole("button", { name: "Save & continue" }).click();
    await expect(page.getByRole("heading", { name: "Work history" })).toBeVisible();

    await page.getByRole("button", { name: "Switch to CV" }).click();
    const preview = page.getByRole("region", { name: "Fill details from a CV" });
    await preview.getByRole("checkbox", { name: /I consent to processing/ }).check();
    await preview.locator('input[type="file"]').setInputFiles({
      name: "synthetic.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("synthetic fixture"),
    });
    await expect(preview.getByText("Review suggestions from DOCX")).toBeVisible();
    await expect.poll(async () => (await (await request.get(`${MOCK_API}/api/v1/candidate/profile/details`)).json()).details.onboarding_status).toBe("review_required");
    await page.getByRole("button", { name: "Switch to manual" }).click();
    await expect(page.getByLabel("Resume headline")).toHaveValue("Platform Engineer");
    await expect(page.getByLabel("Current city")).toHaveValue("Pune");
    const profile = await (await request.get(`${MOCK_API}/api/v1/candidate/profile`)).json();
    expect(profile.headline).toBe("Platform Engineer");
    expect(profile.current_city).toBe("Pune");
  });

  test("carries an intended job into first-time setup", async ({ page, request }) => {
    await request.post(`${MOCK_API}/__e2e/onboarding`, { data: { status: "not_started" } });
    const jobPath = "/jobs/60000000-0000-4000-8000-000000000001";
    await page.goto(`/login?next=${encodeURIComponent(jobPath)}`);
    await expect(page.getByRole("link", { name: "Create account" })).toHaveAttribute("href", `/signup?next=${encodeURIComponent(jobPath)}`);
    await page.getByLabel("Email").fill("candidate@example.com");
    await page.getByLabel("Password").fill("E2e-password-123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(new RegExp(`/welcome\\?next=.*60000000-0000-4000-8000-000000000001`));
    await page.getByRole("button", { name: "Create My Profile" }).click();
    await expect(page).toHaveURL(/\/candidate\/onboarding/);
    const details = await (await request.get(`${MOCK_API}/api/v1/candidate/profile/details`)).json();
    expect(details.details.onboarding_return_to).toBe(jobPath);
    await page.getByRole("button", { name: /Continue to dashboard for now/ }).click();
    await expect(page).toHaveURL(/\/candidate$/);
    await page.goto("/candidate/onboarding");
    await expect(page.getByRole("heading", { name: "Build your professional profile" })).toBeVisible();
  });

  test("a failed CV preview offers a manual escape without trapping the candidate", async ({ page, request }) => {
    await login(page, "candidate");
    await request.post(`${MOCK_API}/__e2e/onboarding`, { data: { status: "not_started" } });
    await request.post(`${MOCK_API}/__e2e/cv-failure`, { data: { enabled: true } });
    await page.goto("/welcome");
    await page.getByRole("button", { name: "Continue with CV" }).click();
    const preview = page.getByRole("region", { name: "Fill details from a CV" });
    await preview.getByRole("checkbox", { name: /I consent to processing/ }).check();
    await preview.locator('input[type="file"]').setInputFiles({ name: "unreadable.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 unreadable") });
    await expect(preview.getByText(/couldn't prepare a preview/)).toBeVisible();
    await page.getByRole("button", { name: /CV not working\? Continue manually/ }).click();
    await expect(page.getByRole("heading", { name: "About you" })).toBeVisible();
    await page.goto("/candidate");
    await expect(page).toHaveURL(/\/candidate$/);
  });
});
