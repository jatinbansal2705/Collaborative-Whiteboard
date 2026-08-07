import { expect, test } from '@playwright/test';

/**
 * End-to-end coverage for the public auth flows. These run against the real
 * NestJS API, so they exercise the full browser -> Next.js -> API round trip
 * (register, login, and the email-verification gate).
 */

const API_BASE_URL = 'http://localhost:3000/api/v1';
const uniqueEmail = () =>
  `e2e-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@example.com`;
const VALID_PASSWORD = 'Whiteboard1';

test('unauthenticated visitors are redirected from the dashboard to sign in', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByText('Welcome back — sign in to reach your boards.'),
  ).toBeVisible();
});

test('signup validates mismatched passwords without calling the API', async ({
  page,
}) => {
  await page.goto('/signup');
  await page.getByLabel('Email').fill(uniqueEmail());
  await page.getByLabel('Password', { exact: true }).fill(VALID_PASSWORD);
  await page.getByLabel('Confirm password').fill(`${VALID_PASSWORD}2`);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByText('Passwords do not match')).toBeVisible();
});

test('a visitor can register and is signed in to the dashboard', async ({
  page,
}) => {
  await page.goto('/signup');
  await page.getByLabel('Name (optional)').fill('Playwright User');
  await page.getByLabel('Email').fill(uniqueEmail());
  await page.getByLabel('Password', { exact: true }).fill(VALID_PASSWORD);
  await page.getByLabel('Confirm password').fill(VALID_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL('/');
  await expect(
    page.getByRole('button', { name: 'New board' }).first(),
  ).toBeVisible();
});

test('signing in with an unverified account redirects to the verify page', async ({
  page,
  request,
}) => {
  const email = uniqueEmail();
  const created = await request.post(`${API_BASE_URL}/auth/register`, {
    data: {
      email,
      password: VALID_PASSWORD,
      confirmPassword: VALID_PASSWORD,
    },
  });
  expect(created.status()).toBe(201);

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(VALID_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/verify-email/);
});
