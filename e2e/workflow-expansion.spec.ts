import { expect, test } from "@playwright/test";

test("recruiter workspace exposes first-class sourcing, pipeline and interview journeys", async ({ page }) => {
  await page.goto("/recruiter/workbench");
  await expect(page.getByRole("heading", { name: "Recruitment workspace" })).toBeVisible();

  const sidebar = page.locator(".sidebar");
  await expect(sidebar.getByRole("link", { name: "Sourcing", exact: true })).toHaveAttribute("href", "/recruiter/sourcing");
  await expect(sidebar.getByRole("link", { name: "Pipeline", exact: true })).toHaveAttribute("href", "/recruiter/pipeline");
  await expect(sidebar.getByRole("link", { name: "Interviews", exact: true })).toHaveAttribute("href", "/recruiter/interviews");
  await expect(sidebar.getByRole("link", { name: "Messages", exact: true })).toHaveAttribute("href", "/recruiter/communications");
});

test("recruiter interviews use an external meeting link without provider creation controls", async ({ page }) => {
  const applicationId = "2fbd4be4-1bf2-4a1d-918d-500000000001";
  await page.goto(`/recruiter/interviews?application=${applicationId}`);

  await expect(page.getByRole("heading", { name: "Interviews" })).toBeVisible();
  await expect(page.getByLabel("Application ID")).toHaveValue(applicationId);
  await expect(page.getByLabel("External meeting URL")).toBeVisible();
  await expect(page.getByText("It does not create or control the external meeting.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Schedule Interview" })).toBeVisible();
  await expect(page.getByLabel("Interview format")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Google Meet|Microsoft Teams|Zoom/ })).toHaveCount(0);
});

test("candidate applications and privacy settings remain first-class journeys", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sapienworx.local-candidate-domain", "TECH"));
  await page.goto("/candidate/applications");
  await expect(page.getByRole("heading", { name: "My applications" })).toBeVisible();
  await expect(page.locator(".candidate-desktop-nav").getByRole("link", { name: "Interviews", exact: true })).toHaveAttribute("href", "/candidate/interviews");

  await page.goto("/candidate/settings");
  await expect(page.getByRole("heading", { name: "Settings and privacy" })).toBeVisible();
});
