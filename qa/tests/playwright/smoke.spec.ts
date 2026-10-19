import { test, expect } from '@playwright/test';
import { apiURL } from './helpers';

test('landing page is alive', async ({ page }) => {
  const r = await page.goto('/');
  expect(r?.status()).toBe(200);
  await expect(page.locator('body')).toBeVisible();
});

test('backend liveness is healthy', async ({ request }) => {
  const r = await request.get(`${apiURL}/health/live`);
  expect(r.ok()).toBeTruthy();
  const body = await r.json();
  expect(String(body.status).toLowerCase()).toBe('ok');
});

test('backend readiness includes database', async ({ request }) => {
  const r = await request.get(`${apiURL}/health/ready`);
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(String(body.status).toLowerCase()).toBe('ready');
});
