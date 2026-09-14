import { expect, Page, APIRequestContext } from "@playwright/test";

export const MOCK_API = "http://127.0.0.1:18080";

export type RecordedRequest = {
  method: string;
  path: string;
  search: string;
  query: Record<string, string>;
  body: Record<string, unknown>;
};

declare global {
  interface Window {
    __swxCLS?: number;
  }
}

export async function resetE2E(request: APIRequestContext) {
  const response = await request.post(`${MOCK_API}/__e2e/reset`);
  expect(response.ok()).toBeTruthy();
}

export async function recordedRequests(request: APIRequestContext): Promise<RecordedRequest[]> {
  const response = await request.get(`${MOCK_API}/__e2e/requests`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()).items as RecordedRequest[];
}

export async function waitForRecordedRequest(
  request: APIRequestContext,
  predicate: (item: RecordedRequest) => boolean,
  timeout = 8_000,
): Promise<RecordedRequest> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const item = (await recordedRequests(request)).find(predicate);
    if (item) return item;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Expected request was not recorded by the E2E mock API");
}

export async function installCLSObserver(page: Page) {
  await page.addInitScript(() => {
    window.__swxCLS = 0;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (!shift.hadRecentInput) window.__swxCLS = (window.__swxCLS ?? 0) + (shift.value ?? 0);
        }
      });
      observer.observe({ type: "layout-shift", buffered: true });
    } catch {
      // Older/non-Chromium engines may not expose LayoutShift entries.
    }
  });
}

export async function expectStableLayout(page: Page, threshold = 0.1) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(250);
  const cls = await page.evaluate(() => window.__swxCLS ?? 0);
  expect(cls, `CLS ${cls} exceeded ${threshold}`).toBeLessThanOrEqual(threshold);
}

export async function login(page: Page, role: "candidate" | "recruiter" | "master_admin") {
  const route = role === "candidate" ? "/login" : role === "recruiter" ? "/recruiter/login" : "/swx-command-centre";
  const destination = role === "candidate" ? /\/candidate(?:$|\?)/ : role === "recruiter" ? /\/recruiter(?:$|\?)/ : /\/swx-command-centre\/overview/;
  await page.goto(route);
  await page.getByLabel(role === "recruiter" ? "Work email" : "Email").fill(`${role}@example.com`);
  await page.getByLabel("Password").fill("E2e-password-123!");
  await page.getByRole("button", { name: role === "master_admin" ? "Enter command centre" : "Sign in" }).click();
  await expect(page).toHaveURL(destination);
}
