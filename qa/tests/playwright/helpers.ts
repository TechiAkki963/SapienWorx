import { expect, Page } from '@playwright/test';

export const apiURL = process.env.API_URL || 'http://127.0.0.1:8080';

export async function login(page: Page, role: 'candidate' | 'recruiter' | 'admin') {
  const creds = {
    candidate: [process.env.CANDIDATE_EMAIL || 'candidate@example.com', process.env.CANDIDATE_PASSWORD || 'Password123!'],
    recruiter: [process.env.RECRUITER_EMAIL || 'recruiter@example.com', process.env.RECRUITER_PASSWORD || 'Password123!'],
    admin: [process.env.ADMIN_EMAIL || 'admin@example.com', process.env.ADMIN_PASSWORD || 'Password123!']
  } as const;
  const [email, password] = creds[role];
  await page.goto(`/login?role=${role}`);
  await page.getByTestId('email').fill(email);
  await page.getByTestId('password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(new RegExp(`/${role}|/dashboard`));
}

export async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBeFalsy();
}

export async function assertNoLayoutShift(page: Page, action: () => Promise<void>, maxCLS = 0.1) {
  await page.addInitScript(() => {
    (window as any).__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any) {
        if (!entry.hadRecentInput) (window as any).__cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true } as any);
  });
  await action();
  const cls = await page.evaluate(() => (window as any).__cls || 0);
  expect(cls).toBeLessThanOrEqual(maxCLS);
}
