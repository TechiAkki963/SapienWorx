import { expect, test } from "@playwright/test";

const jobFeed = {
  content: [
    {
      jobId: "SWX-100",
      title: "Senior Backend Engineer",
      organisationName: "Nexora Cloud",
      location: "Bengaluru · Hybrid",
      department: "Engineering",
      minimumExperienceYears: 4,
      maximumExperienceYears: 7,
      minimumSalaryLakhs: 18,
      maximumSalaryLakhs: 28,
      salaryVisible: true,
      descriptionHtml: "<p>Build dependable services for a product used by recruiters.</p>",
      skills: ["TypeScript", "Node.js", "PostgreSQL"],
      publishedAt: new Date().toISOString(),
      publicPath: "/jobs/SWX-100/senior-backend-engineer",
    },
    {
      jobId: "SWX-101",
      title: "Product Designer",
      organisationName: "Morrow",
      location: "Mumbai",
      department: "Design",
      minimumExperienceYears: 3,
      maximumExperienceYears: 6,
      minimumSalaryLakhs: 14,
      maximumSalaryLakhs: 22,
      salaryVisible: true,
      descriptionHtml: "<p>Design simple and useful customer journeys.</p>",
      skills: ["Figma", "Research"],
      publishedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      publicPath: "/jobs/SWX-101/product-designer",
    },
  ],
};

test("candidate can search, save and apply for roles", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("sapienworx.local-candidate-domain", "TECH");
    Object.defineProperty(navigator, "share", { configurable: true, value: async () => undefined });
  });
  await page.route("**/api/public/jobs", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(jobFeed) }));
  await page.route("**/api/candidate/jobs/SWX-100/applications", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));

  await page.goto("/candidate/jobs");

  await expect(page.getByRole("heading", { name: "Discover your next role" })).toBeVisible();
  await expect(page.getByLabel("Job title, skill or company")).toBeVisible();
  await expect(page.getByText("Senior Backend Engineer", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Share Senior Backend Engineer" }).click();
  await expect(page.getByText("The share sheet opened for Senior Backend Engineer.")).toBeVisible();

  await page.getByRole("button", { name: "Save Senior Backend Engineer" }).click();
  await expect(page.getByRole("tab", { name: "Saved (1)" })).toBeVisible();
  await page.getByRole("tab", { name: "Saved (1)" }).click();
  await expect(page.getByText("Senior Backend Engineer", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "View details" }).click();
  await expect(page.getByText("Read full job description →")).toBeVisible();
  await page.getByRole("button", { name: "Quick apply" }).click();
  await expect(page.getByText("Your application for Senior Backend Engineer at Nexora Cloud has been sent.")).toBeVisible();
  await expect(page.getByText("Applied", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "For you" }).click();
  await page.getByLabel("Job title, skill or company").fill("not a real role");
  await expect(page.getByText("No roles match those filters.")).toBeVisible();
});

test("a shared job keeps its application intent through registration", async ({ page }) => {
  await page.goto("/register?job=SWX-100");

  await expect(page.getByRole("heading", { name: "Create an account to apply" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?job=SWX-100");
});
