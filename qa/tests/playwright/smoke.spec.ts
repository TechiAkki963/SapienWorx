import { test, expect } from '@playwright/test';
import { apiURL } from './helpers';

test('landing page is alive', async ({ page }) => {
  const r = await page.goto('/');
  expect(r?.status()).toBe(200);
  await expect(page.locator('body')).toBeVisible();
});

test('backend health is healthy', async ({ request }) => {
  const r = await request.get(`${apiURL}/api/v1/health`);
  expect(r.ok()).toBeTruthy();
  const body = await r.json();
  expect(['ok', 'healthy', 'up']).toContain(String(body.status).toLowerCase());
});
