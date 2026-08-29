import { expect, test, type Page } from "@playwright/test";

const users = Array.from({ length: 12 }, (_, index) => ({
  id: `00000000-0000-0000-0000-0000000000${String(index + 1).padStart(2, "0")}`,
  type: index % 2 ? "RECRUITER" : "CANDIDATE",
  name: index === 0 ? "Taylor Tech" : `QA User ${index + 1}`,
  email: index === 0 ? "candidate.tech@sapienworx.qa" : `user${index + 1}@sapienworx.qa`,
  organisation: index % 2 ? "Sapienworx QA" : "Independent candidate",
  status: "ACTIVE",
  verified: true,
  suspended: false,
  passwordResetRequired: false,
  reason: "",
}));

const governance = {
  currentAdmin: { id: "10000000-0000-0000-0000-000000000001", displayName: "Sapienworx Master Admin", email: "master.admin@sapienworx.qa", role: "OWNER", permissions: ["PLATFORM_CONTROL", "SECURITY_POLICY"], active: true, lastSignedInAt: "2026-08-29T09:00:00Z" },
  admins: [{ id: "10000000-0000-0000-0000-000000000001", displayName: "Sapienworx Master Admin", email: "master.admin@sapienworx.qa", role: "OWNER", permissions: ["PLATFORM_CONTROL", "SECURITY_POLICY"], active: true, lastSignedInAt: "2026-08-29T09:00:00Z" }],
  approvals: [],
  alerts: [{ key: "queue-blocked-auth", severity: "CRITICAL", title: "Queue has no active worker", description: "12 messages are waiting with no worker available.", source: "RabbitMQ", status: "OPEN", note: "", updatedAt: "" }],
  securityPolicy: { adminMfaRequired: true, suspiciousLoginDetectionEnabled: true, ipAllowlistEnabled: false, allowedIpRanges: "", minimumPasswordLength: 12, sessionDurationMinutes: 480, maximumFailedAttempts: 5, supportAccessRequiresConsent: true, updatedAt: "2026-08-29T09:00:00Z" },
  moderationCases: [], featureFlags: [], integrations: [], billingPlans: [], supportAccess: [],
  business: { candidates: 16, recruiters: 22, organisations: 11, activeJobs: 6, applications: 2, offers: 1, onboarded: 0, candidateActivationRate: 100, recruiterActivationRate: 100, applicationToOfferRate: 50, offerToOnboardRate: 0, outreachDelivered: 0, outreachReplyRate: 0 },
};

const activityInvestigation = {
  investigation: { id: "investigation-1", purpose: "SECURITY", reason: "SEC-1842 repeated access complaint", openedAt: new Date().toISOString(), accessExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), rangeDays: 90 },
  subject: { id: users[0].id, type: "CANDIDATE", name: "Taylor Tech", maskedEmail: "c••••@sapienworx.qa", organisation: "Independent candidate", status: "PROFILE_COMPLETED", verified: true, lastActiveAt: "2026-08-29T08:58:00Z" },
  summary: { events: 2, elevatedSignals: 1, activeSessions: 1, applications: 3, lastSeenAt: "2026-08-29T08:58:00Z", categoryCounts: { AUTHENTICATION: 1, PROFILE: 1 } },
  sessions: [{ id: "session-1", deviceName: "Chrome on Windows", locationHint: "Current network", trusted: true, active: true, createdAt: "2026-08-28T08:00:00Z", lastSeenAt: "2026-08-29T08:58:00Z", expiresAt: "2026-08-29T17:00:00Z" }],
  events: [
    { id: "activity-1", action: "ACCOUNT_SIGNED_IN", label: "Signed in successfully", description: "Authentication metadata was recorded without storing credentials or OTP values.", category: "AUTHENTICATION", risk: "MEDIUM", occurredAt: "2026-08-29T08:58:00Z", actor: "Taylor Tech", actorRelationship: "Account owner", resourceType: "ACCOUNT", jobId: "" },
    { id: "activity-2", action: "CANDIDATE_PROFILE_DOWNLOADED", label: "Candidate CV downloaded by a recruiter", description: "Profile metadata changed or was accessed; CV contents and contact values remain hidden.", category: "PROFILE", risk: "HIGH", occurredAt: "2026-08-29T08:30:00Z", actor: "Alex Recruiter", actorRelationship: "Recruiter", resourceType: "CANDIDATE", jobId: "SWX-QA-1" },
  ],
  privacyNotice: "Operational metadata only. OTPs, passwords, message bodies, CV contents, contact values and raw search text are never included.",
};

