import { test, expect } from '@playwright/test';
import { login } from './helpers';

const candidateEmail = process.env.E2E_NEW_CANDIDATE || `qa+${Date.now()}@example.com`;

test.describe.serial('critical state-preserving journeys', () => {
  test('candidate signup to application', async ({ page }) => {
    test.skip(!process.env.E2E_JOB_ID, 'E2E_JOB_ID required for full candidate journey');
    await page.goto('/signup?role=candidate');
    await page.getByTestId('name').fill('QA Candidate');
    await page.getByTestId('email').fill(candidateEmail);
    await page.getByTestId('phone').fill('9999999999');
    await page.getByTestId('password').fill('Password123!');
    await page.getByTestId('signup-submit').click();

    await page.getByTestId('otp').fill(process.env.TEST_OTP || '123456');
    await page.getByTestId('otp-submit').click();

    await page.goto('/candidate/profile');
    await page.getByTestId('headline').fill('QA Automation Engineer');
    await page.getByTestId('location').fill('Mumbai');
    await page.getByTestId('profile-save').click();

    await page.getByTestId('cv-upload').setInputFiles('fixtures/mock-cv.pdf');
    await expect(page.getByTestId('cv-upload-success')).toBeVisible();

    await page.goto(`/jobs/${process.env.E2E_JOB_ID}`);
    await page.getByTestId('apply-button').click();
    await expect(page.getByTestId('application-success')).toBeVisible();
  });

  test('recruiter moves candidate from Applied to Interview', async ({ page }) => {
    test.skip(!process.env.E2E_JOB_ID, 'full regression fixture not configured');
    await login(page, 'recruiter');
    await page.goto('/recruiter/candidates');
    const row = page.getByTestId('candidate-row').filter({ hasText: candidateEmail });
    await expect(row).toBeVisible();

    await page.goto('/recruiter/pipeline');
    const card = page.getByTestId('pipeline-candidate').filter({ hasText: candidateEmail });
    await expect(card).toBeVisible();
    await card.getByTestId('stage-select').selectOption('interview');
    await expect(card.getByTestId('stage-select')).toHaveValue('interview');
    await page.getByTestId('logout').click();
  });

  test('stage persists after fresh login', async ({ page }) => {
    test.skip(!process.env.E2E_JOB_ID, 'full regression fixture not configured');
    await login(page, 'recruiter');
    await page.goto('/recruiter/pipeline');
    const card = page.getByTestId('pipeline-candidate').filter({ hasText: candidateEmail });
    await expect(card.getByTestId('stage-select')).toHaveValue('interview');
  });
});
