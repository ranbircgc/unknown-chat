import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 45_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://unknown-chat-web.pages.dev',
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
  },
});
