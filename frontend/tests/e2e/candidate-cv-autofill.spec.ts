import { expect, test } from "@playwright/test";

import { login, recordedRequests, resetE2E } from "./helpers";

test.describe("candidate CV review", () => {
  test.beforeEach(async ({ request }) => resetE2E(request));

  test("saves reviewed work, education, skills and links without replacing existing identity", async ({ page, request }) => {
    await login(page, "candidate");
    await page.goto("/candidate/profile");
    await page.getByText("Suggest profile updates from a CV").click();

    const preview = page.getByRole("region", { name: "Fill details from a CV" });
    await expect(preview).toBeVisible();
    await preview.getByRole("checkbox", { name: /I consent to processing/ }).check();
    await preview.locator('input[type="file"]').setInputFiles({
      name: "synthetic.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("synthetic fixture"),
    });
    await expect(preview.getByText("Review suggestions from DOCX")).toBeVisible();

    const nameChoice = preview.locator("label").filter({ hasText: "Full name" }).getByRole("checkbox");
    await expect(nameChoice).not.toBeChecked();
    await expect(preview.getByText("Example Labs")).toBeVisible();
    await expect(preview.getByText("Example University")).toBeVisible();

    // The preview must not race with unsaved edits in the full editor.
    await page.getByRole("button", { name: "Edit profile" }).click();
    await expect(preview.getByRole("button", { name: "Apply selected details" })).toBeDisabled();
    await preview.getByRole("button", { name: "Save editor & enable CV apply" }).click();
    await expect(page.getByRole("button", { name: "Edit profile" })).toBeVisible();
    await expect(preview.getByRole("button", { name: "Apply selected details" })).toBeEnabled();
    await preview.getByRole("button", { name: "Apply selected details" }).click();

    await expect(preview.getByText(/Selected details saved/)).toBeVisible();
    await expect(page.getByText("Builds reliable hiring tools.")).toBeVisible();
    await expect(page.getByText("Example Labs")).toBeVisible();
    await expect(page.getByText("Example University")).toBeVisible();
    await expect(page.getByRole("link", { name: "github.com/example" })).toBeVisible();

    const writes = (await recordedRequests(request)).filter(item => item.method === "PATCH");
    const detailsWrite = writes.filter(item => item.path === "/api/v1/candidate/profile/details").at(-1);
    expect(detailsWrite?.body).toMatchObject({ details: {
      employment: [{ company: "Example Labs", job_title: "Platform Engineer", joining_year: "2022", joining_month: "Jan", current_company: "Yes" }],
      education: [{ level: "B.E. Computer Science", university: "Example University", end_year: "2020" }],
      it_skills: [{ name: "Go" }],
      professional_links: "https://github.com/example",
    } });

    await page.reload();
    await expect(page.getByText("Example Labs")).toBeVisible();
    await expect(page.getByText("Example University")).toBeVisible();
    await expect(page.getByText("Builds reliable hiring tools.")).toBeVisible();
    await expect(page.getByText("Aarav Candidate")).toBeVisible();
  });
});
