# Master Architecture Prompt: E2E UI & Functional Testing

**Objective:** Implement an automated End-to-End (E2E) testing suite using Playwright. This suite must validate frontend UI rendering, test functional user flows (e.g., login, domain routing), and mock backend API responses to ensure the Next.js application is entirely resilient.

---

## 1. Environment Setup

The QA team must install Playwright within the Next.js frontend repository.

\`\`\`bash
npm init playwright@latest
\`\`\`

Ensure the `playwright.config.ts` is configured to run tests across Chromium, Firefox, and WebKit, and set the `baseURL` to your local Next.js development server (e.g., `http://localhost:3000`).

---

## 2. Core Functional & UI Test File

This script tests the critical path: a candidate logging in via OTP and being correctly routed based on their domain categorisation.

**File Path:** `e2e/auth-and-routing.spec.ts`

\`\`\`typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication & Domain Routing Flow', () => {

test('UI Test: Renders login page correctly', async ({ page }) => {
await page.goto('/login');

    // UI Assertions: Verify branding and inputs are present
    await expect(page.locator('img[alt="Sapienworx Logo"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
    await expect(page.getByPlaceholder('Enter your email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Request OTP' })).toBeDisabled(); // Should be disabled if input is empty

});

test('Functional Test: Successful OTP login routes to candidate dashboard', async ({ page }) => {
// 1. Intercept the network request to mock the Spring Boot backend response
await page.route('\*\*/api/auth/verify-otp', async route => {
const json = { status: 'SUCCESS', domainCategory: 'TECH' };
await route.fulfill({ json, status: 200, headers: { 'Set-Cookie': 'swx_auth_token=mocked-jwt; HttpOnly' } });
});

    await page.goto('/login');

    // 2. Simulate User Input
    await page.getByPlaceholder('Enter your email').fill('candidate@example.com');
    await page.getByRole('button', { name: 'Request OTP' }).click();

    // 3. Enter Mocked OTP
    await page.getByPlaceholder('Enter 6-digit code').fill('123456');
    await page.getByRole('button', { name: 'Verify & Login' }).click();

    // 4. Functional Assertion: Verify Next.js middleware routes the user correctly based on the 'TECH' domain
    await page.waitForURL('**/candidate/dashboard');
    await expect(page.getByRole('heading', { name: 'Tech Dashboard' })).toBeVisible();

});

test('Functional Test: Unassigned domain forces resolution modal', async ({ page }) => {
// Mock a response where the candidate's domain is UNASSIGNED
await page.route('\*\*/api/auth/verify-otp', async route => {
const json = { status: 'SUCCESS', domainCategory: 'UNASSIGNED' };
await route.fulfill({ json, status: 200, headers: { 'Set-Cookie': 'swx_auth_token=mocked-jwt; HttpOnly' } });
});

    await page.goto('/login');
    await page.getByPlaceholder('Enter your email').fill('newuser@example.com');
    await page.getByRole('button', { name: 'Request OTP' }).click();
    await page.getByPlaceholder('Enter 6-digit code').fill('123456');
    await page.getByRole('button', { name: 'Verify & Login' }).click();

    // Assertion: Verify the mandatory UI resolution modal blocks the dashboard
    await expect(page.getByText('Tailor your Sapienworx experience')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Engineering & Technical' })).toBeVisible();

});
});
\`\`\`