async function stubMasterAdmin(page: Page) {
  const payloads: Record<string, unknown> = {
    // Intentionally uses the pre-hardening dashboard shape to prove cached/rolling-upgrade responses cannot crash the console.
    "/api/admin/master/dashboard": { candidates: 16, recruiters: 22, organisations: 11, jobs: 6, auditEvents: 5, activeJobs: 6, openSupportTickets: 1, privacyRequests: 0, deadLetters: 0 },
    "/api/admin/master/controls": { maintenanceMode: false, candidateSignupEnabled: true, recruiterSignupEnabled: true, cvParsingEnabled: true, campaignsEnabled: true, updatedAt: "2026-08-29T09:00:00Z", updatedBy: "10000000-0000-0000-0000-000000000001", lastChangeReason: "INC-42 recovery complete" },
    "/api/admin/master/users": users,
    "/api/admin/master/organisations": [{ id: "20000000-0000-0000-0000-000000000001", name: "Sapienworx QA", workEmailDomain: "sapienworx.qa", recruiters: 6, pendingRecruiterReviews: 1, activeJobs: 2, suspended: false, postingLimit: 10, reason: "" }],
    "/api/admin/master/jobs": [{ id: "30000000-0000-0000-0000-000000000001", publicJobId: "SWX-QA-1", title: "Backend Engineer", organisation: "Sapienworx QA", accountableRecruiter: "Alex Recruiter", status: "ACTIVE", applicants: 2, updatedAt: "2026-08-29T09:00:00Z" }],
    "/api/admin/master/queues": [{ label: "Email OTP delivery", name: "auth.otp.email.queue", group: "AUTH", messages: 12, consumers: 0, available: true, health: "BLOCKED", healthSummary: "12 messages are waiting with no worker available to process them.", requiresAttention: true }, { label: "CV parsing DLQ", name: "cv.parser.dlq", group: "DEAD_LETTER", messages: 0, consumers: 0, available: true, health: "HEALTHY", healthSummary: "No failed messages are waiting.", requiresAttention: false }],
    "/api/admin/master/activity": [{ id: "event-1", action: "MASTER_PLATFORM_CONTROLS_UPDATED", resourceType: "PLATFORM", resourceId: "", jobId: "", occurredAt: "2026-08-29T09:00:00Z", actorId: "10000000-0000-0000-0000-000000000001", actor: "Sapienworx Master Admin" }],
    "/api/admin/master/support-tickets": [{ id: "ticket-1", subjectType: "ORGANISATION", subjectLabel: "Sapienworx QA", summary: "Email delivery investigation", priority: "HIGH", status: "OPEN", ownerAdminId: "", owner: "Unassigned", createdAt: "2026-08-29T08:00:00Z", dueAt: "2026-08-29T20:00:00Z", updatedAt: "2026-08-29T08:00:00Z", resolvedAt: "" }],
    "/api/admin/master/privacy-cases": [],
    "/api/admin/master/data-quality": { incompleteCandidateProfiles: 2, staleActiveJobs: 0, jobsWithoutAccountableRecruiter: 0, duplicateAccounts: 0 },
    "/api/admin/master/security": { masterOtpRequired: true, masterPasswordRequired: true, suspendedSubjects: 0, passwordResetRequired: 0, sessionRevocationControls: 0, adminEndpointPolicy: "SUPER_ADMIN only" },
    "/api/admin/governance": governance,
  };
  await page.route("**/api/admin/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") return route.fulfill({ status: 200, json: {} });
    const payload = payloads[path];
    return payload === undefined ? route.fulfill({ status: 404, json: { message: "Not stubbed" } }) : route.fulfill({ status: 200, json: payload });
  });
  await page.route("**/api/account/security/sessions", (route) => route.fulfill({ status: 200, json: [{ id: "session-1", deviceName: "Chrome on Windows", locationHint: "Current network", trustedDevice: false, current: true, createdAt: "2026-08-29T08:00:00Z", lastSeenAt: "2026-08-29T09:00:00Z", sessionExpiresAt: "2026-08-29T17:00:00Z", trustedUntil: null }] }));
  await page.route("**/api/auth/csrf", (route) => route.fulfill({ status: 200, json: { token: "master-admin-e2e-csrf", headerName: "X-XSRF-TOKEN" } }));
}

