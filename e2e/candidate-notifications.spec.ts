import { expect, test } from "@playwright/test";

const notificationPage = {
  content: [
    { id: "4fbd4be4-1bf2-4a1d-918d-500000000001", notificationType: "INTERVIEW_SCHEDULED", title: "Interview scheduled", body: "Your portfolio conversation for the Product Designer role has been scheduled.", resourceType: "APPLICATION", resourceId: "2fbd4be4-1bf2-4a1d-918d-500000000001", readAt: null, createdAt: "2026-08-27T08:00:00Z" },
    { id: "4fbd4be4-1bf2-4a1d-918d-500000000002", notificationType: "APPLICATION_STAGE_CHANGED", title: "Application update", body: "Your application for Senior Backend Engineer moved to SCREENING.", resourceType: "APPLICATION", resourceId: "2fbd4be4-1bf2-4a1d-918d-500000000002", readAt: "2026-08-26T08:00:00Z", createdAt: "2026-08-26T07:00:00Z" },
    { id: "4fbd4be4-1bf2-4a1d-918d-500000000003", notificationType: "PROFILE_VIEWED", title: "Profile viewed", body: "A recruiter viewed your sourcing profile.", resourceType: "CANDIDATE", resourceId: null, readAt: null, createdAt: "2026-08-25T08:00:00Z" },
  ],
  totalElements: 3,
  totalPages: 1,
  number: 0,
  first: true,
  last: true,
};

test("candidate has one notification entry point and can manage the live activity feed", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sapienworx.local-candidate-domain", "TECH"));
  await page.route("**/api/auth/csrf", (route) => route.fulfill({ status: 200, json: { token: "test-csrf" } }));
  await page.route("**/api/notifications**", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(notificationPage) });
    if (route.request().url().endsWith("/read-all")) return route.fulfill({ status: 204 });
    const id = route.request().url().split("/").at(-2);
    const notification = notificationPage.content.find((item) => item.id === id);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...notification, readAt: new Date().toISOString() }) });
  });

  await page.goto("/candidate/notifications");

  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "candidate navigation" }).getByText("Notifications", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Notifications" })).toHaveCount(1);
  await expect(page.getByText("Interview scheduled", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Interviews" }).click();
  await expect(page.getByText("Interview scheduled", { exact: true })).toBeVisible();
  await expect(page.getByText("Application update", { exact: true })).not.toBeVisible();

  await page.getByRole("tab", { name: "All activity" }).click();
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByRole("button", { name: "Mark all as read" })).toBeDisabled();
});
