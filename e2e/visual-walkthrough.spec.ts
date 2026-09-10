import { expect, test, type Page } from "@playwright/test";

const routes = [
  ["public-home", "/"],
  ["public-jobs", "/jobs"],
  ["public-companies", "/companies"],
  ["public-knowledge", "/knowledge"],
  ["candidate-login", "/login"],
  ["candidate-register", "/register"],
  ["candidate-home", "/candidate"],
  ["candidate-jobs", "/candidate/jobs"],
  ["candidate-applications", "/candidate/applications"],
  ["candidate-interviews", "/candidate/interviews"],
  ["candidate-messages", "/candidate/messages"],
  ["candidate-profile", "/candidate/profile"],
  ["candidate-notifications", "/candidate/notifications"],
  ["candidate-settings", "/candidate/settings"],
  ["candidate-reports", "/candidate/reports"],
  ["recruiter-login", "/recruiter/login"],
  ["recruiter-register", "/recruiter/register"],
  ["recruiter-home", "/recruiter"],
  ["recruiter-jobs", "/recruiter/jobs"],
  ["recruiter-manage-jobs", "/recruiter/jobs/manage"],
  ["recruiter-candidates", "/recruiter/candidates"],
  ["recruiter-sourcing", "/recruiter/sourcing"],
  ["recruiter-search-results", "/search/results?anyKeywords=Java&location=Mumbai"],
  ["recruiter-pipeline", "/recruiter/pipeline"],
  ["recruiter-interviews", "/recruiter/interviews"],
  ["recruiter-messages", "/recruiter/communications"],
  ["recruiter-workbench", "/recruiter/workbench"],
  ["recruiter-reports", "/recruiter/reports"],
  ["recruiter-settings", "/recruiter/settings"],
  ["admin-login", "/admin/login"],
  ["admin-control-centre", "/admin"],
  ["privacy", "/privacy"],
  ["terms", "/terms"],
  ["cookies", "/cookies"],
] as const;

async function prepare(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("sapienworx.local-candidate-domain", "TECH");
    window.localStorage.setItem("sapienworx.recruiter.sidebar", "expanded");
  });
}

for (const [name, route] of routes) {
  test(`walkthrough ${name}`, async ({ page }, testInfo) => {
    await prepare(page);
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(450);
    expect(response?.status() ?? 200, `${route} should render without an HTTP server error`).toBeLessThan(500);
    await expect(page.locator("body")).not.toContainText(/Application error|Internal Server Error|This page could not be found/i);
    await page.screenshot({
      path: `artifacts/walkthrough/${testInfo.project.name}/${name}.png`,
      fullPage: true,
    });
  });
}
