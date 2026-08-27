import { expect, test } from "@playwright/test";

const applications = {
  content: [
    {
      applicationId: "2fbd4be4-1bf2-4a1d-918d-500000000001",
      jobId: "SWX-100",
      title: "Senior Backend Engineer",
      companyName: "Nexora Cloud",
      location: "Bengaluru · Hybrid",
      recruiterName: "Jaya Rao",
      recruiterTitle: "Talent Partner",
      stage: "INTERVIEWING",
      appliedAt: "2026-08-22T09:00:00Z",
      updatedAt: "2026-08-27T08:00:00Z",
    },
    {
      applicationId: "2fbd4be4-1bf2-4a1d-918d-500000000002",
      jobId: "SWX-101",
      title: "Product Designer",
      companyName: "Morrow Health",
      location: "Mumbai",
      recruiterName: "Kartik Iyer",
      recruiterTitle: "Director, Talent",
      stage: "SCREENING",
      appliedAt: "2026-08-20T09:00:00Z",
      updatedAt: "2026-08-26T08:00:00Z",
    },
    {
      applicationId: "2fbd4be4-1bf2-4a1d-918d-500000000003",
      jobId: "SWX-102",
      title: "Growth Marketing Lead",
      companyName: "Tandem Studio",
      location: "Remote",
      recruiterName: "Neha Sharma",
      recruiterTitle: "Hiring Manager",
      stage: "OFFER",
      appliedAt: "2026-08-18T09:00:00Z",
      updatedAt: "2026-08-27T07:00:00Z",
    },
  ],
  totalPages: 1,
  totalElements: 3,
  number: 0,
  first: true,
  last: true,
};

const summary = { totalApplications: 3, activeApplications: 2, interviewApplications: 1, offerApplications: 1 };

test("candidate can track and filter applications by the recruiter-owned stage", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sapienworx.local-candidate-domain", "TECH"));
  await page.route("**/api/candidate/applications**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(route.request().url().includes("/summary") ? summary : applications) }));

  await page.goto("/candidate/applications");

  await expect(page.getByRole("heading", { name: "My applications" })).toBeVisible();
  await expect(page.getByText("Senior Backend Engineer", { exact: true })).toBeVisible();
  await expect(page.getByText("Jaya Rao · Talent Partner", { exact: true })).toBeVisible();
  await expect(page.getByText("3", { exact: true }).first()).toBeVisible();

  await page.getByRole("tab", { name: "Interviews" }).click();
  await expect(page.getByText("Senior Backend Engineer", { exact: true })).toBeVisible();
  await expect(page.getByText("Product Designer", { exact: true })).not.toBeVisible();

  await page.getByRole("tab", { name: "All applications" }).click();
  await page.getByLabel("Search applications").fill("Morrow");
  await expect(page.getByText("Product Designer", { exact: true })).toBeVisible();
  await expect(page.getByText("Senior Backend Engineer", { exact: true })).not.toBeVisible();
  await expect(page.getByRole("link", { name: "View job" })).toHaveAttribute("href", "/jobs/SWX-101/product-designer");
});
