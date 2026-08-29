import { expect, test } from "@playwright/test";

const currentSession = {
  id: "session-current",
  deviceName: "Chrome on Windows",
  locationHint: "Current network",
  trustedDevice: true,
  current: true,
  createdAt: "2026-08-29T08:00:00Z",
  lastSeenAt: "2026-08-29T09:00:00Z",
  sessionExpiresAt: "2026-08-29T17:00:00Z",
  trustedUntil: "2026-09-28T09:00:00Z",
};

test("candidate settings manage sessions and generate phone-loss recovery codes", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("sapienworx.local-candidate-domain", "TECH"));
  await page.route("**/api/candidate/privacy", (route) => route.fulfill({ status: 200, json: { profileSearchable: true, automationConsent: false, outreachOptOut: false, dataExportRequestedAt: null, deletionRequestedAt: null, updatedAt: "2026-08-29T09:00:00Z" } }));
  await page.route("**/api/account/security/sessions", (route) => route.fulfill({ status: 200, json: [currentSession] }));
  await page.route("**/api/auth/csrf", (route) => route.fulfill({ status: 200, json: { token: "test-csrf", headerName: "X-XSRF-TOKEN" } }));
  await page.route("**/api/account/security/recovery-codes", (route) => {
    if (route.request().method() === "POST") return route.fulfill({ status: 200, json: { codes: ["SWX-ABCD-EFGH", "SWX-JKLM-NPQR"], remaining: 2 } });
    return route.fulfill({ status: 200, json: { remaining: 3 } });
  });

  await page.goto("/candidate/settings");
  await expect(page.getByRole("heading", { name: "Devices and sessions" })).toBeVisible();
  await expect(page.getByText("Current session", { exact: true })).toBeVisible();
  await expect(page.getByText("3 unused codes available.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Generate recovery codes" }).click();
  await expect(page.getByText("Save these now — they are shown only once")).toBeVisible();
  await expect(page.getByText("SWX-ABCD-EFGH")).toBeVisible();
});

test("recruiter settings show company review timing and device sessions", async ({ page }) => {
  await page.route("**/api/recruiter/workflow/account-settings", (route) => route.fulfill({ status: 200, json: {
    organisationId: "org-1", organisationName: "Sapienworx QA Organisation", currentUserRole: "ORG_ADMIN",
    planName: "GROWTH", recruiterSeatLimit: 10, seatsUsed: 3, monthlyJobCreditLimit: 20, jobsThisMonth: 4,
    invoiceStatus: "CURRENT", renewalAt: "2026-09-30T00:00:00Z", savedSearchAlertsEnabled: true,
    campaignsEnabled: true, accountReviewStatus: "PENDING", reviewDueAt: "2026-08-30T09:00:00Z", workEmailDomain: "sapienworx.qa",
  } }));
  await page.route("**/api/account/security/sessions", (route) => route.fulfill({ status: 200, json: [currentSession] }));

  await page.goto("/recruiter/settings");
  await expect(page.getByText(/pending review/i)).toBeVisible();
  await expect(page.getByText("The verified work-email domain is sapienworx.qa.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Devices and sessions" })).toBeVisible();
  await expect(page.getByText("Chrome on Windows", { exact: false })).toBeVisible();
});