test.beforeEach(async ({ page }) => {
  await stubMasterAdmin(page);
  await page.goto("/admin");
});

test("overview reports blocked workers truthfully without duplicate tab navigation", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Immediate operational attention is required" })).toBeVisible();
  await expect(page.getByText("1 blocked or unavailable", { exact: false })).toBeVisible();
  await expect(page.getByText("Readiness includes worker coverage", { exact: false })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Master Access sections" })).toHaveCount(0);
});

test("notifications, settings, help, and global search are functional", async ({ page }) => {
  await page.getByRole("link", { name: "Notifications" }).click();
  await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
  await expect(page.getByText("Queue has no active worker", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Devices and sessions" })).toBeVisible();
  await expect(page.getByText("Chrome on Windows", { exact: false })).toBeVisible();

  await page.getByRole("link", { name: "Help" }).click();
  await expect(page.getByRole("heading", { name: "Help centre", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "A queue or service needs attention" })).toBeVisible();

  await page.getByRole("textbox", { name: "Search" }).fill("Taylor");
  await expect(page.getByRole("heading", { name: "Platform search", exact: true })).toBeVisible();
  await expect(page.getByText("Taylor Tech", { exact: true })).toBeVisible();
});

test("user directory paginates and requires evidence before revoking sessions", async ({ page }) => {
  let updateBody: Record<string, unknown> | undefined;
  await page.route("**/api/admin/master/subjects/**", async (route) => {
    updateBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, json: {} });
  });
  await page.getByRole("link", { name: "Users & access", exact: true }).click();
  await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("QA User 11", { exact: true })).toBeVisible();
  page.on("dialog", async (dialog) => dialog.type() === "prompt" ? dialog.accept("SEC-104 compromised device") : dialog.accept());
  await page.getByRole("button", { name: "Revoke sessions" }).first().click();
  await expect.poll(() => updateBody?.reason).toBe("SEC-104 compromised device");
  expect(updateBody?.revokeSessions).toBe(true);
});

test("user activity review is purpose limited, time boxed, and content free", async ({ page }) => {
  let investigationBody: Record<string, unknown> | undefined;
  await page.route("**/api/admin/master/user-activity/CANDIDATE/*/investigate", async (route) => {
    investigationBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, json: activityInvestigation });
  });
  await page.getByRole("link", { name: "Users & access", exact: true }).click();
  await page.getByRole("button", { name: "Review activity" }).first().click();
  await expect(page.getByRole("heading", { name: "Review Taylor Tech’s activity" })).toBeVisible();
  await expect(page.getByText("Private content stays private", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open 15-minute activity review" }).click();
  await expect(page.getByText("Add a meaningful reason or ticket reference of at least 10 characters.", { exact: true })).toBeVisible();
  await page.getByLabel("Investigation purpose").selectOption("SECURITY");
  await page.getByLabel("Activity time range").selectOption("90");
  await page.getByLabel("Investigation reason").fill("SEC-1842 repeated access complaint");
  await page.getByRole("button", { name: "Open 15-minute activity review" }).click();
  await expect(page.getByRole("region", { name: "User activity investigation" })).toBeVisible();
  await expect(page.getByText("Signed in successfully", { exact: true })).toBeVisible();
  await expect(page.getByText("Candidate CV downloaded by a recruiter", { exact: true })).toBeVisible();
  await expect(page.getByText("OTPs, passwords, message bodies", { exact: false })).toBeVisible();
  expect(investigationBody).toMatchObject({ purpose: "SECURITY", reason: "SEC-1842 repeated access complaint", rangeDays: 90 });
});
