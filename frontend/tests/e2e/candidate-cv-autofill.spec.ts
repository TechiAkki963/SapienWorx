import { expect, test } from "@playwright/test";
import { login, MOCK_API, resetE2E } from "./helpers";
test.describe("reviewed CV suggestions", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));
  test("preview alone never writes; reviewed dated employment and education append without replacing identity", async ({
    page,
    request,
  }) => {
    await login(page, "candidate");
    await page.goto("/candidate/profile");
    await page
      .getByText("Suggest profile updates from a CV", { exact: true })
      .click();
    const preview = page.getByRole("region", {
      name: "Fill details from a CV",
    });
    await preview.getByRole("checkbox", { name: /I consent/ }).check();
    await preview.locator("input[type=file]").setInputFiles({
      name: "synthetic.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("synthetic fixture"),
    });
    await expect(
      preview.getByText("Review suggestions from DOCX"),
    ).toBeVisible();
    await expect(preview.getByLabel("Company name")).toHaveValue(
      "Example Labs",
    );
    const before = await (await request.get(`${MOCK_API}/__e2e/state`)).json();
    expect(before.profileDetails.details.employment).toBeUndefined();
    await page
      .getByRole("button", { name: "Edit basic details", exact: true })
      .click();
    await expect(
      page.locator("button").filter({ hasText: /^Apply selected details$/ }),
    ).toBeDisabled();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(
      preview.getByRole("button", { name: "Apply selected details" }),
    ).toBeEnabled();
    await preview
      .getByRole("button", { name: "Apply selected details" })
      .click();
    await expect(preview.getByText(/Selected details saved/)).toBeVisible();
    const after = await (await request.get(`${MOCK_API}/__e2e/state`)).json();
    expect(after.profile.full_name).toBe("Aarav Candidate");
    expect(after.profile.email).toBe("candidate@example.com");
    expect(after.profileDetails.details.employment[0]).toMatchObject({
      company: "Example Labs",
      job_title: "Platform Engineer",
      joining_month: "Jan",
      joining_year: "2022",
      current_company: "Yes",
    });
    expect(after.profileDetails.details.education[0].university).toBe(
      "Example University",
    );
    expect(after.profileDetails.details.it_skills[0].name).toBe("Go");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Edit employment 1: Example Labs" }),
    ).toBeVisible();
  });
  test("missing parsed dates require review and do not partially write", async ({
    page,
  }) => {
    await login(page, "candidate");
    await page.goto("/candidate/profile");
    await page
      .getByText("Suggest profile updates from a CV", { exact: true })
      .click();
    const preview = page.getByRole("region", {
      name: "Fill details from a CV",
    });
    await preview.getByRole("checkbox", { name: /I consent/ }).check();
    await preview.locator("input[type=file]").setInputFiles({
      name: "synthetic.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("synthetic"),
    });
    await expect(preview.getByLabel("Start date month")).toHaveValue("Jan");
    await preview.getByLabel("Start date month").selectOption("");
    await preview
      .getByRole("button", { name: "Apply selected details" })
      .click();
    await expect(preview.getByText(/confirm missing dates/)).toBeVisible();
    await expect(preview.getByLabel("Company name")).toHaveValue(
      "Example Labs",
    );
  });
});
