import { expect, test } from "@playwright/test";

const recruiterOne = "7fbd4be4-1bf2-4a1d-918d-500000000001";
const recruiterTwo = "7fbd4be4-1bf2-4a1d-918d-500000000002";
const conversations = [
  { recruiterId: recruiterOne, recruiterName: "Jaya Rao", recruiterTitle: "Talent Partner", organisationName: "Nexora Cloud", applicationId: "2fbd4be4-1bf2-4a1d-918d-500000000001", jobTitle: "Senior Backend Engineer", applicationStage: "INTERVIEWING", lastMessageBody: "Could you share two times that work for a short conversation?", lastMessageAt: "2026-08-27T08:10:00Z", activityAt: "2026-08-27T08:10:00Z", unreadCount: 1 },
  { recruiterId: recruiterTwo, recruiterName: "Maya Chen", recruiterTitle: "Hiring Manager", organisationName: "Northstar Labs", applicationId: "2fbd4be4-1bf2-4a1d-918d-500000000002", jobTitle: "Product Designer", applicationStage: "SCREENING", lastMessageBody: null, lastMessageAt: null, activityAt: "2026-08-26T08:10:00Z", unreadCount: 0 },
];

test("candidate sees application-linked recruiter conversations and can send a reply", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sapienworx.local-candidate-domain", "TECH"));
  await page.route("**/api/candidate/messages**", (route) => {
    const url = route.request().url();
    if (url.endsWith("/conversations")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(conversations) });
    if (route.request().method() === "POST") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "8fbd4be4-1bf2-4a1d-918d-500000000001", senderId: "candidate", recipientId: recruiterOne, applicationId: conversations[0].applicationId, body: "Tuesday at 3 PM works well for me.", sentAt: "2026-08-27T09:00:00Z", readAt: null }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: [{ id: "9fbd4be4-1bf2-4a1d-918d-500000000001", senderId: recruiterOne, recipientId: "candidate", applicationId: conversations[0].applicationId, body: "Could you share two times that work for a short conversation?", sentAt: "2026-08-27T08:10:00Z", readAt: null }] }) });
  });

  await page.goto("/candidate/messages");

  await expect(page.getByRole("heading", { name: "Message centre" })).toBeVisible();
  await expect(page.getByText("Senior Backend Engineer", { exact: true })).toBeVisible();
  await expect(page.getByText("This conversation is tied to your application.")).toBeVisible();
  await expect(page.getByText("Jaya Rao", { exact: true })).toHaveCount(2);

  await page.getByLabel("Search conversations").fill("Product Designer");
  await expect(page.getByText("Maya Chen", { exact: true })).toBeVisible();
  await page.getByLabel("Search conversations").fill("");

  await page.getByLabel("Message Jaya Rao").fill("Tuesday at 3 PM works well for me.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("article").getByText("Tuesday at 3 PM works well for me.", { exact: true })).toBeVisible();
});
