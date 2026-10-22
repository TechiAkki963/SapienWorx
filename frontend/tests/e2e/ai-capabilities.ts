import type { Page } from "@playwright/test";

export async function mockAICapabilities(page: Page, available = true) {
  await page.route("**/api/v1/intelligence/capabilities", async route => {
    const headers = { "Access-Control-Allow-Origin": new URL(page.url()).origin, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "content-type,x-csrf-token", "Access-Control-Allow-Methods": "GET,OPTIONS" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    return route.fulfill({ status: 200, headers, json: { features: Object.fromEntries(["cv.parse", "job.parse", "job.generate_description"].map(task => [task, { available }])) } });
  });
}
