import { defineConfig, devices } from '@playwright/test';

/**
 * Browser end-to-end tests for the web app. They run against a real
 * Next.js dev server (this workspace) and the live NestJS API on :3000.
 *
 * Run with:
 *   npm run test:e2e
 *
 * Requires the API to be running locally (see docs/PERFORMANCE.md or
 * docs/DEVELOPMENT.md) and `npx playwright install chromium` to have been
 * run once.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_URL: 'http://localhost:3000/api/v1',
      NEXT_PUBLIC_SOCKET_URL: 'http://localhost:3000',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3001',
    },
  },
});
