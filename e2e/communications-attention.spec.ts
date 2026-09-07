import { expect, test } from "@playwright/test";

const candidateId = "1fbd4be4-1bf2-4a1d-918d-500000000001";
const applicationId = "2fbd4be4-1bf2-4a1d-918d-500000000001";

test("candidate workspace keeps message and interview attention counts after a reload", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sapienworx.local-candidate-domain", "TECH"));
  await page.route("**/api/notifications/summary", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ unreadNotifications: 3, unreadMessages: 2, unreadInterviews: 1 }) }));
  await page.route("**/api/candidate/messages**", (route) => {
    const url = route.request().url();
    if (url.endsWith("/conversations")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ recruiterId: candidateId, recruiterName: "Jaya Rao", recruiterTitle: "Talent Partner", organisationName: "Nexora", applicationId, jobTitle: "Backend Engineer", applicationStage: "INTERVIEWING", lastMessageBody: "Please share availability.", lastMessageAt: "2026-09-02T08:00:00Z", activityAt: "2026-09-02T08:00:00Z", unreadCount: 2 }]) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: [] }) });
  });

  await page.goto("/candidate/messages");
  await expect(page.getByRole("heading", { name: "Message centre" })).toBeVisible();
  await expect(page.getByLabel("2 unread messages")).toBeVisible();
  await expect(page.getByLabel("1 unread interview updates")).toBeVisible();
  await expect(page.getByLabel("3 live updates")).toBeVisible();
});

test("recruiter can see and reply to an application-linked candidate message", async ({ page }) => {
  await page.route("**/api/notifications/summary", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ unreadNotifications: 2, unreadMessages: 1, unreadInterviews: 2 }) }));
  await page.route("**/api/recruiter/communications/messages**", (route) => {
    const request = route.request();
    const url = request.url();
    if (url.endsWith("/conversations")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ candidateId, candidateName: "Amara Mensah", applicationId, jobTitle: "Senior Product Designer", applicationStage: "INTERVIEWING", lastMessageBody: "Tuesday afternoon is ideal.", lastMessageAt: "2026-09-02T08:00:00Z", activityAt: "2026-09-02T08:00:00Z", unreadCount: 1 }]) });
    if (request.method() === "POST") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "3fbd4be4-1bf2-4a1d-918d-500000000001", senderId: "recruiter", recipientId: candidateId, applicationId, body: "Tuesday at 3 PM works. I have sent the calendar invitation.", sentAt: "2026-09-02T09:00:00Z", readAt: null }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: [{ id: "4fbd4be4-1bf2-4a1d-918d-500000000001", senderId: candidateId, recipientId: "recruiter", applicationId, body: "Tuesday afternoon is ideal.", sentAt: "2026-09-02T08:00:00Z", readAt: null }] }) });
  });

  await page.goto("/recruiter/communications");
  await expect(page.getByRole("heading", { name: "Candidate inbox" })).toBeVisible();
  await expect(page.getByText("Amara Mensah", { exact: true })).toHaveCount(2);
  await expect(page.getByLabel("1 unread messages")).toBeVisible();
  await expect(page.getByLabel("2 unread interview updates")).toBeVisible();

  await page.getByLabel("Reply to Amara").fill("Tuesday at 3 PM works. I have sent the calendar invitation.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByText("Tuesday at 3 PM works. I have sent the calendar invitation.", { exact: true })).toBeVisible();
});
