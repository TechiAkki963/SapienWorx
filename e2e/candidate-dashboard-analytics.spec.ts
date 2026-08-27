import { expect, test } from "@playwright/test";

const analytics = {
  profile: { fullName: "Asha Raman", headline: "Platform engineer", domainCategory: "TECH", profileSearchable: true, profileLastUpdatedAt: "2026-08-27T08:00:00Z", lastActiveAt: "2026-08-27T09:00:00Z" },
  performance: { rangeDays: 7, profileAppearances: 32, recruiterActions: 41, profileViews: 32, resumeDownloads: 9, profileAppearancesInRange: 8, recruiterActionsInRange: 11, appearanceChangePercent: 60, actionChangePercent: 83, profileCompleteness: 90, activityLevel: "HIGH" },
  recruiterActivity: [
    { recruiterName: "Neha Sharma", recruiterTitle: "Talent Partner", organisationName: "Tyro Ventures", action: "PROFILE_VIEWED", occurredAt: "2026-08-27T09:30:00Z" },
    { recruiterName: "Kartik Iyer", recruiterTitle: "Director, Talent", organisationName: "Integrated Personnel Services", action: "RESUME_DOWNLOADED", occurredAt: "2026-08-27T08:30:00Z" },
  ],
  applications: [{ applicationId: "application-1", title: "Senior Backend Engineer", companyName: "Nexora", stage: "INTERVIEW", updatedAt: "2026-08-27T08:00:00Z" }],
};

test("shows private recruiter engagement analytics and refreshes the selected period", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sapienworx.local-candidate-domain", "TECH"));
  await page.route("**/api/candidate/dashboard?rangeDays=7", (route) => route.fulfill({ status: 200, json: analytics }));
  await page.goto("/candidate");

  await expect(page.getByRole("heading", { name: "Profile performance" }).first()).toBeVisible();
  await expect(page.getByText("Profile appearances", { exact: true })).toBeVisible();
  await expect(page.getByText("Recruiter actions", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Activity level", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Profile completeness 82%" })).toBeVisible();

  await page.getByLabel("Analytics period").selectOption("7");
  await expect(page.getByText("8 profile appearances in the last 7 days")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Profile completeness 90%" })).toBeVisible();
  await page.getByRole("button", { name: "CV downloaded (9)" }).click();
  await expect(page.getByText("Kartik Iyer")).toBeVisible();
  await expect(page.getByText("Neha Sharma")).toHaveCount(0);
});
